interface ScrollEnvironment {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
  scroll: (pixels: number) => void;
  speed: () => number;
  atBottom: () => boolean;
  ended: () => void;
}
export class AutoScroller {
  private frame: number | null = null;
  private last: number | null = null;
  private accumulated = 0;
  constructor(private environment: ScrollEnvironment) {}
  start() {
    if (this.frame !== null) return;
    this.last = null; this.accumulated = 0;
    this.frame = this.environment.request(time => this.step(time));
  }
  stop() {
    if (this.frame !== null) this.environment.cancel(this.frame);
    this.frame = null; this.last = null; this.accumulated = 0;
  }
  private step(time: number) {
    if (this.frame === null) return;
    if (this.environment.atBottom()) { this.stop(); this.environment.ended(); return; }
    if (this.last !== null) {
      this.accumulated += this.environment.speed() * (time - this.last) / 1000;
      const pixels = Math.floor(this.accumulated);
      if (pixels >= 1) { this.environment.scroll(pixels); this.accumulated -= pixels; }
    }
    this.last = time;
    this.frame = this.environment.request(next => this.step(next));
  }
}
