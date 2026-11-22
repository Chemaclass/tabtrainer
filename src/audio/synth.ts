import { frequencyOf } from '../core/pitch';

export type SourceKind = 'instrument' | 'count-in' | 'metronome' | 'backing';
export interface VoiceShape { muted?: boolean }
type Scheduled = { node: AudioScheduledSourceNode; kind: SourceKind; start: number; end: number };

const MASTER_LEVEL = 0.8;
const MASTER_RESTORE_TIME = 0.005;
const MASTER_FADE_TIME = 0.03;
const SILENT = 0.0001;
const VOICE = {
  attack: 0.008,
  releaseLevel: 0.0008,
  tail: 0.05,
  sineLevel: 0.6,
  // The low pass closes after the strike, so each note starts bright and mellows
  openRatio: 10,
  openMax: 5000,
  closedRatio: 2,
  closedMin: 180,
  sweepTime: 0.4,
};
// The picking hand damps the string, so the note stops early and its low pass starts nearly closed
const PALM = {
  length: 0.12,
  openRatio: 3,
  sweepTime: 0.05,
};
const KEYS = {
  attack: 0.004,
  sustainRatio: 0.35,
  decayTime: 0.3,
  releaseTime: 0.12,
  tail: 0.6,
  modulationDepth: 0.6,
  settledDepth: 0.08,
  settleTime: 0.12,
  partialRatio: 2,
  partialDetune: 7,
  partialLevel: 0.12,
};
const ORGAN = {
  level: 0.5,
  attack: 0.006,
  release: 0.02,
  drawbars: [[0.5, 0.5], [1, 1], [1.5, 0.6], [2, 0.45], [3, 0.2]] as readonly [number, number][],
};
const DRIVE = {
  amount: 4,
  // The shaper squares the waves off near full scale, so the driven voice sits lower than the clean ones
  level: 0.25,
  attack: 0.004,
  release: 0.03,
  detune: [-8, 8],
  lowCut: 80,
  cabinet: 3200,
  cabinetQ: 0.9,
  curveSize: 2048,
  curveHardness: 3,
};
// The falling pitch makes it read as a click, not a note
const DEAD = {
  cutoff: 900,
  attack: 0.003,
  length: 0.05,
  drop: -1200,
};
// setTargetAtTime approaches its target without reaching it; five time constants leave under one percent
const RELEASE_TIME_CONSTANTS = 5;
const CLICK = {
  frequency: 800,
  accentFrequency: 1200,
  level: 0.3,
  accentLevel: 0.5,
  length: 0.04,
};

function softClipCurve(size: number, hardness: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const input = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(hardness * input) / Math.tanh(hardness);
  }
  return curve;
}

function createAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioContextClass();
}

/** Each note of a chord gets a share of the level, so a full chord is not louder than one note. */
const chordNoteLevel = (level: number, noteCount: number) => level / Math.sqrt(Math.max(1, noteCount));

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: Scheduled[] = [];
  private silenced = false;
  private curve: Float32Array<ArrayBuffer> | null = null;

  get started() { return this.ctx !== null; }
  get now() { return this.ctx?.currentTime ?? 0; }
  get latency() { return this.ctx!.outputLatency || this.ctx!.baseLatency || 0; }
  get context(): AudioContext { return this.ctx!; }
  get output(): AudioNode { return this.master!; }

  ensure(): boolean {
    try {
      this.ctx ??= createAudioContext();
    } catch {
      return false;
    }
    void this.ctx.resume();
    if (!this.master) this.master = this.createMaster(this.ctx);
    else if (this.silenced) this.master.gain.setTargetAtTime(MASTER_LEVEL, this.ctx.currentTime, MASTER_RESTORE_TIME);
    this.silenced = false;
    return true;
  }

  private createMaster(ctx: AudioContext): GainNode {
    const master = ctx.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(ctx.destination);
    return master;
  }

  /** A sawtooth through a closing low pass with a sine under it, for single notes. */
  voice(when: number, midi: number, written: number, vel: number, out: AudioNode = this.master!, kind: SourceKind = 'instrument', shape: VoiceShape = {}) {
    const frequency = frequencyOf(midi);
    const dur = shape.muted ? Math.min(written, PALM.length) : written;
    const tone = shape.muted ? PALM : VOICE;
    const end = when + dur + VOICE.tail;
    const saw = this.oscillator('sawtooth', frequency, when, end, kind);
    const sine = this.oscillator('sine', frequency, when, end, kind);
    const envelope = this.ctx!.createGain();
    envelope.gain.setValueAtTime(SILENT, when);
    envelope.gain.exponentialRampToValueAtTime(vel, when + VOICE.attack);
    envelope.gain.exponentialRampToValueAtTime(VOICE.releaseLevel, when + dur);
    const lowPass = this.ctx!.createBiquadFilter();
    lowPass.type = 'lowpass';
    const closed = Math.max(VOICE.closedMin, frequency * VOICE.closedRatio);
    const open = Math.min(VOICE.openMax, frequency * tone.openRatio);
    lowPass.frequency.setValueAtTime(shape.muted ? Math.max(closed, open) : open, when);
    lowPass.frequency.exponentialRampToValueAtTime(closed, when + tone.sweepTime);
    const sineLevel = this.ctx!.createGain();
    sineLevel.gain.value = VOICE.sineLevel;
    saw.connect(lowPass);
    lowPass.connect(envelope);
    sine.connect(sineLevel);
    sineLevel.connect(envelope);
    envelope.connect(out);
  }

  /** A dead note: a short sawtooth burst at the open string, dark and falling. */
  thud(when: number, midi: number, vel: number, out: AudioNode = this.master!) {
    const end = when + DEAD.length;
    const saw = this.oscillator('sawtooth', frequencyOf(midi), when, end, 'instrument');
    saw.detune.setValueAtTime(0, when);
    saw.detune.linearRampToValueAtTime(DEAD.drop, end);
    const lowPass = this.biquad('lowpass', DEAD.cutoff);
    const envelope = this.ctx!.createGain();
    envelope.gain.setValueAtTime(SILENT, when);
    envelope.gain.exponentialRampToValueAtTime(vel, when + DEAD.attack);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    saw.connect(lowPass);
    lowPass.connect(envelope);
    envelope.connect(out);
  }

  /** An electric piano: a sine carrier whose brightness comes from a modulator that settles after the strike. */
  keys(when: number, midi: number[], dur: number, vel: number, out: AudioNode = this.master!) {
    const level = chordNoteLevel(vel, midi.length);
    const end = when + dur + KEYS.tail;
    for (const note of midi) {
      const frequency = frequencyOf(note);
      const carrier = this.oscillator('sine', frequency, when, end);
      const modulator = this.oscillator('sine', frequency, when, end);
      const partial = this.oscillator('sine', frequency * KEYS.partialRatio, when, end);
      partial.detune.value = KEYS.partialDetune;
      const depth = this.ctx!.createGain();
      depth.gain.setValueAtTime(frequency * (KEYS.modulationDepth + vel), when);
      depth.gain.setTargetAtTime(frequency * KEYS.settledDepth, when, KEYS.settleTime);
      const partialLevel = this.ctx!.createGain();
      partialLevel.gain.value = KEYS.partialLevel;
      const envelope = this.keysEnvelope(when, dur, level);
      modulator.connect(depth);
      depth.connect(carrier.frequency);
      carrier.connect(envelope);
      partial.connect(partialLevel);
      partialLevel.connect(envelope);
      envelope.connect(out);
    }
  }

  private keysEnvelope(when: number, dur: number, level: number) {
    const envelope = this.ctx!.createGain();
    const peak = when + KEYS.attack;
    envelope.gain.setValueAtTime(SILENT, when);
    envelope.gain.exponentialRampToValueAtTime(level, peak);
    envelope.gain.setTargetAtTime(level * KEYS.sustainRatio, peak, KEYS.decayTime);
    envelope.gain.setTargetAtTime(0, when + dur, KEYS.releaseTime);
    return envelope;
  }

  organ(when: number, midi: number[], dur: number, vel: number, out: AudioNode = this.master!) {
    const level = chordNoteLevel(ORGAN.level * vel, midi.length);
    const end = when + dur + ORGAN.release * RELEASE_TIME_CONSTANTS;
    for (const note of midi) {
      const envelope = this.envelope(when, dur, level, ORGAN.attack, ORGAN.release);
      envelope.connect(out);
      for (const [ratio, amount] of ORGAN.drawbars) {
        const drawbar = this.ctx!.createGain();
        drawbar.gain.value = amount;
        drawbar.connect(envelope);
        this.oscillator('sine', frequencyOf(note) * ratio, when, end).connect(drawbar);
      }
    }
  }

  drive(when: number, midi: number[], dur: number, vel: number, out: AudioNode = this.master!) {
    const ctx = this.ctx!;
    const end = when + dur + DRIVE.release * RELEASE_TIME_CONSTANTS;
    const input = ctx.createGain();
    input.gain.value = DRIVE.amount / Math.max(1, midi.length);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.driveCurve();
    shaper.oversample = '4x';
    const lowCut = this.biquad('highpass', DRIVE.lowCut);
    const cabinet = this.biquad('lowpass', DRIVE.cabinet, DRIVE.cabinetQ);
    const envelope = this.envelope(when, dur, vel * DRIVE.level, DRIVE.attack, DRIVE.release);
    input.connect(shaper);
    shaper.connect(lowCut);
    lowCut.connect(cabinet);
    cabinet.connect(envelope);
    envelope.connect(out);
    for (const note of midi) {
      for (const cents of DRIVE.detune) {
        const saw = this.oscillator('sawtooth', frequencyOf(note), when, end);
        saw.detune.value = cents;
        saw.connect(input);
      }
    }
  }

  private oscillator(type: OscillatorType, frequency: number, when: number, end: number, kind: SourceKind = 'backing') {
    const oscillator = this.ctx!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.start(when);
    oscillator.stop(end);
    this.track(oscillator, kind, when, end);
    return oscillator;
  }

  private envelope(when: number, dur: number, level: number, attack: number, release: number) {
    const envelope = this.ctx!.createGain();
    envelope.gain.setValueAtTime(SILENT, when);
    envelope.gain.exponentialRampToValueAtTime(level, when + attack);
    envelope.gain.setTargetAtTime(0, when + dur, release);
    return envelope;
  }

  private biquad(type: BiquadFilterType, frequency: number, q?: number) {
    const filter = this.ctx!.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if (q !== undefined) filter.Q.value = q;
    return filter;
  }

  click(when: number, accent: boolean, kind: 'count-in' | 'metronome', volume: number) {
    if (volume === 0) return;
    const end = when + CLICK.length;
    const tone = this.oscillator('sine', accent ? CLICK.accentFrequency : CLICK.frequency, when, end, kind);
    const level = volume * (accent ? CLICK.accentLevel : CLICK.level);
    const envelope = this.ctx!.createGain();
    envelope.gain.setValueAtTime(Math.max(SILENT, level), when);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    tone.connect(envelope);
    envelope.connect(this.master!);
  }

  cancel(kind?: SourceKind, at = this.now) {
    const now = this.now;
    this.sources = this.sources.filter(s => {
      if (kind && s.kind !== kind) return s.end > now;
      try { s.node.stop(at); } catch { /* The source has already ended. */ }
      return false;
    });
  }

  cancelFuture(kind?: SourceKind, from = this.now) {
    const now = this.now;
    this.sources = this.sources.filter(s => {
      if (s.start <= from || (kind && s.kind !== kind)) return s.end > now;
      try { s.node.stop(now); } catch { /* The source has already ended. */ }
      return false;
    });
  }

  forget(now: number) { this.sources = this.sources.filter(s => s.end > now); }

  silence() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, MASTER_FADE_TIME);
    this.silenced = true;
  }

  private driveCurve() {
    this.curve ??= softClipCurve(DRIVE.curveSize, DRIVE.curveHardness);
    return this.curve;
  }

  track(node: AudioScheduledSourceNode, kind: SourceKind, start: number, end: number) { this.sources.push({ node, kind, start, end }); }
}
