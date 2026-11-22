import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSong } from '../../src/core/parser';
import { buildTimeline, onsetAt, onsetsOf } from '../../src/core/timeline';

const onsetsOfText = (text: string) => onsetsOf(buildTimeline(parseSong(text).song).notes);
const onsetsFor = (file: string) => onsetsOfText(readFileSync(file, 'utf8'));
const SCALE = `instrument: bass4
tempo: 70
key: C
time: 4/4
@Up
"C" :q 3.3 5.3 2.2 3.2 | 5.2 2.1 4.1 5.1 |
@Down
5.1 4.1 2.1 5.2 | 3.2 2.2 5.3 3.3 |
@In eighth notes
:8 3.3 5.3 2.2 3.2 5.2 2.1 4.1 5.1 | 5.1 4.1 2.1 5.2 3.2 2.2 5.3 3.3 |
@Ending
:w 3.3 |`;

describe('onsetAt', () => {
  it('keeps a note lit for its whole length', () => {
    const canon = onsetsFor('src/songs/bass/songs/02-canon-in-d.txt');
    expect([0, 1, 1.9].map(b => onsetAt(canon, b))).toEqual(['0', '0', '0']);
    expect(onsetAt(canon, 2)).toBe('2000');
  });
  it('is null before the first note', () => {
    expect(onsetAt([1000, 2000], 0.5)).toBeNull();
  });
  it('finds triplet onsets despite rounding', () => {
    expect(onsetAt([0, 333, 667, 1000], 2 / 3)).toBe('667');
  });
  it('gives different songs with the same number of onsets their own lookups', () => {
    const scale = onsetsOfText(SCALE);
    const canon = onsetsFor('src/songs/bass/songs/02-canon-in-d.txt');
    expect(scale).toHaveLength(canon.length);
    expect(onsetAt(scale, 1)).toBe('1000');
    expect(onsetAt(canon, 1)).toBe('0');
  });
});

it('retains the written meter for each bar', () => {
  const song = parseSong(readFileSync('src/songs/bass/songs/02-canon-in-d.txt', 'utf8')).song;
  const timeline = buildTimeline(song);
  expect(timeline.bars[0]).toMatchObject({ beats: song.bars[0].beats, beatValue: song.bars[0].beatValue });
});

it('plays a dead note at the open string and ends the note before it', () => {
  const { notes } = buildTimeline(parseSong('instrument: guitar6\n:q 5.3 x.3 (x.2 x.1) 3.1 |').song);
  expect(notes[1]).toMatchObject({ beat: 1, midi: 55, fret: 0, dead: true });
  expect(notes[2]).toMatchObject({ string: 2, midi: 59, dead: true });
  expect(notes[0].ring).toBe(1);
  expect(notes[0].dead).toBeUndefined();
});

it('marks every note of a palm-muted event as muted', () => {
  const { notes } = buildTimeline(parseSong('instrument: guitar6\n:q _(0.6 2.5) 0.6 _x.6 r |').song);
  expect(notes.map(n => n.muted)).toEqual([true, true, undefined, true]);
  expect(notes[3].dead).toBe(true);
});

it('plays a hammer-on or pull-off without a pick, in its own voice', () => {
  const { notes } = buildTimeline(parseSong('instrument: guitar6\n:h 5.3 h7.3 | :q p5.3 r :h 3.3 |').song);
  expect(notes.map(n => n.legato)).toEqual([undefined, true, true, undefined]);
  expect(notes.map(n => n.key)).toEqual(['0', '2000', '4000', '6000']);
  expect(notes[0].ring).toBe(2);
});

it('glides a slide from the note before, or into a note from two frets away', () => {
  const { notes } = buildTimeline(parseSong('instrument: guitar6\n:q 5.3 /7.3 r \\5.3 |').song);
  expect(notes[1]).toMatchObject({ legato: true, pitch: [{ at: 0, cents: -200 }, { at: 0.25, cents: 0 }] });
  expect(notes[2].legato).toBeUndefined();
  expect(notes[2].pitch).toEqual([{ at: 0, cents: 200 }, { at: 0.25, cents: 0 }]);
  expect(notes[0].pitch).toBeUndefined();
});
