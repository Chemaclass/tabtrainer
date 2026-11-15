export interface HoldRepeatActions { step(): void; settled(): void; atLimit(): boolean }

export const HOLD_DELAY_MS = 450;
export const HOLD_REPEAT_MS = 150;

export class HoldRepeat {
  private delay: ReturnType<typeof setTimeout> | undefined;
  private repeat: ReturnType<typeof setInterval> | undefined;
  private holding = false;
  private held = false;

  constructor(private readonly actions: HoldRepeatActions) {}

  press() {
    this.release();
    this.held = false;
    this.delay = setTimeout(() => {
      this.holding = this.held = true;
      this.repeat = setInterval(() => this.tick(), HOLD_REPEAT_MS);
      this.tick();
    }, HOLD_DELAY_MS);
  }

  release() {
    clearTimeout(this.delay); clearInterval(this.repeat);
    this.delay = this.repeat = undefined;
    if (!this.holding) return;
    this.holding = false;
    this.actions.settled();
    // the click that ends a hold arrives in the same task as the release; let it see the hold first
    setTimeout(() => { this.held = false; });
  }

  click() {
    if (this.held) { this.held = false; return; }
    this.actions.step();
    this.actions.settled();
  }

  private tick() {
    this.actions.step();
    if (this.actions.atLimit()) this.release();
  }
}
