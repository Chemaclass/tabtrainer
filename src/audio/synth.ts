export type SourceKind = 'instrument' | 'count-in' | 'metronome';
type Scheduled = { node: OscillatorNode; kind: SourceKind; start: number; end: number };

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: Scheduled[] = [];

  get started() { return this.ctx !== null; }
  get now() { return this.ctx?.currentTime ?? 0; }
  get latency() { return this.ctx!.outputLatency || this.ctx!.baseLatency || 0; }

  ensure(): boolean {
    try { this.ctx = this.ctx ?? new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return false; }
    void this.ctx.resume();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    return true;
  }
  voice(when: number, midi: number, dur: number, vel: number) {
    const ctx = this.ctx!, f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 10), when); lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 2), when + 0.4);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    g2.gain.value = 0.6; o.connect(lp); o2.connect(g2); g2.connect(g); lp.connect(g); g.connect(this.master!);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
    this.remember(o, 'instrument', when, when + dur + 0.05); this.remember(o2, 'instrument', when, when + dur + 0.05);
  }
  click(when: number, accent: boolean, kind: 'count-in' | 'metronome', volume: number) {
    if (volume === 0) return;
    const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1200 : 800;
    g.gain.setValueAtTime(Math.max(0.0001, volume * (accent ? 0.5 : 0.3)), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    o.connect(g); g.connect(this.master!); o.start(when); o.stop(when + 0.04); this.remember(o, kind, when, when + 0.04);
  }
  cancel(kind?: SourceKind) {
    const now = this.now;
    this.sources = this.sources.filter(s => {
      if (kind && s.kind !== kind) return s.end > now;
      try { s.node.stop(now); } catch { /* The source has already ended. */ }
      return false;
    });
  }
  cancelFuture() {
    const now = this.now;
    this.sources = this.sources.filter(s => {
      if (s.start <= now) return s.end > now;
      try { s.node.stop(now); } catch { /* The source has already ended. */ }
      return false;
    });
  }
  forget(now: number) { this.sources = this.sources.filter(s => s.end > now); }
  silence() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }
  private remember(node: OscillatorNode, kind: SourceKind, start: number, end: number) { this.sources.push({ node, kind, start, end }); }
}
