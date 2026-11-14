import type { Drum, DrumKitName } from '../core/groove';
import { DRUM_KIT_TUNINGS, type DrumKitTuning, type HatTuning, type SnareTuning } from './drumKits';
import type { Synth } from './synth';

interface ToneRange {
  soft: number;
  hard: number;
}

interface MetalTone {
  fundamental: number;
  band: ToneRange;
  bandQ: number;
  highpass: number;
  level: number;
  decay: number;
}

type MetalVoicing = Omit<MetalTone, 'decay'>;
type HatState = 'closed' | 'half' | 'open' | 'pedal';
type Instrument = 'kick' | 'snare' | 'rim' | 'hat' | 'ride' | 'crash' | 'hightom' | 'midtom' | 'lowtom';

interface Strike {
  when: number;
  gridTime: number;
  velocity: number;
  level: number;
  out: AudioNode;
  tuning: DrumKitTuning;
  end: number;
  envelopes: GainNode[];
  sources: AudioScheduledSourceNode[];
}

const SILENT = 0.0001;
// e^-7 is about -60 dB, where a decaying hit is inaudible
const DECAYS_TO_SILENCE = 7;
const NOISE_SECONDS = 1;
const VELOCITY_CURVE = 1.6;
const CLICK_ATTACK = 0.0005;
const RANDOM_MULTIPLIER = 1664525;
const RANDOM_INCREMENT = 1013904223;
const UINT32_RANGE = 4294967296;

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
  attack: 0.0005,
  woodFrequency: 520,
  woodLevel: 0.5,
  woodDecay: 0.018,
  ringFrequency: 1720,
  ringLevel: 0.32,
  ringDecay: 0.007,
  clickBand: { soft: 2000, hard: 3200 },
  clickQ: 1.4,
  clickLevel: 0.35,
  clickDecay: 0.005,
};

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

const RIDE: MetalVoicing = {
  fundamental: 52,
  band: { soft: 4500, hard: 7500 },
  bandQ: 1.2,
  highpass: 2500,
  level: 1.8,
};

const BELL: MetalVoicing = {
  fundamental: 70,
  band: { soft: 2400, hard: 3600 },
  bandQ: 3,
  highpass: 1200,
  level: 2,
};

const BELL_DECAY_RATIO = 0.8;

const CRASH: MetalVoicing = {
  fundamental: 46,
  band: { soft: 5000, hard: 8500 },
  bandQ: 0.6,
  highpass: 3000,
  level: 1.8,
};

const CRASH_WASH_LEVEL = 1.5;

// A drum struck again cuts its old ring short, as a real one does, which caps how many sources play at once
const RESTRIKE_RELEASE = 0.02;
const HAT_CHOKE = 0.006;

const INSTRUMENT: Record<Drum, Instrument> = {
  kick: 'kick',
  snare: 'snare',
  rim: 'rim',
  hat: 'hat',
  halfhat: 'hat',
  openhat: 'hat',
  pedalhat: 'hat',
  ride: 'ride',
  bell: 'ride',
  crash: 'crash',
  hightom: 'hightom',
  midtom: 'midtom',
  lowtom: 'lowtom',
};

const clampVelocity = (velocity: number) => Math.max(0, Math.min(1, velocity));
const loudness = (velocity: number) => Math.pow(clampVelocity(velocity), VELOCITY_CURVE);
const brightness = (range: ToneRange, velocity: number) => range.soft * Math.pow(range.hard / range.soft, velocity);
const endOf = (when: number, attack: number, decay: number) => when + attack + decay * DECAYS_TO_SILENCE;

function connectInSeries(...nodes: AudioNode[]) {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
}

function glide(param: AudioParam, from: number, to: number, when: number, duration: number) {
  param.setValueAtTime(from, when);
  param.exponentialRampToValueAtTime(to, when + duration);
}

export class DrumKit {
  private noiseBuffer: AudioBuffer | null = null;
  private ringing = new Map<Instrument, Strike>();
  private seed = 1;

  constructor(private synth: Synth) {}

  play(drum: Drum, when: number, velocity: number, out: AudioNode, offset = 0, kit: DrumKitName = 'rock') {
    const level = loudness(velocity);
    if (level <= 0) return;
    const start = Math.max(this.synth.now, when + offset);
    const strike: Strike = {
      when: start,
      gridTime: when,
      velocity: clampVelocity(velocity),
      level,
      out,
      tuning: DRUM_KIT_TUNINGS[kit],
      end: start,
      envelopes: [],
      sources: [],
    };
    const instrument = INSTRUMENT[drum];
    this.release(this.ringing.get(instrument), strike, instrument === 'hat' ? HAT_CHOKE : RESTRIKE_RELEASE);
    this.strike(drum, strike);
    this.ringing.set(instrument, strike);
  }

  reset() {
    this.ringing.clear();
  }

  private strike(drum: Drum, strike: Strike) {
    switch (drum) {
      case 'kick': return this.kick(strike);
      case 'snare': return this.snare(strike);
      case 'rim': return this.rim(strike);
      case 'hat': return this.hat(strike, 'closed');
      case 'halfhat': return this.hat(strike, 'half');
      case 'openhat': return this.hat(strike, 'open');
      case 'pedalhat': return this.hat(strike, 'pedal');
      case 'ride': return this.ride(strike);
      case 'bell': return this.bell(strike);
      case 'crash': return this.crash(strike);
      case 'hightom': return this.tom(strike, strike.tuning.tom.high);
      case 'midtom': return this.tom(strike, strike.tuning.tom.mid);
      case 'lowtom': return this.tom(strike, strike.tuning.tom.low);
    }
  }

  private get ctx() { return this.synth.context; }

  private kick(strike: Strike) {
    const tuning = strike.tuning.kick;
    const body = this.tone(strike, 'sine', tuning.endFrequency, strike.level, KICK.attack, tuning.decay);
    const accentedStart = tuning.startFrequency * (1 + KICK.accentPitchRise * strike.velocity);
    glide(body.frequency, accentedStart, tuning.endFrequency, strike.when, tuning.pitchDrop);
    this.noiseClick(strike, KICK.clickBand, KICK.clickQ, strike.level * tuning.clickLevel, KICK.clickDecay);
  }

  private snare(strike: Strike) {
    this.snareBody(strike, strike.tuning.snare);
    this.snareNoise(strike, strike.tuning.snare);
  }

  private snareBody(strike: Strike, tuning: SnareTuning) {
    const { when, level, out } = strike;
    const end = endOf(when, SNARE.attack, tuning.bodyDecay);
    const body = this.envelope(strike, level * SNARE.modeLevel, SNARE.attack, tuning.bodyDecay);
    body.connect(out);
    for (const frequency of [tuning.lowMode, tuning.highMode]) {
      const mode = this.oscillator(strike, 'triangle', frequency, end);
      glide(mode.frequency, frequency, frequency * SNARE.modePitchDrop, when, SNARE.modePitchTime);
      mode.connect(body);
    }
  }

  private snareNoise(strike: Strike, tuning: SnareTuning) {
    const { when, velocity, level, out } = strike;
    const noise = this.noise(strike, endOf(when, SNARE.attack, tuning.wireDecay));
    const snap = this.filter('bandpass', brightness(SNARE.snapBand, velocity), SNARE.snapQ);
    const snapLevel = this.envelope(strike, level * tuning.snapLevel, SNARE.attack, SNARE.snapDecay);
    const wires = this.filter('bandpass', brightness(SNARE.wireBand, velocity), SNARE.wireQ);
    const wireLevel = this.envelope(strike, level * tuning.wireLevel, SNARE.attack, tuning.wireDecay);
    connectInSeries(noise, snap, snapLevel, out);
    connectInSeries(noise, wires, wireLevel, out);
  }

  private rim(strike: Strike) {
    const { level } = strike;
    this.tone(strike, 'triangle', RIM.woodFrequency, level * RIM.woodLevel, RIM.attack, RIM.woodDecay);
    this.tone(strike, 'sine', RIM.ringFrequency, level * RIM.ringLevel, RIM.attack, RIM.ringDecay);
    this.noiseClick(strike, RIM.clickBand, RIM.clickQ, level * RIM.clickLevel, RIM.clickDecay);
  }

  private hat(strike: Strike, state: HatState) {
    this.metal(strike, this.hatTone(strike.tuning.hat, state));
  }

  private hatTone(tuning: HatTuning, state: HatState): MetalTone {
    const voicing = { fundamental: tuning.fundamental, bandQ: HAT.bandQ, highpass: HAT.highpass };
    if (state === 'pedal') return { ...voicing, band: HAT.pedalBand, level: HAT.pedalLevel, decay: HAT.pedalDecay };
    const decays: Record<Exclude<HatState, 'pedal'>, number> = { closed: tuning.closedDecay, half: tuning.halfDecay, open: tuning.openDecay };
    return { ...voicing, band: HAT.band, level: HAT.level, decay: decays[state] };
  }

  private ride(strike: Strike) {
    this.metal(strike, { ...RIDE, decay: strike.tuning.cymbal.rideDecay });
  }

  private bell(strike: Strike) {
    this.metal(strike, { ...BELL, decay: strike.tuning.cymbal.rideDecay * BELL_DECAY_RATIO });
  }

  private crash(strike: Strike) {
    const tone = { ...CRASH, decay: strike.tuning.cymbal.crashDecay };
    const metal = this.metal(strike, tone);
    const wash = this.ctx.createGain();
    wash.gain.value = CRASH_WASH_LEVEL;
    const noise = this.noise(strike, endOf(strike.when, METAL_ATTACK, tone.decay));
    connectInSeries(noise, wash, metal);
  }

  private tom(strike: Strike, frequency: number) {
    const body = this.tone(strike, 'sine', frequency, strike.level * TOM.level, TOM.attack, strike.tuning.tom.decay);
    glide(body.frequency, frequency * TOM.pitchBend, frequency, strike.when, TOM.pitchDrop);
    this.noiseClick(strike, TOM.stickBand, TOM.stickQ, strike.level * TOM.stickLevel, TOM.stickDecay);
  }

  private metal(strike: Strike, tone: MetalTone): AudioNode {
    const { when, velocity, level, out } = strike;
    const end = endOf(when, METAL_ATTACK, tone.decay);
    const band = this.filter('bandpass', brightness(tone.band, velocity), tone.bandQ);
    const high = this.filter('highpass', tone.highpass);
    const gain = this.envelope(strike, (level * tone.level) / METAL_RATIOS.length, METAL_ATTACK, tone.decay);
    connectInSeries(band, high, gain, out);
    for (const ratio of METAL_RATIOS) {
      const square = this.oscillator(strike, 'square', tone.fundamental * ratio, end);
      square.detune.value = (this.random() - 0.5) * METAL_DETUNE_CENTS;
      square.connect(band);
    }
    return band;
  }

  private tone(strike: Strike, type: OscillatorType, frequency: number, peak: number, attack: number, decay: number) {
    const oscillator = this.oscillator(strike, type, frequency, endOf(strike.when, attack, decay));
    connectInSeries(oscillator, this.envelope(strike, peak, attack, decay), strike.out);
    return oscillator;
  }

  private noiseClick(strike: Strike, band: ToneRange, q: number, peak: number, decay: number) {
    const noise = this.noise(strike, endOf(strike.when, CLICK_ATTACK, decay));
    const filter = this.filter('bandpass', brightness(band, strike.velocity), q);
    connectInSeries(noise, filter, this.envelope(strike, peak, CLICK_ATTACK, decay), strike.out);
  }

  // Two hits on one grid step, such as a closed and an open hat, both ring, whatever their humanized order
  private release(ringing: Strike | undefined, next: Strike, time: number) {
    if (!ringing || ringing.gridTime === next.gridTime) return;
    if (next.when <= ringing.when || next.when >= ringing.end) return;
    for (const envelope of ringing.envelopes) envelope.gain.setTargetAtTime(0, next.when, time);
    const silent = Math.min(ringing.end, next.when + time * DECAYS_TO_SILENCE);
    for (const source of ringing.sources) source.stop(silent);
  }

  private envelope(strike: Strike, peak: number, attack: number, decay: number) {
    const { when } = strike;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(SILENT, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), when + attack);
    gain.gain.setTargetAtTime(0, when + attack, decay);
    strike.envelopes.push(gain);
    return gain;
  }

  private filter(type: BiquadFilterType, frequency: number, q?: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if (q !== undefined) filter.Q.value = q;
    return filter;
  }

  private oscillator(strike: Strike, type: OscillatorType, frequency: number, end: number) {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.start(strike.when);
    this.finish(strike, oscillator, end);
    return oscillator;
  }

  private noise(strike: Strike, end: number) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoise();
    noise.loop = true;
    noise.start(strike.when, this.random() * NOISE_SECONDS);
    this.finish(strike, noise, end);
    return noise;
  }

  private finish(strike: Strike, source: AudioScheduledSourceNode, end: number) {
    source.stop(end);
    source.onended = () => source.disconnect();
    strike.sources.push(source);
    strike.end = Math.max(strike.end, end);
    // Rescheduling at a bar line cancels by grid time, so a humanized hit is tracked at its grid time
    this.synth.track(source, 'backing', strike.gridTime, end);
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
    this.seed = (this.seed * RANDOM_MULTIPLIER + RANDOM_INCREMENT) >>> 0;
    return this.seed / UINT32_RANGE;
  }
}
