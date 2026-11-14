import { describe, expect, it } from 'vitest';
import { advanceSpeedPractice, isSpeedPracticeConfig } from '../../src/core/speedPractice';

describe('speed practice rules', () => {
  it('advances only after the configured repetitions and clamps at the target', () => {
    const config = { repetitions: 4, increase: 5, target: 80 };
    let state = { speed: 60, completed: 0 };
    const speeds = [];
    for (let i = 0; i < 17; i++) { state = advanceSpeedPractice(state, config); speeds.push(state.speed); }
    expect(speeds).toEqual([60, 60, 60, 65, 65, 65, 65, 70, 70, 70, 70, 75, 75, 75, 75, 80, 80]);
    expect(advanceSpeedPractice({ speed: 74, completed: 0 }, { repetitions: 1, increase: 7, target: 80 }).speed).toBe(80);
  });
  it('validates integer values and bounds', () => {
    expect(isSpeedPracticeConfig({ repetitions: 1, increase: 20, target: 130 })).toBe(true);
    for (const value of [null, [], {}, { repetitions: 1.5, increase: 5, target: 80 }, { repetitions: 1, increase: Infinity, target: 80 }, { repetitions: 0, increase: 5, target: 80 }, { repetitions: 1, increase: 5, target: 29 }]) expect(isSpeedPracticeConfig(value)).toBe(false);
  });
});
