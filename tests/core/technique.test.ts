import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { APPROACHES, type Note } from '../../src/core/model';
import { APPROACH_MARK, BENDS, OPPOSITE, RISES, approachOf, eventsInOrder, heldBend, pitchPlan, sourceOf } from '../../src/core/technique';

const bars = (body: string) => parseSong(`instrument: guitar6\n${body}`).song.bars;

describe('approach marks', () => {
  it('reads back each mark it writes', () => {
    for (const approach of APPROACHES) expect(approachOf(APPROACH_MARK[approach])).toBe(approach);
    expect(approachOf('~')).toBeUndefined();
    expect(approachOf('')).toBeUndefined();
  });
});

describe('events in order', () => {
  it('gives each event the one played before it, across bar lines', () => {
    const order = eventsInOrder(bars(':h 5.3 7.3 | 5.3 r |'));
    expect(order.map(({ bar, event }) => [bar.index, event.start])).toEqual([[1, 0], [1, 96], [2, 0], [2, 96]]);
    expect(order[0].before).toBeUndefined();
    expect(order[2].before).toBe(order[1].event);
    expect(order[3].before).toBe(order[2].event);
  });
});

describe('source of a join', () => {
  it('is the note on the same string in the event before, unless it is dead', () => {
    const [before] = bars(':w (5.3 x.2 7.1) |')[0].events;
    expect(sourceOf(before, { string: 3 })).toEqual({ string: 3, fret: 5 });
    expect(sourceOf(before, { string: 2 })).toBeUndefined();
    expect(sourceOf(before, { string: 4 })).toBeUndefined();
    expect(sourceOf(undefined, { string: 3 })).toBeUndefined();
  });
});

describe('opposite approaches', () => {
  it('pairs each approach with one that moves the other way', () => {
    for (const approach of APPROACHES) {
      expect(OPPOSITE[OPPOSITE[approach]]).toBe(approach);
      expect(RISES[OPPOSITE[approach]]).toBe(!RISES[approach]);
    }
  });
});

describe('pitch plan', () => {
  const note = (approach: 'slide-up' | 'slide-down' | 'hammer', fret: number) => ({ string: 3, fret, approach });
  const bent = (bend: number, extra: Partial<Note> = {}) => ({ string: 3, fret: 7, bend, ...extra });
  it('glides from the source fret to the written one over a quarter of a beat', () => {
    expect(pitchPlan(note('slide-up', 7), { string: 3, fret: 5 }, undefined, 1)).toEqual([{ at: 0, cents: -200 }, { at: 0.25, cents: 0 }]);
    expect(pitchPlan(note('slide-down', 5), { string: 3, fret: 9 }, undefined, 2)).toEqual([{ at: 0, cents: 400 }, { at: 0.25, cents: 0 }]);
  });
  it('takes half of a short note', () => {
    expect(pitchPlan(note('slide-up', 7), { string: 3, fret: 5 }, undefined, 0.25)).toEqual([{ at: 0, cents: -200 }, { at: 0.125, cents: 0 }]);
  });
  it('slides in from two frets away when nothing comes before, but not below the open string', () => {
    expect(pitchPlan(note('slide-up', 7), undefined, undefined, 1)?.[0]).toEqual({ at: 0, cents: -200 });
    expect(pitchPlan(note('slide-up', 1), undefined, undefined, 1)?.[0]).toEqual({ at: 0, cents: -100 });
    expect(pitchPlan(note('slide-down', 5), undefined, undefined, 1)?.[0]).toEqual({ at: 0, cents: 200 });
  });
  it('leaves the pitch alone for other notes', () => {
    expect(pitchPlan(note('hammer', 7), { string: 3, fret: 5 }, undefined, 1)).toBeUndefined();
    expect(pitchPlan({ string: 3, fret: 7 }, undefined, undefined, 1)).toBeUndefined();
  });
  it('bends up over half a beat, or half of a short note', () => {
    expect(pitchPlan(bent(1), undefined, undefined, 2)).toEqual([{ at: 0, cents: 0 }, { at: 0.5, cents: 200 }]);
    expect(pitchPlan(bent(0.5), undefined, undefined, 0.5)).toEqual([{ at: 0, cents: 0 }, { at: 0.25, cents: 100 }]);
  });
  it('lets a released bend back down before the note ends', () => {
    expect(pitchPlan(bent(1, { release: true }), undefined, undefined, 3)).toEqual([{ at: 0, cents: 0 }, { at: 1, cents: 200 }, { at: 1.5, cents: 200 }, { at: 2.5, cents: 0 }]);
  });
  it('keeps the bend a tie holds, and bends a held note only when it was not bent', () => {
    expect(pitchPlan({ string: 3, fret: 7, tie: true }, undefined, 1, 2)).toEqual([{ at: 0, cents: 200 }]);
    expect(pitchPlan({ string: 3, fret: 7 }, undefined, 1, 2)).toBeUndefined();
    expect(pitchPlan(bent(1, { tie: true }), undefined, undefined, 2)).toEqual([{ at: 0, cents: 0 }, { at: 0.5, cents: 200 }]);
  });
  it('glides first, then bends over the rest of the note', () => {
    expect(pitchPlan(bent(1, { approach: 'slide-up' }), { string: 3, fret: 5 }, undefined, 1.25)).toEqual([{ at: 0, cents: -200 }, { at: 0.25, cents: 0 }, { at: 0.75, cents: 200 }]);
    expect(pitchPlan(bent(1, { approach: 'hammer' }), { string: 3, fret: 5 }, undefined, 2)).toEqual([{ at: 0, cents: 0 }, { at: 0.5, cents: 200 }]);
  });
});

describe('held bend', () => {
  it('starts with a bend that does not come back down and lasts through ties', () => {
    const steps = BENDS.map(b => b.steps);
    expect(steps).toEqual([0.25, 0.5, 1, 1.5, 2]);
    expect(heldBend(undefined, { string: 3, fret: 7, bend: 1 })).toBe(1);
    expect(heldBend(undefined, { string: 3, fret: 7, bend: 1, release: true })).toBeUndefined();
    expect(heldBend(1, { string: 3, fret: 7, tie: true })).toBe(1);
    expect(heldBend(1, { string: 3, fret: 7 })).toBeUndefined();
  });
});
