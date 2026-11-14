import type { Drum } from '../core/groove';
import type { Synth } from './synth';

const NOISE_SECONDS = 1;
const RIDE_PARTIALS = [587, 845, 1103, 1517];
const CRASH_PARTIALS = [431, 619, 893, 1277];

const loudness = (velocity: number) => Math.pow(Math.max(0, Math.min(1, velocity)), 1.6);

export class DrumKit {
  private noise: AudioBuffer | null = null;
  private openHat: { gain: GainNode; start: number } | null = null;
  private seed = 1;
  private nominal = 0;

  constructor(private synth: Synth) {}

  play(drum: Drum, when: number, velocity: number, out: AudioNode, offset = 0) {
    const level = loudness(velocity);
    if (level <= 0) return;
    this.nominal = when;
    when = Math.max(this.synth.now, when + offset);
    if (drum === 'kick') this.kick(when, level, out);
    else if (drum === 'snare') this.snare(when, level, out);
    else if (drum === 'hat') { this.choke(when); this.hat(when, level, 0.012, out); }
    else if (drum === 'openhat') { this.choke(when); this.hat(when, level, 0.12, out, true); }
    else if (drum === 'ride') this.cymbal(when, level * 0.32, 0.45, 5200, RIDE_PARTIALS, out);
    else this.cymbal(when, level * 0.55, 0.7, 3800, CRASH_PARTIALS, out);
  }

  private get ctx() { return this.synth.context; }

  private kick(when: number, level: number, out: AudioNode) {
    const ctx = this.ctx, body = ctx.createOscillator(), bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(140 + 40 * level, when);
    body.frequency.exponentialRampToValueAtTime(58, when + 0.045);
    body.frequency.exponentialRampToValueAtTime(44, when + 0.35);
    bodyGain.gain.setValueAtTime(0.0001, when);
    bodyGain.gain.exponentialRampToValueAtTime(level, when + 0.003);
    bodyGain.gain.setTargetAtTime(0, when + 0.06, 0.09);
    body.connect(bodyGain); bodyGain.connect(out);
    this.source(body, when, when + 0.55);

    const click = this.noiseSource(), band = this.filter('bandpass', 3200, 0.9), clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(level * 0.45, when);
    clickGain.gain.setTargetAtTime(0, when, 0.004);
    click.connect(band); band.connect(clickGain); clickGain.connect(out);
    this.source(click, when, when + 0.03);
  }

  private snare(when: number, level: number, out: AudioNode) {
    const ctx = this.ctx, toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(level * 0.42, when);
    toneGain.gain.setTargetAtTime(0, when, 0.035);
    toneGain.connect(out);
    for (const [from, to] of [[205, 180], [340, 330]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(from, when);
      o.frequency.exponentialRampToValueAtTime(to, when + 0.03);
      o.connect(toneGain);
      this.source(o, when, when + 0.2);
    }

    const noise = this.noiseSource(), band = this.filter('bandpass', 4200, 0.6), high = this.filter('highpass', 900), noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.exponentialRampToValueAtTime(level * 0.7, when + 0.001);
    noiseGain.gain.setTargetAtTime(0, when + 0.012, 0.055);
    noise.connect(high); high.connect(band); band.connect(noiseGain); noiseGain.connect(out);
    this.source(noise, when, when + 0.35);
  }

  private hat(when: number, level: number, tau: number, out: AudioNode, open = false) {
    const ctx = this.ctx, noise = this.noiseSource(), high = this.filter('highpass', 7000), band = this.filter('bandpass', 10000, 0.8), gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level * 0.3, when + 0.001);
    gain.gain.setTargetAtTime(0, when + 0.001, tau);
    noise.connect(high); high.connect(band); band.connect(gain); gain.connect(out);
    this.source(noise, when, when + tau * 7);
    if (open) this.openHat = { gain, start: when };
  }

  private choke(when: number) {
    if (!this.openHat || when <= this.openHat.start) return;
    this.openHat.gain.gain.setTargetAtTime(0, when, 0.006);
    this.openHat = null;
  }

  private cymbal(when: number, level: number, tau: number, cutoff: number, partials: number[], out: AudioNode) {
    const ctx = this.ctx, gain = ctx.createGain(), high = this.filter('highpass', cutoff), end = when + tau * 4.5;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.002);
    gain.gain.setTargetAtTime(0, when + 0.002, tau);
    high.connect(gain); gain.connect(out);

    const noise = this.noiseSource(), band = this.filter('bandpass', cutoff * 1.6, 0.5);
    noise.connect(band); band.connect(high);
    this.source(noise, when, end);

    const metal = ctx.createGain();
    metal.gain.value = 0.18;
    metal.connect(high);
    for (const f of partials) {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = f; o.detune.value = (this.random() - 0.5) * 30;
      o.connect(metal);
      this.source(o, when, end);
    }
  }

  private noiseSource() {
    const ctx = this.ctx, source = ctx.createBufferSource();
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
    }
    source.buffer = this.noise;
    source.loop = true;
    return source;
  }

  private filter(type: BiquadFilterType, frequency: number, q?: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = frequency;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  private source(node: AudioScheduledSourceNode, when: number, end: number) {
    if ('buffer' in node) (node as AudioBufferSourceNode).start(when, this.random() * NOISE_SECONDS);
    else node.start(when);
    node.stop(end);
    // Rescheduling at a bar line cancels by grid time, so a humanized hit is tracked at its grid time.
    this.synth.track(node, 'backing', this.nominal, end);
  }

  private random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
