import { describe, expect, it } from 'vitest';
import { PracticeSession, clearedSummary, clearedTitle, clockTime, nextLoop, type ClearedLoop } from '../../src/app/practiceSession';

const noClimb = { enabled: false, startingSpeed: null, target: 0 };
const climb = { enabled: true, startingSpeed: 60, target: 100 };
const loop = (speed: number) => ({ firstBar: 5, lastBar: 8, whole: false, speed });
const whole = (speed: number) => ({ firstBar: 1, lastBar: 16, whole: true, speed });
const cleared = (change: Partial<ClearedLoop>): ClearedLoop => ({ loop: [5, 8], startSpeed: 60, speed: 100, steps: [60, 100], passes: 12, seconds: 370, next: [9, 12], ...change });

describe('practice session', () => {
  it('clears a climb on the first pass at its target', () => {
    const session = new PracticeSession();
    session.restart(0); session.playing(true, 0);
    for (const speed of [60, 60, 80, 80]) expect(session.passEnded(loop(speed), climb, 16, 1000)).toBeNull();
    expect(session.passEnded(loop(100), climb, 16, 370_000)).toEqual({ loop: [5, 8], startSpeed: 60, speed: 100, steps: [60, 80, 100], passes: 5, seconds: 370, next: [9, 12] });
    expect(session.passEnded(loop(100), climb, 16, 380_000)).toBeNull();
  });
  it('clears a whole song pass at full speed, but not a slower one or a loop without a climb', () => {
    const session = new PracticeSession();
    expect(session.passEnded(loop(100), noClimb, 16, 0)).toBeNull();
    expect(session.passEnded(whole(90), noClimb, 16, 0)).toBeNull();
    expect(session.passEnded(whole(100), noClimb, 16, 0)).toMatchObject({ loop: null, startSpeed: 90, steps: [90, 100], passes: 2, next: null });
  });
  it('starts counting again when the loop changes or the player restarts', () => {
    const session = new PracticeSession();
    session.passEnded(whole(80), noClimb, 16, 0);
    session.passEnded(loop(80), climb, 16, 0);
    expect(session.passEnded(whole(100), noClimb, 16, 0)).toMatchObject({ passes: 1, steps: [100] });
    session.restart(0);
    expect(session.passEnded(whole(100), noClimb, 16, 0)).toMatchObject({ passes: 1 });
  });
  it('times a new loop from the pass that changed it', () => {
    const session = new PracticeSession();
    session.playing(true, 0);
    session.passEnded(whole(80), noClimb, 16, 60_000);
    session.passEnded(loop(80), climb, 16, 100_000);
    expect(session.passEnded(loop(100), climb, 16, 130_000)).toMatchObject({ passes: 2, seconds: 30 });
  });
  it('keeps the time of the first pass after a restart, as when a climb starts, resets or the version changes', () => {
    const session = new PracticeSession();
    session.passEnded(loop(60), climb, 16, 0);
    session.playing(true, 10_000); session.restart(20_000);
    session.passEnded(loop(60), climb, 16, 50_000);
    expect(session.passEnded(loop(100), climb, 16, 80_000)).toMatchObject({ passes: 2, seconds: 60, steps: [60, 100] });
    session.restart(90_000);
    expect(session.passEnded(loop(100), climb, 16, 100_000)).toMatchObject({ passes: 1, seconds: 10 });
  });
  it('counts only the time audio plays', () => {
    const session = new PracticeSession();
    session.playing(true, 0); session.playing(false, 30_000); session.playing(true, 100_000);
    expect(session.passEnded(whole(100), noClimb, 16, 130_000)?.seconds).toBe(60);
    session.restart(140_000);
    expect(session.passEnded(whole(100), noClimb, 16, 150_000)?.seconds).toBe(10);
  });
});

describe('cleared loop text', () => {
  it('offers the next loop of the same length within the song', () => {
    expect(nextLoop([5, 8], 16)).toEqual([9, 12]);
    expect(nextLoop([13, 15], 16)).toEqual([16, 16]);
    expect(nextLoop([13, 16], 16)).toBeNull();
  });
  it('names what was cleared and how', () => {
    expect(clearedTitle(cleared({}))).toBe('Bars 5 to 8 at full speed.');
    expect(clearedTitle(cleared({ loop: [3, 3], speed: 90 }))).toBe('Bar 3 at 90%.');
    expect(clearedTitle(cleared({ loop: null }))).toBe('The whole song at full speed.');
    expect(clearedSummary(cleared({}))).toBe('You started at 60%. Twelve passes and six minutes later, it sits at 100%.');
    expect(clearedSummary(cleared({ startSpeed: 100, passes: 1, seconds: 20 }))).toBe('One pass and 20 seconds in, it sits at 100%.');
    expect(clearedSummary(cleared({ passes: 2, seconds: 8 }))).toBe('You started at 60%. Two passes and eight seconds later, it sits at 100%.');
    expect(clearedSummary(cleared({ passes: 2, seconds: 0.2 }))).toBe('You started at 60%. Two passes and one second later, it sits at 100%.');
    expect(clearedSummary(cleared({ passes: 2, seconds: 60 }))).toBe('You started at 60%. Two passes and one minute later, it sits at 100%.');
    expect(clearedSummary(cleared({ passes: 14 }))).toBe('You started at 60%. 14 passes and six minutes later, it sits at 100%.');
    expect(clockTime(370)).toBe('6:10');
    expect(clockTime(5)).toBe('0:05');
  });
});
