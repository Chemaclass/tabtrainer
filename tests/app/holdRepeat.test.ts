import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_DELAY_MS, HOLD_REPEAT_MS, HoldRepeat } from '../../src/app/holdRepeat';

function stepper(limit = Infinity) {
  const log = { steps: 0, settled: 0 };
  const hold = new HoldRepeat({ step: () => { log.steps++; }, settled: () => { log.settled++; }, atLimit: () => log.steps >= limit });
  return { hold, log };
}

describe('hold to repeat', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('steps once and settles once for a tap', () => {
    const { hold, log } = stepper();
    hold.press(); hold.release(); hold.click();
    expect(log).toEqual({ steps: 1, settled: 1 });
  });
  it('repeats while held and settles once when released, ignoring the click that ends the hold', () => {
    const { hold, log } = stepper();
    hold.press(); vi.advanceTimersByTime(HOLD_DELAY_MS + 2 * HOLD_REPEAT_MS);
    expect(log).toEqual({ steps: 3, settled: 0 });
    hold.release(); hold.click(); hold.release();
    vi.advanceTimersByTime(HOLD_REPEAT_MS * 4);
    expect(log).toEqual({ steps: 3, settled: 1 });
  });
  it('drops an unfinished hold when a second press comes before its release', () => {
    const { hold, log } = stepper();
    hold.press(); vi.advanceTimersByTime(HOLD_DELAY_MS);
    hold.press(); hold.release(); hold.click();
    vi.advanceTimersByTime(HOLD_REPEAT_MS * 10);
    expect(log.steps).toBe(2);
  });
  it('stops at the limit and still answers the next keyboard click', () => {
    const { hold, log } = stepper(2);
    hold.press(); vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_REPEAT_MS * 10);
    expect(log).toEqual({ steps: 2, settled: 1 });
    vi.advanceTimersByTime(1);
    hold.click();
    expect(log).toEqual({ steps: 3, settled: 2 });
  });
});
