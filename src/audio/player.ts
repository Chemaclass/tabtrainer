import type { TimedNote, BarSpan } from '../core/timeline';

export type PlayerPhase = 'stopped' | 'counting-in' | 'playing' | 'paused';
export interface PlayerState { playing: boolean; beat: number | null; phase: PlayerPhase; countInRemaining: number | null }
type Listener = (s: PlayerState) => void;
type SourceKind = 'instrument' | 'count-in' | 'metronome';
type Scheduled = { node: OscillatorNode; kind: SourceKind; start: number; end: number };

export class Player {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private t0 = 0; private from = 0; private to = 0;
  private paused: number | null = null;
  private resumeMusic = false;
  private listeners: Listener[] = [];
  private sources: Scheduled[] = [];
  private scheduledUntil = 0; private clickScheduledUntil = 0;
  private countStart = 0; private countEnd = 0; private countBeats = 0; private countStep = 1;
  private state: PlayerPhase = 'stopped';
  notes: TimedNote[] = []; bars: BarSpan[] = []; total = 0;
  tempo = 90; speed = 1; loop = false; range: [number, number] | null = null;
  metronome = false; countIn = false; clickVolume = 0.5;
  mute = new Set<number>();

  load(tl: { notes: TimedNote[]; bars: BarSpan[]; total: number }, tempo: number) {
    this.stop(); this.notes = tl.notes; this.bars = tl.bars; this.total = tl.total; this.tempo = tempo;
  }
  on(fn: Listener) { this.listeners.push(fn); }
  private emit(beat: number | null) { const s = { playing: this.playing, beat, phase: this.phase, countInRemaining: this.countInRemaining }; this.listeners.forEach(f => f(s)); }
  get playing() { return this.state === 'playing' || this.state === 'counting-in'; }
  get phase() { return this.state; }
  get countInRemaining() {
    if (this.state !== 'counting-in' || !this.ctx) return null;
    return Math.max(1, Math.min(this.countBeats, Math.ceil((this.countEnd - Math.max(this.ctx.currentTime, this.countStart)) / (this.countStep * this.spb()))));
  }
  get canResume() { return this.resumeMusic && this.state === 'paused'; }
  get pausedAt() { return this.paused; }
  private spb() { return 60 / (this.tempo * this.speed); }
  private remember(node: OscillatorNode, kind: SourceKind, start: number, end: number) { this.sources.push({ node, kind, start, end }); }
  private cancel(kind?: SourceKind) {
    const now = this.ctx?.currentTime ?? 0;
    this.sources = this.sources.filter(s => {
      if (kind && s.kind !== kind) return s.end > now;
      try { s.node.stop(now); } catch { /* The source has already ended. */ }
      return false;
    });
  }
  private cancelFuture() {
    const now = this.ctx?.currentTime ?? 0;
    this.sources = this.sources.filter(s => {
      if (s.start <= now) return s.end > now;
      try { s.node.stop(now); } catch { /* The source has already ended. */ }
      return false;
    });
  }
  private voice(when: number, midi: number, dur: number, vel: number) {
    const ctx = this.ctx!, f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 10), when); lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 2), when + 0.4);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    g2.gain.value = 0.6; o.connect(lp); o2.connect(g2); g2.connect(g); lp.connect(g); g.connect(this.master!);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
    this.remember(o, 'instrument', when, when + dur + 0.05); this.remember(o2, 'instrument', when, when + dur + 0.05);
  }
  private click(when: number, accent: boolean, kind: 'count-in' | 'metronome') {
    if (this.clickVolume === 0) return;
    const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1200 : 800;
    g.gain.setValueAtTime(Math.max(0.0001, this.clickVolume * (accent ? 0.5 : 0.3)), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    o.connect(g); g.connect(this.master!); o.start(when); o.stop(when + 0.04); this.remember(o, kind, when, when + 0.04);
  }
  private ensure(): boolean {
    try { this.ctx = this.ctx ?? new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return false; }
    void this.ctx.resume();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    return true;
  }
  private barFor(beat: number) { return this.bars.find(b => beat >= b.start - 1e-6 && beat < b.start + b.length - 1e-6) ?? this.bars[0]; }
  play(fromBeat?: number) {
    if (this.playing) this.halt();
    if (!this.ensure()) return;
    const [a, z] = this.range ?? [0, this.total];
    const resume = fromBeat === undefined && this.canResume;
    const start = fromBeat ?? this.paused ?? a;
    this.from = start; this.to = start >= z ? this.total : z;
    this.paused = null; this.resumeMusic = false;
    const now = this.ctx!.currentTime;
    const bar = this.barFor(start);
    if (!resume && this.countIn && bar) {
      this.countBeats = bar.beats; this.countStep = 4 / bar.beatValue;
      this.countStart = now + 0.08; this.countEnd = this.countStart + this.countBeats * this.countStep * this.spb();
      this.t0 = this.countEnd; this.state = 'counting-in';
    } else { this.t0 = now + 0.08; this.state = 'playing'; }
    this.scheduledUntil = now; this.clickScheduledUntil = now;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.emit(start);
  }
  private position(now: number) {
    const elapsed = Math.max(0, (now - this.t0) / this.spb());
    const firstLength = this.to - this.from;
    if (!this.loop || elapsed < firstLength) return Math.min(this.to, this.from + elapsed);
    const a = (this.range ?? [0, this.total])[0], length = this.to - a;
    return length > 0 ? a + (elapsed - firstLength) % length : this.to;
  }
  private scheduleMusic(start: number, clickStart: number, end: number) {
    const spb = this.spb(), a = (this.range ?? [0, this.total])[0];
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
      if (passEnd > Math.min(start, clickStart)) {
        for (const n of this.notes) {
          if (n.beat < passFrom - 1e-6 || n.beat >= this.to - 1e-6) continue;
          const when = passStart + (n.beat - passFrom) * spb;
          if (when >= start && when < end && !this.mute.has(n.string)) this.voice(when, n.midi, Math.max(0.15, n.ring * spb), n.soft ? 0.14 : 0.28);
        }
        if (this.metronome) for (const b of this.bars) {
          for (let i = 0; i < b.beats; i++) {
            const beat = b.start + i * 4 / b.beatValue;
            if (beat < passFrom - 1e-6 || beat >= this.to - 1e-6) continue;
            const when = passStart + (beat - passFrom) * spb;
            if (when >= clickStart && when < end) this.click(when, i === 0, 'metronome');
          }
        }
      }
      if (!this.loop || this.to <= a) break;
      passStart = passEnd; passFrom = a;
    }
  }
  private tick() {
    const now = this.ctx!.currentTime, end = now + 0.25;
    this.sources = this.sources.filter(s => s.end > now);
    if (this.state === 'counting-in') {
      for (let i = 0; i < this.countBeats; i++) {
        const when = this.countStart + i * this.countStep * this.spb();
        if (when >= Math.max(now, this.scheduledUntil) && when < end) this.click(when, i === 0, 'count-in');
      }
      if (now >= this.countEnd) this.state = 'playing';
    }
    this.scheduleMusic(Math.max(now, this.scheduledUntil, this.t0), Math.max(now, this.clickScheduledUntil, this.t0), end);
    this.scheduledUntil = end; this.clickScheduledUntil = end;
    if (this.state === 'counting-in') { this.emit(this.from); return; }
    if (!this.loop && now >= this.t0 + (this.to - this.from) * this.spb()) { this.stop(); return; }
    const latency = this.ctx!.outputLatency || this.ctx!.baseLatency || 0;
    this.emit(this.position(Math.max(this.t0, now - latency)));
  }
  private halt() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null; this.cancel();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }
  private restart(beat: number) {
    this.halt(); this.state = 'paused'; this.paused = beat; this.resumeMusic = true; this.play();
  }
  setRange(range: [number, number] | null, loop: boolean) {
    const beat = this.playing && this.ctx ? this.position(this.ctx.currentTime) : this.paused;
    this.range = range; this.loop = loop;
    const [a, z] = range ?? [0, this.total]; this.to = z;
    if (this.state === 'counting-in' && this.ctx) {
      if (this.from < a || this.from >= z) {
        this.halt(); this.state = 'paused'; this.paused = a; this.resumeMusic = false; this.emit(a);
      } else {
        this.cancelFuture();
        this.scheduledUntil = this.ctx.currentTime + 1e-6; this.clickScheduledUntil = this.scheduledUntil;
      }
    } else if (this.state === 'playing' && this.ctx) {
      if (beat === null || beat < a || beat >= z) this.restart(a);
      else {
        const now = this.ctx.currentTime;
        this.cancelFuture(); this.from = beat; this.t0 = Math.max(now, this.t0);
        this.scheduledUntil = now + 1e-6; this.clickScheduledUntil = now + 1e-6;
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
    if (this.state === 'playing') this.restart(target);
    else { if (this.playing) this.halt(); this.state = 'paused'; this.resumeMusic = false; this.paused = target; this.emit(target); }
  }
  seek(beat: number) {
    if (!Number.isFinite(beat) || !this.bars.length) return;
    const target = Math.max(0, Math.min(this.bars[this.bars.length - 1].start, beat));
    this.setPosition(target);
  }
  pause() {
    if (!this.playing || !this.ctx) return;
    const counting = this.state === 'counting-in';
    const wrapped = this.loop && this.ctx.currentTime >= this.t0 + (this.to - this.from) * this.spb();
    const passStart = wrapped ? (this.range ?? [0, this.total])[0] : this.from;
    this.paused = counting ? this.from : Math.max(passStart, this.position(this.ctx.currentTime) - 0.05);
    this.halt(); this.state = 'paused'; this.resumeMusic = !counting; this.emit(this.paused);
  }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  stop() { this.halt(); this.state = 'stopped'; this.paused = null; this.resumeMusic = false; this.emit(null); }
  setSpeed(s: number) {
    const now = this.ctx?.currentTime ?? 0, beat = this.state === 'playing' ? this.position(now) : null;
    if (this.state === 'counting-in') {
      const oldSpb = this.spb(), elapsed = Math.max(0, (now - this.countStart) / oldSpb), lead = Math.max(0, this.countStart - now);
      this.cancel(); this.speed = s; this.countStart = now + lead - elapsed * this.spb(); this.countEnd = this.countStart + this.countBeats * this.countStep * this.spb(); this.t0 = this.countEnd; this.scheduledUntil = now + 1e-6; this.clickScheduledUntil = now + 1e-6; return;
    }
    this.speed = s; if (beat !== null) this.restart(beat);
  }
  setMetronome(enabled: boolean) { this.metronome = enabled; if (!enabled) this.cancel('metronome'); else if (this.playing && this.ctx) this.clickScheduledUntil = this.ctx.currentTime + 1e-6; }
  setCountIn(enabled: boolean) { this.countIn = enabled; }
  setClickVolume(volume: number) { if (Number.isFinite(volume)) this.clickVolume = Math.max(0, Math.min(1, volume)); }
  barAt(beat: number): number | null { const b = this.bars.find(x => beat >= x.start - 1e-6 && beat < x.start + x.length); return b ? b.bar : null; }
  barRange(first: number, last: number): [number, number] {
    const a = this.bars.find(b => b.bar === first) ?? this.bars[0]; const z = this.bars.find(b => b.bar === last) ?? this.bars[this.bars.length - 1];
    return [a.start, z.start + z.length];
  }
}
