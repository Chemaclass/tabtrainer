import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { APPROACH_MARK, approachOf, eventsInOrder, sourceOf } from '../../src/core/technique';

const bars = (body: string) => parseSong(`instrument: guitar6\n${body}`).song.bars;

describe('approach marks', () => {
  it('reads back each mark it writes', () => {
    expect(approachOf(APPROACH_MARK.hammer)).toBe('hammer');
    expect(approachOf(APPROACH_MARK.pull)).toBe('pull');
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
