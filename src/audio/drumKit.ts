import type { Drum, DrumKitName } from '../core/groove';
import { DRUM_KIT_TUNINGS, type DrumKitTuning, type HatTuning, type SnareTuning } from './drumKits';
import type { Synth } from './synth';

interface Hit { when: number; velocity: number; level: number; out: AudioNode; tuning: DrumKitTuning }
interface ToneRange { soft: number; hard: number }
interface MetalTone { fundamental: number; band: ToneRange; bandQ: number; highpass: number; level: number; decay: number }
type MetalVoicing = Omit<MetalTone, 'decay'>;
interface RingingVoice { start: number; end: number; envelopes: GainNode[]; sources: AudioScheduledSourceNode[] }
type HatState = 'closed' | 'half' | 'open' | 'pedal';

const SILENT = 0.0001;
// e^-7 is about -60 dB, where a decaying hit is inaudible
const DECAYS_TO_SILENCE = 7;
const NOISE_SECONDS = 1;
const VELOCITY_CURVE = 1.6;
const CLICK_ATTACK = 0.0005;

const KICK = {
  attack: 0.002,
  accentPitchRise: 0.25,
  clickBand: { soft: 1800, hard: 4500 },
  clickQ: 0.9,
  clickDecay: 0.004,
};

const SNARE = {
  attack: 0.001,
  modeLevel: 0.4,
  modePitchDrop: 0.92,
  modePitchTime: 0.03,
  snapBand: { soft: 1200, hard: 3200 },
  snapQ: 0.8,
  snapDecay: 0.015,
  wireBand: { soft: 3500, hard: 7000 },
  wireQ: 0.7,
};

const RIM = {
  woodFrequency: 520,
  woodLevel: 0.5,
  woodDecay: 0.018,
  ringFrequency: 1720,
  ringLevel: 0.32,
  ringDecay: 0.007,
  attack: 0.0005,
  clickBand: { soft: 2000, hard: 3200 },
  clickQ: 1.4,
  clickLevel: 0.35,
  clickDecay: 0.005,
};

// The six square wave ratios of the classic analog hi-hat: inharmonic, so their sum sounds like metal
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];
const METAL_ATTACK = 0.001;
const METAL_DETUNE_CENTS = 30;

const HAT = {
  band: { soft: 7000, hard: 10500 },
  pedalBand: { soft: 5500, hard: 7500 },
  bandQ: 0.8,
  highpass: 7000,
  level: 2.5,
  pedalLevel: 1.4,
  pedalDecay: 0.015,
};

const RIDE: MetalVoicing = { fundamental: 52, band: { soft: 4500, hard: 7500 }, bandQ: 1.2, highpass: 2500, level: 1.8 };
const BELL: MetalVoicing = { fundamental: 70, band: { soft: 2400, hard: 3600 }, bandQ: 3, highpass: 1200, level: 2 };
const BELL_DECAY_RATIO = 0.8;
const CRASH: MetalVoicing = { fundamental: 46, band: { soft: 5000, hard: 8500 }, bandQ: 0.6, highpass: 3000, level: 1.8 };
const CRASH_WASH_LEVEL = 1.5;

// A drum struck again cuts its old ring short, as a real one does, which caps how many sources play at once
const RESTRIKE_RELEASE = 0.02;
const HAT_CHOKE = 0.006;
const HATS: readonly Drum[] = ['hat', 'halfhat', 'openhat', 'pedalhat'];
const instrumentOf = (drum: Drum): string => (HATS.includes(drum) ? 'hat' : drum === 'bell' ? 'ride' : drum);

const TOM = {
  attack: 0.002,
  pitchBend: 1.35,
  pitchDrop: 0.06,
  level: 0.9,
  stickBand: { soft: 1500, hard: 3500 },
  stickQ: 1,
  stickLevel: 0.3,
  stickDecay: 0.006,
};

const clampVelocity = (velocity: number) => Math.max(0, Math.min(1, velocity));
const loudness = (velocity: number) => Math.pow(clampVelocity(velocity), VELOCITY_CURVE);
const brightness = (range: ToneRange, velocity: number) => range.soft * Math.pow(range.hard / range.soft, velocity);
const endOf = (when: number, attack: number, decay: number) => when + attack + decay * DECAYS_TO_SILENCE;
const silentVoice = (start: number): RingingVoice => ({ start, end: start, envelopes: [], sources: [] });

function connectInSeries(...nodes: AudioNode[]) {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
}

function glide(param: AudioParam, from: number, to: number, when: number, duration: number) {
  param.setValueAtTime(from, when);
  param.exponentialRampToValueAtTime(to, when + duration);
}

export class DrumKit {
  private noiseBuffer: AudioBuffer | null = null;
  private ringing = new Map<string, RingingVoice>();
  // Every source and envelope made during one strike joins its voice, so the next strike of that instrument can release them
  private voice = silentVoice(0);
  private seed = 1;
  private gridTime = 0;

  constructor(private synth: Synth) {}

  play(drum: Drum, when: number, velocity: number, out: AudioNode, offset = 0, kit: DrumKitName = 'rock') {
    const level = loudness(velocity);
    if (level <= 0) return;
    this.gridTime = when;
    const hit: Hit = { when: Math.max(this.synth.now, when + offset), velocity: clampVelocity(velocity), level, out, tuning: DRUM_KIT_TUNINGS[kit] };
    const instrument = instrumentOf(drum);
    this.release(this.ringing.get(instrument), hit.when, HATS.includes(drum) ? HAT_CHOKE : RESTRIKE_RELEASE);
    this.voice = silentVoice(hit.when);
    this.strike(drum, hit);
    this.ringing.set(instrument, this.voice);
  }

  private strike(drum: Drum, hit: Hit) {
    switch (drum) {
      case 'kick': return this.kick(hit);
      case 'snare': return this.snare(hit);
      case 'rim': return this.rim(hit);
      case 'hat': return this.hat(hit, 'closed');
      case 'halfhat': return this.hat(hit, 'half');
      case 'openhat': return this.hat(hit, 'open');
      case 'pedalhat': return this.hat(hit, 'pedal');
      case 'ride': return this.ride(hit);
      case 'bell': return this.bell(hit);
      case 'crash': return this.crash(hit);
      case 'hightom': return this.tom(hit, hit.tuning.tom.high);
      case 'midtom': return this.tom(hit, hit.tuning.tom.mid);
      case 'lowtom': return this.tom(hit, hit.tuning.tom.low);
    }
  }

  private get ctx() { return this.synth.context; }

  private kick(hit: Hit) {
    const { when, velocity, level, out } = hit;
    const tuning = hit.tuning.kick;
    const body = this.oscillator('sine', tuning.endFrequency, when, endOf(when, KICK.attack, tuning.decay));
    const accentedStart = tuning.startFrequency * (1 + KICK.accentPitchRise * velocity);
    glide(body.frequency, accentedStart, tuning.endFrequency, when, tuning.pitchDrop);
    connectInSeries(body, this.envelope(when, level, KICK.attack, tuning.decay), out);
    this.noiseClick(hit, KICK.clickBand, KICK.clickQ, level * tuning.clickLevel, KICK.clickDecay);
  }

  private snare(hit: Hit) {
    this.snareBody(hit, hit.tuning.snare);
    this.snareNoise(hit, hit.tuning.snare);
  }

  private snareBody(hit: Hit, tuning: SnareTuning) {
    const { when, level, out } = hit;
    const end = endOf(when, SNARE.attack, tuning.bodyDecay);
    const body = this.envelope(when, level * SNARE.modeLevel, SNARE.attack, tuning.bodyDecay);
    body.connect(out);
    for (const frequency of [tuning.lowMode, tuning.highMode]) {
      const mode = this.oscillator('triangle', frequency, when, end);
      glide(mode.frequency, frequency, frequency * SNARE.modePitchDrop, when, SNARE.modePitchTime);
      mode.connect(body);
    }
  }

  private snareNoise(hit: Hit, tuning: SnareTuning) {
    const { when, velocity, level, out } = hit;
    const noise = this.noise(when, endOf(when, SNARE.attack, tuning.wireDecay));
    const snap = this.filter('bandpass', brightness(SNARE.snapBand, velocity), SNARE.snapQ);
    const wires = this.filter('bandpass', brightness(SNARE.wireBand, velocity), SNARE.wireQ);
    connectInSeries(noise, snap, this.envelope(when, level * tuning.snapLevel, SNARE.attack, SNARE.snapDecay), out);
    connectInSeries(noise, wires, this.envelope(when, level * tuning.wireLevel, SNARE.attack, tuning.wireDecay), out);
  }

  private rim(hit: Hit) {
    const { when, level, out } = hit;
    const wood = this.oscillator('triangle', RIM.woodFrequency, when, endOf(when, RIM.attack, RIM.woodDecay));
    connectInSeries(wood, this.envelope(when, level * RIM.woodLevel, RIM.attack, RIM.woodDecay), out);
    const ring = this.oscillator('sine', RIM.ringFrequency, when, endOf(when, RIM.attack, RIM.ringDecay));
    connectInSeries(ring, this.envelope(when, level * RIM.ringLevel, RIM.attack, RIM.ringDecay), out);
    this.noiseClick(hit, RIM.clickBand, RIM.clickQ, level * RIM.clickLevel, RIM.clickDecay);
  }

  private hat(hit: Hit, state: HatState) {
    this.metal(hit, this.hatTone(hit.tuning.hat, state));
  }

  private hatTone(tuning: HatTuning, state: HatState): MetalTone {
    const voicing = { fundamental: tuning.fundamental, bandQ: HAT.bandQ, highpass: HAT.highpass };
    if (state === 'pedal') return { ...voicing, band: HAT.pedalBand, level: HAT.pedalLevel, decay: HAT.pedalDecay };
    const decays: Record<Exclude<HatState, 'pedal'>, number> = { closed: tuning.closedDecay, half: tuning.halfDecay, open: tuning.openDecay };
    return { ...voicing, band: HAT.band, level: HAT.level, decay: decays[state] };
  }

  private ride(hit: Hit) {
    this.metal(hit, { ...RIDE, decay: hit.tuning.cymbal.rideDecay });
  }

  private bell(hit: Hit) {
    this.metal(hit, { ...BELL, decay: hit.tuning.cymbal.rideDecay * BELL_DECAY_RATIO });
  }

  private crash(hit: Hit) {
    const tone = { ...CRASH, decay: hit.tuning.cymbal.crashDecay };
    const metal = this.metal(hit, tone);
    const wash = this.ctx.createGain();
    wash.gain.value = CRASH_WASH_LEVEL;
    const noise = this.noise(hit.when, endOf(hit.when, METAL_ATTACK, tone.decay));
    connectInSeries(noise, wash, metal);
  }

  private tom(hit: Hit, frequency: number) {
    const { when, level, out } = hit;
    const decay = hit.tuning.tom.decay;
    const body = this.oscillator('sine', frequency, when, endOf(when, TOM.attack, decay));
    glide(body.frequency, frequency * TOM.pitchBend, frequency, when, TOM.pitchDrop);
    connectInSeries(body, this.envelope(when, level * TOM.level, TOM.attack, decay), out);
    this.noiseClick(hit, TOM.stickBand, TOM.stickQ, level * TOM.stickLevel, TOM.stickDecay);
  }

  private metal(hit: Hit, tone: MetalTone): AudioNode {
    const { when, velocity, level, out } = hit;
    const end = endOf(when, METAL_ATTACK, tone.decay);
    const band = this.filter('bandpass', brightness(tone.band, velocity), tone.bandQ);
    const high = this.filter('highpass', tone.highpass);
    const gain = this.envelope(when, (level * tone.level) / METAL_RATIOS.length, METAL_ATTACK, tone.decay);
    connectInSeries(band, high, gain, out);
    for (const ratio of METAL_RATIOS) {
      const square = this.oscillator('square', tone.fundamental * ratio, when, end);
      square.detune.value = (this.random() - 0.5) * METAL_DETUNE_CENTS;
      square.connect(band);
    }
    return band;
  }

  private noiseClick(hit: Hit, band: ToneRange, q: number, peak: number, decay: number) {
    const { when, velocity, out } = hit;
    const noise = this.noise(when, endOf(when, CLICK_ATTACK, decay));
    const filter = this.filter('bandpass', brightness(band, velocity), q);
    connectInSeries(noise, filter, this.envelope(when, peak, CLICK_ATTACK, decay), out);
  }

  private release(voice: RingingVoice | undefined, when: number, time: number) {
    if (!voice || when <= voice.start || when >= voice.end) return;
    for (const envelope of voice.envelopes) envelope.gain.setTargetAtTime(0, when, time);
    const silent = Math.min(voice.end, when + time * DECAYS_TO_SILENCE);
    for (const source of voice.sources) source.stop(silent);
  }

  private envelope(when: number, peak: number, attack: number, decay: number) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(SILENT, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), when + attack);
    gain.gain.setTargetAtTime(0, when + attack, decay);
    this.voice.envelopes.push(gain);
    return gain;
  }

  private filter(type: BiquadFilterType, frequency: number, q?: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if (q !== undefined) filter.Q.value = q;
    return filter;
  }

  private oscillator(type: OscillatorType, frequency: number, when: number, end: number) {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.start(when);
    this.finish(oscillator, end);
    return oscillator;
  }

  private noise(when: number, end: number) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoise();
    noise.loop = true;
    noise.start(when, this.random() * NOISE_SECONDS);
    this.finish(noise, end);
    return noise;
  }

  private finish(source: AudioScheduledSourceNode, end: number) {
    source.stop(end);
    this.voice.sources.push(source);
    this.voice.end = Math.max(this.voice.end, end);
    source.onended = () => source.disconnect();
    // Rescheduling at a bar line cancels by grid time, so a humanized hit is tracked at its grid time
    this.synth.track(source, 'backing', this.gridTime, end);
  }

  private sharedNoise() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = this.random() * 2 - 1;
    return this.noiseBuffer;
  }

  private random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
