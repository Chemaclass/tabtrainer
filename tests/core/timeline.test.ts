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
