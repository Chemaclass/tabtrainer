import { HAT_DRUMS, type BackingPart } from '../core/groove';
import type { DrumHit, GrooveBar, GrooveTimeline, PitchedHit } from '../core/grooveTimeline';
import { DrumKit } from './drumKit';
import { DRUM_KIT_TUNINGS, type DrummerFeel } from './drumKits';
import { DrumRoom } from './drumRoom';
import { Synth } from './synth';

export interface LoopState { playing: boolean; countingIn: boolean; beat: number | null; bar: number | null; loop: number }
export interface HumanizeLimits { seed: number; time: number; velocity: number }
export interface HitOffset { time: number; velocity: number }
export interface LoopEngineOptions { synth?: Synth; kit?: Pick<DrumKit, 'play' | 'reset'>; humanize?: HumanizeLimits }

interface Segment { time: number; beat: number; spb: number; timeline: GrooveTimeline }

const TICK_MS = 25;
const LOOK_AHEAD = 0.25;
const HIDDEN_LOOK_AHEAD = 1.5;
const START_DELAY = 0.08;
const STOP_FADE = 0.015;
const EPSILON = 1e-6;
const PART_LEVEL: Record<BackingPart, number> = { drums: 0.9, bass: 0.8, keys: 0.45 };
const BASS_VOICE_LEVEL = 0.4;
const KEYS_VOICE_LEVEL = 0.5;
const SOFTEST_DRUM = 0.05;
const PART_GAIN_TIME = 0.01;
const SECONDS_PER_MINUTE = 60;
const LIMITER = { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.12 } as const;
const LOOSEST_FEEL = Math.max(...Object.values(DRUM_KIT_TUNINGS).map(tuning => tuning.feel.looseness));

export const DEFAULT_HUMANIZE: HumanizeLimits = { seed: 1, time: 0.006, velocity: 0.08 };

const UINT32_RANGE = 4294967296;

/** Mixes the seed, loop and hit into one 32 bit state, so each hit of each loop gets its own offsets. */
function hitState(seed: number, loop: number, hit: number): number {
  return (Math.imul(seed, 0x9e3779b1) ^ Math.imul(loop + 1, 0x85ebca6b) ^ Math.imul(hit + 1, 0xc2b2ae35)) >>> 0;
}

/** The mulberry32 generator: repeatable numbers from 0 up to 1. */
function mulberry32(state: number): () => number {
  let x = state;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

const spread = (random: number, limit: number) => (random * 2 - 1) * limit;

export function humanize(limits: HumanizeLimits, loop: number, hit: number): HitOffset {
  const random = mulberry32(hitState(limits.seed, loop, hit));
  const time = spread(random(), limits.time);
  const velocity = spread(random(), limits.velocity);
  return { time, velocity };
}

/** The index of the bar playing at a beat of the loop, or -1 past the last bar; a beat a hair before a bar line counts as the next bar. */
const barIndexAt = (bars: readonly GrooveBar[], beatInLoop: number) => bars.findIndex(bar => beatInLoop < bar.start + bar.length - EPSILON);

export class LoopEngine {
  private synth: Synth;
  private kit: Pick<DrumKit, 'play' | 'reset'>;
  private limits: HumanizeLimits;
  private timeline: GrooveTimeline | null = null;
  private tempo = 90;
  private gains: Record<BackingPart, number> = { drums: 1, bass: 1, keys: 1 };
  private buses: Record<BackingPart, GainNode> | null = null;
  private out: GainNode | null = null;
  private room: DrumRoom | null = null;
  private roomEnabled = true;
  private current: Segment | null = null;
  private next: Segment | null = null;
  private scheduledUntil = 0;
  private timer: number | null = null;
  private countIn = false;
  private countStart = 0;
  private countSpb = 0;
  private countClicks = 0;
  private countEnd = 0;
  private clickVolume = 0.5;
  private listeners: ((state: LoopState) => void)[] = [];

  private onVisibility = () => { if (this.playing) this.tick(); };

  constructor(options: LoopEngineOptions = {}) {
    this.synth = options.synth ?? new Synth();
    this.kit = options.kit ?? new DrumKit(this.synth);
    this.limits = options.humanize ?? DEFAULT_HUMANIZE;
  }

  get playing() { return this.timer !== null; }

  private get secondsPerBeat() { return SECONDS_PER_MINUTE / this.tempo; }

  on(fn: (state: LoopState) => void) { this.listeners.push(fn); }

  play() {
    if (this.playing) this.stop();
    if (!this.timeline || !this.synth.ensure()) return;
    this.connect();
    const start = this.synth.now + START_DELAY;
    const spb = this.secondsPerBeat;
    const clicks = this.countIn ? Math.round(this.timeline.bars[0].length) : 0;
    for (let i = 0; i < clicks; i++) this.synth.click(start + i * spb, i === 0, 'count-in', this.clickVolume);
    const firstBeat = start + clicks * spb;
    this.countStart = start;
    this.countSpb = spb;
    this.countClicks = clicks;
    this.countEnd = clicks ? firstBeat : 0;
    this.out!.gain.cancelScheduledValues(firstBeat - STOP_FADE);
    this.out!.gain.setValueAtTime(1, firstBeat - STOP_FADE);
    this.current = { time: firstBeat, beat: 0, spb, timeline: this.timeline };
    this.next = null;
    this.scheduledUntil = firstBeat;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    this.emit();
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.synth.started && this.out) {
      const now = this.synth.now;
      this.out.gain.setTargetAtTime(0, now, STOP_FADE);
      this.synth.cancel('backing', now + STOP_FADE * 4);
      this.synth.cancel('count-in');
    }
    this.kit.reset();
    this.current = null;
    this.next = null;
    this.emit();
  }

  setTempo(bpm: number) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    this.tempo = bpm;
    this.reschedule();
  }

  setTimeline(timeline: GrooveTimeline) {
    if (timeline.total <= 0 || !timeline.bars.length) return;
    this.timeline = timeline;
    this.reschedule();
  }

  setCountIn(enabled: boolean) { this.countIn = enabled; }

  setClickVolume(volume: number) {
    if (Number.isFinite(volume)) this.clickVolume = Math.max(0, Math.min(1, volume));
  }

  setRoom(enabled: boolean) {
    this.roomEnabled = enabled;
    this.room?.setEnabled(enabled);
  }

  setPartGain(part: BackingPart, gain: number) {
    if (!Number.isFinite(gain)) return;
    this.gains[part] = Math.max(0, gain);
    if (this.buses && this.synth.started) this.buses[part].gain.setTargetAtTime(this.level(part), this.synth.now, PART_GAIN_TIME);
  }

  private level(part: BackingPart) { return PART_LEVEL[part] * this.gains[part]; }

  private connect() {
    if (this.buses) return;
    const ctx = this.synth.context;
    const limiter = this.limiter();
    this.out = ctx.createGain();
    this.out.connect(limiter);
    this.buses = { drums: this.bus('drums'), bass: this.bus('bass'), keys: this.bus('keys') };
    this.room = new DrumRoom(ctx, this.buses.drums, this.out, this.roomEnabled);
  }

  private bus(part: BackingPart): GainNode {
    const bus = this.synth.context.createGain();
    bus.gain.value = this.level(part);
    bus.connect(this.out!);
    return bus;
  }

  private limiter(): AudioNode {
    const limiter = this.synth.context.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.threshold;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attack;
    limiter.release.value = LIMITER.release;
    limiter.connect(this.synth.output);
    return limiter;
  }

  private reschedule() {
    if (!this.playing || !this.current || !this.timeline) return;
    const now = this.synth.now;
    this.advanceToNext(now);
    const base = this.current;
    if (now < base.time) {
      this.restartBeforeFirstBeat(base, this.timeline, now);
      return;
    }
    // A humanized hit can sound this much before its beat, so the change skips a bar line that close
    const earliestHeard = now + this.limits.time * LOOSEST_FEEL + EPSILON;
    const at = this.nextBarLine(base, this.beatAt(base, earliestHeard));
    const time = this.timeAt(base, at);
    this.next = { time, beat: this.mapBeat(base, at, this.timeline), spb: this.secondsPerBeat, timeline: this.timeline };
    this.synth.cancelFuture('backing', time - EPSILON);
    this.scheduledUntil = Math.min(this.scheduledUntil, time);
  }

  /** Nothing has played yet, so the new tempo or timeline replaces the current segment outright. */
  private restartBeforeFirstBeat(base: Segment, timeline: GrooveTimeline, now: number) {
    this.synth.cancelFuture('backing', now);
    const counting = now < this.countEnd;
    if (counting) this.recount(now);
    const time = counting ? this.countEnd : base.time;
    this.current = { time, beat: this.mapBeat(base, base.beat, timeline), spb: this.secondsPerBeat, timeline };
    this.next = null;
    this.scheduledUntil = time;
  }

  private advanceToNext(now: number) {
    if (!this.next || now < this.next.time) return;
    this.current = this.next;
    this.next = null;
  }

  private recount(now: number) {
    const next = Math.ceil((now - this.countStart) / this.countSpb - EPSILON);
    if (next >= this.countClicks) return;
    const at = this.countStart + next * this.countSpb;
    const spb = this.secondsPerBeat;
    this.synth.cancelFuture('count-in', now);
    for (let i = next; i < this.countClicks; i++) this.synth.click(at + (i - next) * spb, i === 0, 'count-in', this.clickVolume);
    this.countStart = at - next * spb;
    this.countSpb = spb;
    this.countEnd = at + (this.countClicks - next) * spb;
  }

  private beatAt(seg: Segment, time: number) { return seg.beat + (time - seg.time) / seg.spb; }
  private timeAt(seg: Segment, beat: number) { return seg.time + (beat - seg.beat) * seg.spb; }

  private nextBarLine(seg: Segment, beat: number) {
    const { total, bars } = seg.timeline;
    const loop = Math.floor(beat / total);
    const inLoop = beat - loop * total;
    const bar = bars.find(b => b.start > inLoop + EPSILON);
    return bar ? loop * total + bar.start : (loop + 1) * total;
  }

  /** The start of the matching bar in the new timeline, so a change of groove keeps the place in the form. */
  private mapBeat(seg: Segment, beat: number, timeline: GrooveTimeline) {
    const { total, bars } = seg.timeline;
    const loop = Math.floor(beat / total + EPSILON);
    const inLoop = beat - loop * total;
    const index = Math.max(0, barIndexAt(bars, inLoop));
    return loop * timeline.total + timeline.bars[index % timeline.bars.length].start;
  }

  private lookAhead() { return typeof document !== 'undefined' && document.hidden ? HIDDEN_LOOK_AHEAD : LOOK_AHEAD; }

  private tick() {
    const now = this.synth.now;
    const end = now + this.lookAhead();
    this.synth.forget(now);
    this.advanceToNext(now);
    const from = Math.max(now, this.scheduledUntil);
    if (this.current && from < end) {
      if (this.next && this.next.time < end) {
        this.schedule(this.current, from, Math.max(from, this.next.time));
        this.schedule(this.next, Math.max(from, this.next.time), end);
      } else this.schedule(this.current, from, end);
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, end);
    this.emit();
  }

  private schedule(seg: Segment, from: number, to: number) {
    if (to <= from) return;
    const { total, drums, bass, keys, voice } = seg.timeline;
    const first = Math.floor(this.beatAt(seg, from) / total);
    const last = Math.floor(this.beatAt(seg, to) / total);
    const limits = { ...this.limits, time: this.limits.time * this.feel(seg).looseness };
    const inWindow = (when: number) => when >= from && when < to;
    for (let loop = Math.max(0, first); loop <= last; loop++) {
      const timeOf = (hit: DrumHit | PitchedHit) => this.timeAt(seg, loop * total + hit.beat);
      drums.forEach((hit, i) => {
        const when = timeOf(hit);
        if (inWindow(when)) this.playDrum(seg, hit, when, humanize(limits, loop, i));
      });
      for (const hit of bass) {
        const when = timeOf(hit);
        if (inWindow(when)) this.synth.voice(when, hit.midi[0], hit.length * seg.spb, hit.velocity * BASS_VOICE_LEVEL, this.buses!.bass, 'backing');
      }
      for (const hit of keys) {
        const when = timeOf(hit);
        if (inWindow(when)) this.synth[voice](when, hit.midi, hit.length * seg.spb, hit.velocity * KEYS_VOICE_LEVEL, this.buses!.keys);
      }
    }
  }

  private playDrum(seg: Segment, hit: DrumHit, when: number, offset: HitOffset) {
    const velocity = Math.max(SOFTEST_DRUM, Math.min(1, hit.velocity * (1 + offset.velocity)));
    const drift = this.isPinned(seg, hit) ? 0 : offset.time;
    const lag = HAT_DRUMS.includes(hit.drum) ? this.feel(seg).hatLagSeconds : 0;
    this.kit.play(hit.drum, when, velocity, this.buses!.drums, drift + lag, seg.timeline.kit);
  }

  private feel(seg: Segment): DrummerFeel {
    return DRUM_KIT_TUNINGS[seg.timeline.kit].feel;
  }

  private isPinned(seg: Segment, hit: DrumHit) {
    return hit.drum === 'kick' && Math.abs(hit.beat - seg.timeline.bars[hit.bar].start) < EPSILON;
  }

  private emit() {
    const state = this.state();
    this.listeners.forEach(fn => fn(state));
  }

  /** What the listener hears now, which lags what is scheduled by the output latency. */
  private state(): LoopState {
    const noBeat: LoopState = { playing: this.playing, countingIn: false, beat: null, bar: null, loop: 0 };
    if (!this.playing) return noBeat;
    const heardNow = this.synth.now - this.synth.latency;
    if (heardNow < this.countEnd) return { ...noBeat, countingIn: true };
    const seg = this.current && this.next && this.synth.now >= this.next.time ? this.next : this.current;
    if (!seg) return noBeat;
    const heard = Math.max(seg.time, heardNow);
    const beat = Math.max(0, this.beatAt(seg, heard));
    const { total, bars } = seg.timeline;
    const loop = Math.floor(beat / total + EPSILON);
    const inLoop = Math.max(0, beat - loop * total);
    const bar = bars[barIndexAt(bars, inLoop)] ?? bars[bars.length - 1];
    return { playing: true, countingIn: false, beat: inLoop, bar: bar.bar, loop };
  }
}
