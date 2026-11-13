import type { TimedNote, BarSpan } from '../core/timeline';

export interface PlayerState { playing: boolean; beat: number | null }
type Listener = (s: PlayerState) => void;

/** Small Web Audio synth + scheduler. Positions are in quarter-note beats. */
export class Player {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private t0 = 0; private from = 0; private to = 0; private next = 0;
  private paused: number | null = null;
  private listeners: Listener[] = [];
  notes: TimedNote[] = []; bars: BarSpan[] = []; total = 0;
  tempo = 90; speed = 1; loop = false; range: [number, number] | null = null;
  mute = new Set<number>(); // muted string numbers

  load(tl: { notes: TimedNote[]; bars: BarSpan[]; total: number }, tempo: number) {
    this.stop(); this.notes = tl.notes; this.bars = tl.bars; this.total = tl.total; this.tempo = tempo;
  }
  on(fn: Listener) { this.listeners.push(fn); }
  private emit(beat: number | null) { const s = { playing: this.playing, beat }; this.listeners.forEach(f => f(s)); }
  get playing() { return this.timer !== null; }
  get pausedAt() { return this.paused; }
  private spb() { return 60 / (this.tempo * this.speed); }

  private voice(when: number, midi: number, dur: number, vel: number) {
    const ctx = this.ctx!, f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 10), when); lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 2), when + 0.4);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    g2.gain.value = 0.6; o.connect(lp); o2.connect(g2); g2.connect(g); lp.connect(g); g.connect(this.master!);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }
  private ensure(): boolean {
    try { this.ctx = this.ctx ?? new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return false; }
    void this.ctx.resume();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    return true;
  }
  /** Start playing at a beat (default: start of the loop range / song). */
  play(fromBeat?: number) {
    if (this.playing) this.halt();
    if (!this.ensure()) return;
    const [a, z] = this.range ?? [0, this.total];
    this.from = fromBeat ?? a; this.to = fromBeat !== undefined && fromBeat >= z ? this.total : z;
    this.t0 = this.ctx!.currentTime + 0.08;
    this.next = this.notes.findIndex(n => n.beat >= this.from - 1e-6); if (this.next < 0) this.next = this.notes.length;
    this.paused = null;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.emit(this.from);
  }
  private tick() {
    const ctx = this.ctx!, now = ctx.currentTime, spb = this.spb();
    while (this.next < this.notes.length && this.notes[this.next].beat < this.to) {
      const n = this.notes[this.next]; const when = this.t0 + (n.beat - this.from) * spb;
      if (when > now + 0.25) break;
      if (when >= now - 0.03 && !this.mute.has(n.string)) this.voice(when, n.midi, Math.max(0.15, n.ring * spb), n.soft ? 0.14 : 0.28);
      this.next++;
    }
    const beat = this.from + (now - this.t0) / spb;
    if (beat >= this.to) { if (this.loop) { const [a] = this.range ?? [0, this.total]; this.play(a); } else this.stop(); return; }
    // show what the listener hears now: the speakers lag the audio clock by the output latency
    const heard = beat - (ctx.outputLatency || ctx.baseLatency || 0) / spb;
    this.emit(Math.max(this.from, heard));
  }
  private halt() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03); }
  setRange(range: [number, number] | null, loop: boolean) {
    const beat = this.playing && this.ctx ? this.from + (this.ctx.currentTime - this.t0) / this.spb() : this.paused;
    this.range = range; this.loop = loop;
    const [a, z] = range ?? [0, this.total];
    if (this.playing) this.play(beat !== null && beat >= a && beat < z ? beat : a);
  }
  seek(beat: number) {
    if (!Number.isFinite(beat) || !this.bars.length) return;
    const target = Math.max(0, Math.min(this.bars[this.bars.length - 1].start, beat));
    if (this.playing) this.play(target);
    else { this.paused = target; this.emit(target); }
  }
  pause() { if (!this.playing || !this.ctx) return; this.paused = Math.max(this.from, this.from + (this.ctx.currentTime - this.t0) / this.spb() - 0.05); this.halt(); this.emit(this.paused); }
  toggle() { if (this.playing) this.pause(); else this.play(this.paused ?? undefined); }
  stop() { this.halt(); this.paused = null; this.emit(null); }
  setSpeed(s: number) { const wasBeat = this.playing && this.ctx ? this.from + (this.ctx.currentTime - this.t0) / this.spb() : null; this.speed = s; if (wasBeat !== null) this.play(wasBeat); }
  barAt(beat: number): number | null { const b = this.bars.find(x => beat >= x.start - 1e-6 && beat < x.start + x.length); return b ? b.bar : null; }
  barRange(first: number, last: number): [number, number] {
    const a = this.bars.find(b => b.bar === first) ?? this.bars[0]; const z = this.bars.find(b => b.bar === last) ?? this.bars[this.bars.length - 1];
    return [a.start, z.start + z.length];
  }
}
