import type { GrooveTimeline } from '../core/grooveTimeline';
import { DrumKit } from './drumKit';
import { Synth } from './synth';

export type BackingPart = 'drums' | 'keys';
export interface LoopState { playing: boolean; beat: number | null; bar: number | null; loop: number }
export interface HumanizeLimits { seed: number; time: number; velocity: number }
export interface HitOffset { time: number; velocity: number }
export interface LoopEngineOptions { synth?: Synth; kit?: Pick<DrumKit, 'play'>; humanize?: HumanizeLimits }

interface Segment { time: number; beat: number; spb: number; timeline: GrooveTimeline }

const TICK_MS = 25;
const LOOK_AHEAD = 0.25;
const HIDDEN_LOOK_AHEAD = 1.5;
const START_DELAY = 0.08;
const STOP_FADE = 0.015;
const EPSILON = 1e-6;
const PART_LEVEL: Record<BackingPart, number> = { drums: 0.9, keys: 0.45 };

export const DEFAULT_HUMANIZE: HumanizeLimits = { seed: 1, time: 0.006, velocity: 0.08 };

export function humanize(limits: HumanizeLimits, loop: number, hit: number): HitOffset {
  let x = (Math.imul(limits.seed, 0x9e3779b1) ^ Math.imul(loop + 1, 0x85ebca6b) ^ Math.imul(hit + 1, 0xc2b2ae35)) >>> 0;
  const next = () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { time: (next() * 2 - 1) * limits.time, velocity: (next() * 2 - 1) * limits.velocity };
}

export class LoopEngine {
  private synth: Synth;
  private kit: Pick<DrumKit, 'play'>;
  private limits: HumanizeLimits;
  private timeline: GrooveTimeline | null = null;
  private tempo = 90;
  private gains: Record<BackingPart, number> = { drums: 1, keys: 1 };
  private buses: Record<BackingPart, GainNode> | null = null;
  private out: GainNode | null = null;
  private current: Segment | null = null;
  private next: Segment | null = null;
  private scheduledUntil = 0;
  private timer: number | null = null;
  private listeners: ((state: LoopState) => void)[] = [];

  private onVisibility = () => { if (this.playing) this.tick(); };

  constructor(options: LoopEngineOptions = {}) {
    this.synth = options.synth ?? new Synth();
    this.kit = options.kit ?? new DrumKit(this.synth);
    this.limits = options.humanize ?? DEFAULT_HUMANIZE;
  }

  get playing() { return this.timer !== null; }

  on(fn: (state: LoopState) => void) { this.listeners.push(fn); }

  play() {
    if (this.playing) this.stop();
    if (!this.timeline || !this.synth.ensure()) return;
    this.connect();
    const t0 = this.synth.now + START_DELAY;
    this.out!.gain.cancelScheduledValues(t0 - STOP_FADE);
    this.out!.gain.setValueAtTime(1, t0 - STOP_FADE);
    this.current = { time: t0, beat: 0, spb: 60 / this.tempo, timeline: this.timeline };
    this.next = null;
    this.scheduledUntil = t0;
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
    }
    this.current = null; this.next = null;
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

  setPartGain(part: BackingPart, gain: number) {
    if (!Number.isFinite(gain)) return;
    this.gains[part] = Math.max(0, gain);
    if (this.buses && this.synth.started) this.buses[part].gain.setTargetAtTime(this.level(part), this.synth.now, 0.01);
  }

  private level(part: BackingPart) { return PART_LEVEL[part] * this.gains[part]; }

  private connect() {
    if (this.buses) return;
    const ctx = this.synth.context;
    this.out = ctx.createGain(); this.out.connect(this.synth.output);
    const bus = (part: BackingPart) => { const g = ctx.createGain(); g.gain.value = this.level(part); g.connect(this.out!); return g; };
    this.buses = { drums: bus('drums'), keys: bus('keys') };
  }

  private reschedule() {
    if (!this.playing || !this.current || !this.timeline) return;
    const now = this.synth.now;
    if (this.next && now >= this.next.time) { this.current = this.next; this.next = null; }
    const base = this.current;
    if (now < base.time) {
      this.synth.cancelFuture('backing', now);
      this.current = { time: base.time, beat: this.mapBeat(base, base.beat, this.timeline), spb: 60 / this.tempo, timeline: this.timeline };
      this.next = null;
      this.scheduledUntil = base.time;
      return;
    }
    const at = this.nextBarLine(base, this.beatAt(base, now + this.limits.time + EPSILON));
    const time = this.timeAt(base, at);
    this.next = { time, beat: this.mapBeat(base, at, this.timeline), spb: 60 / this.tempo, timeline: this.timeline };
    this.synth.cancelFuture('backing', time - EPSILON);
    this.scheduledUntil = Math.min(this.scheduledUntil, time);
  }

  private beatAt(seg: Segment, time: number) { return seg.beat + (time - seg.time) / seg.spb; }
  private timeAt(seg: Segment, beat: number) { return seg.time + (beat - seg.beat) * seg.spb; }

  private nextBarLine(seg: Segment, beat: number) {
    const { total, bars } = seg.timeline, loop = Math.floor(beat / total);
    const inLoop = beat - loop * total;
    const bar = bars.find(b => b.start > inLoop + EPSILON);
    return bar ? loop * total + bar.start : (loop + 1) * total;
  }

  private mapBeat(seg: Segment, beat: number, timeline: GrooveTimeline) {
    const { total, bars } = seg.timeline, loop = Math.floor(beat / total + EPSILON);
    const inLoop = beat - loop * total;
    const index = Math.max(0, bars.findIndex(b => inLoop < b.start + b.length - EPSILON));
    return loop * timeline.total + timeline.bars[index % timeline.bars.length].start;
  }

  private lookAhead() { return typeof document !== 'undefined' && document.hidden ? HIDDEN_LOOK_AHEAD : LOOK_AHEAD; }

  private tick() {
    const now = this.synth.now, end = now + this.lookAhead();
    this.synth.forget(now);
    if (this.next && now >= this.next.time) { this.current = this.next; this.next = null; }
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
    const { total, drums, keys } = seg.timeline;
    const first = Math.floor(this.beatAt(seg, from) / total), last = Math.floor(this.beatAt(seg, to) / total);
    for (let loop = Math.max(0, first); loop <= last; loop++) {
      if (this.gains.drums > 0) drums.forEach((hit, i) => {
        const when = this.timeAt(seg, loop * total + hit.beat);
        if (when < from || when >= to) return;
        const offset = humanize(this.limits, loop, i);
        const pinned = hit.drum === 'kick' && Math.abs(hit.beat - seg.timeline.bars[hit.bar].start) < EPSILON;
        const velocity = Math.max(0.05, Math.min(1, hit.velocity * (1 + offset.velocity)));
        this.kit.play(hit.drum, when, velocity, this.buses!.drums, pinned ? 0 : offset.time);
      });
      if (this.gains.keys > 0) for (const hit of keys) {
        const when = this.timeAt(seg, loop * total + hit.beat);
        if (when >= from && when < to) this.synth.keys(when, hit.midi, hit.length * seg.spb, hit.velocity * 0.5, this.buses!.keys);
      }
    }
  }

  private emit() {
    const seg = this.current && this.next && this.synth.now >= this.next.time ? this.next : this.current;
    let state: LoopState = { playing: this.playing, beat: null, bar: null, loop: 0 };
    if (seg && this.playing) {
      const heard = Math.max(seg.time, this.synth.now - this.synth.latency);
      const beat = Math.max(0, this.beatAt(seg, heard)), { total, bars } = seg.timeline;
      const loop = Math.floor(beat / total + EPSILON), inLoop = Math.max(0, beat - loop * total);
      const bar = bars.find(b => inLoop < b.start + b.length - EPSILON) ?? bars[bars.length - 1];
      state = { playing: true, beat: inLoop, bar: bar.bar, loop };
    }
    this.listeners.forEach(fn => fn(state));
  }
}
