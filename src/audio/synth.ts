export type SourceKind = 'instrument' | 'count-in' | 'metronome' | 'backing';
type Scheduled = { node: AudioScheduledSourceNode; kind: SourceKind; start: number; end: number };

const MASTER_LEVEL = 0.8;

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: Scheduled[] = [];
  private silenced = false;

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
  track(node: AudioScheduledSourceNode, kind: SourceKind, start: number, end: number) { this.sources.push({ node, kind, start, end }); }
}
