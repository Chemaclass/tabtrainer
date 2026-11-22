import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { APPROACHES } from '../../src/core/model';
import { APPROACH_MARK, OPPOSITE, RISES, approachOf, eventsInOrder, pitchPlan, sourceOf } from '../../src/core/technique';

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
  it('glides from the source fret to the written one over a quarter of a beat', () => {
    expect(pitchPlan(note('slide-up', 7), { string: 3, fret: 5 }, 1)).toEqual([{ at: 0, cents: -200 }, { at: 0.25, cents: 0 }]);
    expect(pitchPlan(note('slide-down', 5), { string: 3, fret: 9 }, 2)).toEqual([{ at: 0, cents: 400 }, { at: 0.25, cents: 0 }]);
  });
  it('takes half of a short note', () => {
    expect(pitchPlan(note('slide-up', 7), { string: 3, fret: 5 }, 0.25)).toEqual([{ at: 0, cents: -200 }, { at: 0.125, cents: 0 }]);
  });
  it('slides in from two frets away when nothing comes before, but not below the open string', () => {
    expect(pitchPlan(note('slide-up', 7), undefined, 1)?.[0]).toEqual({ at: 0, cents: -200 });
    expect(pitchPlan(note('slide-up', 1), undefined, 1)?.[0]).toEqual({ at: 0, cents: -100 });
    expect(pitchPlan(note('slide-down', 5), undefined, 1)?.[0]).toEqual({ at: 0, cents: 200 });
  });
  it('leaves the pitch alone for other notes', () => {
    expect(pitchPlan(note('hammer', 7), { string: 3, fret: 5 }, 1)).toBeUndefined();
    expect(pitchPlan({ string: 3, fret: 7 }, undefined, 1)).toBeUndefined();
  });
});
