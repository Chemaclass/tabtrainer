import { frequencyOf } from '../core/pitch';

export type SourceKind = 'instrument' | 'count-in' | 'metronome' | 'backing';
type Scheduled = { node: AudioScheduledSourceNode; kind: SourceKind; start: number; end: number };

const MASTER_LEVEL = 0.8;
const SILENT = 0.0001;
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

function softClipCurve(size: number, hardness: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const input = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(hardness * input) / Math.tanh(hardness);
  }
  return curve;
}

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
    try { this.ctx = this.ctx ?? new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return false; }
    void this.ctx.resume();
    if (!this.master) { this.master = this.ctx.createGain(); this.master.gain.value = MASTER_LEVEL; this.master.connect(this.ctx.destination); }
    else if (this.silenced) this.master.gain.setTargetAtTime(MASTER_LEVEL, this.ctx.currentTime, 0.005);
    this.silenced = false;
    return true;
  }
  voice(when: number, midi: number, dur: number, vel: number, out: AudioNode = this.master!, kind: SourceKind = 'instrument') {
    const ctx = this.ctx!, f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 10), when); lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 2), when + 0.4);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    g2.gain.value = 0.6; o.connect(lp); o2.connect(g2); g2.connect(g); lp.connect(g); g.connect(out);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
    this.track(o, kind, when, when + dur + 0.05); this.track(o2, kind, when, when + dur + 0.05);
  }
  keys(when: number, midi: number[], dur: number, vel: number, out: AudioNode = this.master!) {
    const ctx = this.ctx!, level = vel / Math.sqrt(Math.max(1, midi.length)), end = when + dur + 0.6;
    for (const note of midi) {
      const f = 440 * Math.pow(2, (note - 69) / 12);
      const carrier = ctx.createOscillator(), modulator = ctx.createOscillator(), partial = ctx.createOscillator();
      const depth = ctx.createGain(), partialLevel = ctx.createGain(), g = ctx.createGain();
      carrier.type = 'sine'; modulator.type = 'sine'; partial.type = 'sine';
      carrier.frequency.value = f; modulator.frequency.value = f; partial.frequency.value = f * 2; partial.detune.value = 7;
      depth.gain.setValueAtTime(f * (0.6 + vel), when); depth.gain.setTargetAtTime(f * 0.08, when, 0.12);
      partialLevel.gain.value = 0.12;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(level, when + 0.004);
      g.gain.setTargetAtTime(level * 0.35, when + 0.004, 0.3); g.gain.setTargetAtTime(0, when + dur, 0.12);
      modulator.connect(depth); depth.connect(carrier.frequency);
      carrier.connect(g); partial.connect(partialLevel); partialLevel.connect(g); g.connect(out);
      for (const o of [carrier, modulator, partial]) { o.start(when); o.stop(end); this.track(o, 'backing', when, end); }
    }
  }
  organ(when: number, midi: number[], dur: number, vel: number, out: AudioNode = this.master!) {
    const level = (ORGAN.level * vel) / Math.sqrt(Math.max(1, midi.length));
    const end = when + dur + ORGAN.release * 5;
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
    const end = when + dur + DRIVE.release * 5;
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
  private oscillator(type: OscillatorType, frequency: number, when: number, end: number) {
    const oscillator = this.ctx!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.start(when);
    oscillator.stop(end);
    this.track(oscillator, 'backing', when, end);
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
    const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1200 : 800;
    g.gain.setValueAtTime(Math.max(0.0001, volume * (accent ? 0.5 : 0.3)), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    o.connect(g); g.connect(this.master!); o.start(when); o.stop(when + 0.04); this.track(o, kind, when, when + 0.04);
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
    if (this.master && this.ctx) { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03); this.silenced = true; }
  }
  private driveCurve() {
    this.curve ??= softClipCurve(DRIVE.curveSize, DRIVE.curveHardness);
    return this.curve;
  }
  track(node: AudioScheduledSourceNode, kind: SourceKind, start: number, end: number) { this.sources.push({ node, kind, start, end }); }
}
