import type { TimedNote, BarSpan } from '../core/timeline';
import { Synth } from './synth';
import { PracticePasses } from './practicePasses';
import { isSpeedPracticeConfig, type SpeedPracticeConfig, type SpeedPracticeProgress } from '../core/speedPractice';

export interface SpeedPracticeState { enabled: boolean; active: boolean; startingSpeed: number | null; speed: number; completed: number; repetitions: number; target: number; reached: boolean }
export type SpeedPracticeReason = 'enabled' | 'progress' | 'increase' | 'target' | 'reset' | 'ended';
export interface LoopCompletion { time: number; traversal: number; full: boolean }

export type PlayerPhase = 'stopped' | 'counting-in' | 'playing' | 'paused';
export interface PlayerState { playing: boolean; beat: number | null; phase: PlayerPhase; countInRemaining: number | null }
type Listener = (s: PlayerState) => void;

export class Player {
  private practice: SpeedPracticeConfig | null = null;
  private baseline: number | null = null;
  private progress: SpeedPracticeProgress = { speed: 100, completed: 0 };
  private practiceActive = false;
  private practiceListeners: ((state: SpeedPracticeState, reason: SpeedPracticeReason) => void)[] = [];
  private loopListeners: ((event: LoopCompletion) => void)[] = [];
  private passes = new PracticePasses();
  private resumeEligible = false;
  private synth = new Synth();
  private timer: number | null = null;
  private t0 = 0; private from = 0; private to = 0;
  private paused: number | null = null;
  private resumeMusic = false;
  private listeners: Listener[] = [];
  private scheduledUntil = 0; private clickScheduledUntil = 0;
  private countStart = 0; private countEnd = 0; private countBeats = 0; private countStep = 1;
  private state: PlayerPhase = 'stopped';
  notes: TimedNote[] = []; bars: BarSpan[] = []; total = 0;
  tempo = 90; speed = 1; loop = false; range: [number, number] | null = null;
  metronome = false; countIn = false; clickVolume = 0.5;
  mute = new Set<number>();

  load(tl: { notes: TimedNote[]; bars: BarSpan[]; total: number }, tempo: number) {
    this.endPractice(); this.stop(); this.notes = tl.notes; this.bars = tl.bars; this.total = tl.total; this.tempo = tempo;
  }
  get speedPracticeState(): SpeedPracticeState {
    return { enabled: this.practice !== null, active: this.practiceActive, startingSpeed: this.baseline, speed: Math.round(this.speed * 100), completed: this.progress.completed, repetitions: this.practice?.repetitions ?? 0, target: this.practice?.target ?? 0, reached: this.practice !== null && Math.round(this.speed * 100) >= this.practice.target };
  }
  onSpeedPractice(fn: (state: SpeedPracticeState, reason: SpeedPracticeReason) => void) { this.practiceListeners.push(fn); }
  onLoopComplete(fn: (event: LoopCompletion) => void) { this.loopListeners.push(fn); }
  private emitPractice(reason: SpeedPracticeReason) { const state = this.speedPracticeState; this.practiceListeners.forEach(fn => fn(state, reason)); }
  setSpeedPractice(config: SpeedPracticeConfig | null): boolean {
    this.reconcile();
    if (config === null) { this.endPractice(); return true; }
    if (!isSpeedPracticeConfig(config) || !this.loop || config.target < Math.round(this.speed * 100)) return false;
    if (this.practice) this.endPractice();
    this.practice = { ...config }; this.baseline = Math.round(this.speed * 100); this.progress = { speed: this.baseline, completed: 0 };
    this.practiceActive = this.playing;
    this.resumeEligible = this.paused !== null && Math.abs(this.paused - this.passageStart()) < 1e-6;
    if (this.playing && this.synth.started) {
      this.rebuildPractice(this.synth.now <= this.t0 && Math.abs(this.from - this.passageStart()) < 1e-6);
    }
    this.emitPractice('enabled'); return true;
  }
  private endPractice() {
    if (!this.practice) return;
    this.reconcile();
    const beat = this.playing && this.synth.started ? this.position(this.synth.now) : null;
    this.resumeEligible = false;
    this.practice = null; this.baseline = null; this.practiceActive = false; this.progress = { speed: Math.round(this.speed * 100), completed: 0 }; this.passes.clear();
    if (beat !== null && this.synth.started && this.state === 'playing') {
      this.synth.cancelFuture(); this.from = beat; this.t0 = Math.max(this.synth.now, this.t0); this.rescheduleFrom(this.synth.now);
    } else if (this.playing && this.synth.started) { this.synth.cancelFuture(); this.rescheduleFrom(this.synth.now); }
    this.emitPractice('ended');
  }
  on(fn: Listener) { this.listeners.push(fn); }
  private emit(beat: number | null) { const s = { playing: this.playing, beat, phase: this.phase, countInRemaining: this.countInRemaining }; this.listeners.forEach(f => f(s)); }
  get playing() { return this.state === 'playing' || this.state === 'counting-in'; }
  get phase() { return this.state; }
  get countInRemaining() {
    if (this.state !== 'counting-in' || !this.synth.started) return null;
    return Math.max(1, Math.min(this.countBeats, Math.ceil((this.countEnd - Math.max(this.synth.now, this.countStart)) / (this.countStep * this.spb()))));
  }
  get canResume() { return this.resumeMusic && this.state === 'paused'; }
  get pausedAt() { return this.paused; }
  private passageStart() { return (this.range ?? [0, this.total])[0]; }
  private spb() { return 60 / (this.tempo * this.speed); }
  private rescheduleFrom(time: number) { this.scheduledUntil = time + 1e-6; this.clickScheduledUntil = this.scheduledUntil; }
  private barFor(beat: number) { return this.bars.find(b => beat >= b.start - 1e-6 && beat < b.start + b.length - 1e-6) ?? this.bars[0]; }
  play(fromBeat?: number) {
    if (this.playing) this.halt();
    if (!this.synth.ensure()) return;
    const [a, z] = this.range ?? [0, this.total];
    const resume = fromBeat === undefined && this.canResume;
    const start = fromBeat ?? this.paused ?? a;
    this.from = start; this.to = start >= z ? this.total : z;
    this.paused = null; this.resumeMusic = false;
    const now = this.synth.now;
    const bar = this.barFor(start);
    if (!resume && this.countIn && bar) {
      this.countBeats = bar.beats; this.countStep = 4 / bar.beatValue;
      this.countStart = now + 0.08; this.countEnd = this.countStart + this.countBeats * this.countStep * this.spb();
      this.t0 = this.countEnd; this.state = 'counting-in';
    } else { this.t0 = now + 0.08; this.state = 'playing'; }
    if (this.practice) {
      this.practiceActive = true;
      this.makeFirstPass(this.t0, start, resume ? this.resumeEligible : Math.abs(start - this.passageStart()) < 1e-6);
    }
    this.scheduledUntil = now; this.clickScheduledUntil = now;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.emit(start);
  }
  private makeFirstPass(start: number, from: number, eligible: boolean) {
    this.passes.begin({ start, end: start + (this.to - from) * this.spb(), from, speed: this.speed, eligible, progress: { ...this.progress } });
  }
  private rebuildPractice(eligible: boolean) {
    if (!this.synth.started) return;
    const now = this.synth.now, beat = this.position(now);
    this.synth.cancelFuture();
    if (this.state === 'counting-in') this.makeFirstPass(this.t0, this.from, eligible);
    else this.makeFirstPass(Math.max(now, this.t0), beat, eligible);
    this.rescheduleFrom(now);
  }
  private extendPasses(until: number) {
    if (this.practice) this.passes.extend(until, { from: this.passageStart(), to: this.to, tempo: this.tempo }, this.practice);
  }
  private reconcile() {
    if (!this.practice || !this.synth.started || !this.playing || this.passes.isEmpty) return;
    const now = this.synth.now; this.extendPasses(now);
    for (const { finished, next } of this.passes.finish(now)) {
      const previous = this.progress;
      this.progress = next.progress; this.speed = next.speed;
      this.loopListeners.forEach(fn => fn({ time: finished.end, traversal: finished.id, full: finished.eligible }));
      if (finished.eligible && (previous.completed !== this.progress.completed || previous.speed !== this.progress.speed)) {
        this.emitPractice(previous.speed !== this.progress.speed ? (this.progress.speed >= this.practice.target ? 'target' : 'increase') : 'progress');
      }
    }
  }
  private position(now: number) {
    if (this.practice && !this.passes.isEmpty) {
      this.extendPasses(now);
      const pass = this.passes.at(now)!;
      return Math.min(this.to, pass.from + Math.max(0, now - pass.start) * this.tempo * pass.speed / 60);
    }
    const elapsed = Math.max(0, (now - this.t0) / this.spb());
    const firstLength = this.to - this.from;
    if (!this.loop || elapsed < firstLength) return Math.min(this.to, this.from + elapsed);
    const a = this.passageStart(), length = this.to - a;
    return length > 0 ? a + (elapsed - firstLength) % length : this.to;
  }
  private schedulePass(passStart: number, passFrom: number, spb: number, musicFrom: number, clickFrom: number, end: number) {
    for (const n of this.notes) {
      if (n.beat < passFrom - 1e-6 || n.beat >= this.to - 1e-6) continue;
      const when = passStart + (n.beat - passFrom) * spb;
      if (when >= musicFrom && when < end && !this.mute.has(n.string)) this.synth.voice(when, n.midi, Math.max(0.15, n.ring * spb), n.soft ? 0.14 : 0.28);
    }
    if (!this.metronome) return;
    for (const b of this.bars) for (let i = 0; i < b.beats; i++) {
      const beat = b.start + i * 4 / b.beatValue;
      if (beat < passFrom - 1e-6 || beat >= this.to - 1e-6) continue;
      const when = passStart + (beat - passFrom) * spb;
      if (when >= clickFrom && when < end) this.synth.click(when, i === 0, 'metronome', this.clickVolume);
    }
  }
  private scheduleMusic(start: number, clickStart: number, end: number) {
    if (this.practice && !this.passes.isEmpty) { this.schedulePracticeMusic(start, clickStart, end); return; }
    const spb = this.spb(), a = this.passageStart();
    let passStart = this.t0, passFrom = this.from;
    const firstEnd = this.t0 + (this.to - this.from) * spb;
    const loopDuration = (this.to - a) * spb;
    const windowStart = Math.min(start, clickStart);
    if (this.loop && loopDuration > 0 && windowStart >= firstEnd) {
      passFrom = a;
      passStart = firstEnd + Math.floor((windowStart - firstEnd) / loopDuration) * loopDuration;
    }
    while (passStart < end && this.to > passFrom) {
      const passEnd = passStart + (this.to - passFrom) * spb;
      if (passEnd > Math.min(start, clickStart)) this.schedulePass(passStart, passFrom, spb, start, clickStart, end);
      if (!this.loop || this.to <= a) break;
      passStart = passEnd; passFrom = a;
    }
  }
  private schedulePracticeMusic(start: number, clickStart: number, end: number) {
    this.extendPasses(end);
    for (const pass of this.passes.overlapping(Math.min(start, clickStart), end)) {
      this.schedulePass(pass.start, pass.from, 60 / (this.tempo * pass.speed), start, clickStart, end);
    }
  }
  private tick() {
    const now = this.synth.now, end = now + 0.25;
    this.reconcile();
    this.synth.forget(now);
    if (this.state === 'counting-in') {
      for (let i = 0; i < this.countBeats; i++) {
        const when = this.countStart + i * this.countStep * this.spb();
        if (when >= Math.max(now, this.scheduledUntil) && when < end) this.synth.click(when, i === 0, 'count-in', this.clickVolume);
      }
      if (now >= this.countEnd) this.state = 'playing';
    }
    this.scheduleMusic(Math.max(now, this.scheduledUntil, this.t0), Math.max(now, this.clickScheduledUntil, this.t0), end);
    this.scheduledUntil = end; this.clickScheduledUntil = end;
    if (this.state === 'counting-in') { this.emit(this.from); return; }
    if (!this.loop && now >= this.t0 + (this.to - this.from) * this.spb()) { this.stop(); return; }
    this.emit(this.position(Math.max(this.t0, now - this.synth.latency)));
  }
  private halt() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null; this.synth.cancel();
    this.synth.silence();
  }
  private restart(beat: number) {
    this.halt(); this.state = 'paused'; this.paused = beat; this.resumeMusic = true; this.play();
  }
  setRange(range: [number, number] | null, loop: boolean) {
    this.reconcile();
    const old = this.range ?? [0, this.total], next = range ?? [0, this.total];
    if (this.loop !== loop || old[0] !== next[0] || old[1] !== next[1]) this.endPractice();
    else if (this.practice) return;
    const beat = this.playing && this.synth.started ? this.position(this.synth.now) : this.paused;
    this.range = range; this.loop = loop;
    const [a, z] = range ?? [0, this.total]; this.to = z;
    if (this.state === 'counting-in' && this.synth.started) {
      if (this.from < a || this.from >= z) {
        this.halt(); this.state = 'paused'; this.paused = a; this.resumeMusic = false; this.emit(a);
      } else {
        this.synth.cancelFuture();
        this.rescheduleFrom(this.synth.now);
      }
    } else if (this.state === 'playing' && this.synth.started) {
      if (beat === null || beat < a || beat >= z) this.restart(a);
      else {
        const now = this.synth.now;
        this.synth.cancelFuture(); this.from = beat; this.t0 = Math.max(now, this.t0);
        this.rescheduleFrom(now);
      }
    }
  }
  noteAtKey(key: string): TimedNote | undefined {
    return this.notes.find(note => note.key === key && Number.isFinite(note.beat) && note.beat >= 0 && note.beat < this.total && this.bars.some(bar => bar.bar === note.bar && note.beat >= bar.start && note.beat < bar.start + bar.length));
  }
  seekNote(key: string): boolean {
    const note = this.noteAtKey(key);
    if (!note) return false;
    this.setPosition(note.beat); return true;
  }
  private setPosition(target: number) {
    this.endPractice();
    if (this.state === 'playing') this.restart(target);
    else { if (this.playing) this.halt(); this.state = 'paused'; this.resumeMusic = false; this.paused = target; this.emit(target); }
  }
  seek(beat: number) {
    if (!Number.isFinite(beat) || !this.bars.length) return;
    const target = Math.max(0, Math.min(this.bars[this.bars.length - 1].start, beat));
    this.setPosition(target);
  }
  pause() {
    if (!this.playing || !this.synth.started) return;
    this.reconcile();
    this.resumeEligible = this.passes.current?.eligible ?? false;
    const counting = this.state === 'counting-in';
    const wrapped = this.loop && this.synth.now >= this.t0 + (this.to - this.from) * this.spb();
    const passStart = this.practice && this.passes.current ? this.passes.current.from : wrapped ? this.passageStart() : this.from;
    this.paused = counting ? this.from : Math.max(passStart, this.position(this.synth.now) - 0.05);
    this.halt(); this.state = 'paused'; this.resumeMusic = !counting; this.emit(this.paused);
  }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  stop() { this.reconcile(); this.halt(); this.state = 'stopped'; this.paused = null; this.resumeMusic = false; this.passes.clear(); if (this.practice && this.baseline !== null) { this.speed = this.baseline / 100; this.progress = { speed: this.baseline, completed: 0 }; this.practiceActive = false; this.emitPractice('reset'); } this.emit(null); }
  setSpeed(s: number) {
    this.endPractice();
    const now = this.synth.now, beat = this.state === 'playing' ? this.position(now) : null;
    if (this.state === 'counting-in') {
      const oldSpb = this.spb(), elapsed = Math.max(0, (now - this.countStart) / oldSpb), lead = Math.max(0, this.countStart - now);
      this.synth.cancel(); this.speed = s; this.countStart = now + lead - elapsed * this.spb(); this.countEnd = this.countStart + this.countBeats * this.countStep * this.spb(); this.t0 = this.countEnd; this.rescheduleFrom(now); return;
    }
    this.speed = s; if (beat !== null) this.restart(beat);
  }
  setMetronome(enabled: boolean) { this.metronome = enabled; if (!enabled) this.synth.cancel('metronome'); else if (this.playing && this.synth.started) this.clickScheduledUntil = this.synth.now + 1e-6; }
  setCountIn(enabled: boolean) { this.countIn = enabled; }
  setClickVolume(volume: number) { if (Number.isFinite(volume)) this.clickVolume = Math.max(0, Math.min(1, volume)); }
  barAt(beat: number): number | null { const b = this.bars.find(x => beat >= x.start - 1e-6 && beat < x.start + x.length); return b ? b.bar : null; }
  barRange(first: number, last: number): [number, number] {
    const a = this.bars.find(b => b.bar === first) ?? this.bars[0]; const z = this.bars.find(b => b.bar === last) ?? this.bars[this.bars.length - 1];
    return [a.start, z.start + z.length];
  }
}
