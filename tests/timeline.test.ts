import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSong } from '../src/core/parser';
import { buildTimeline, onsetAt, onsetsOf } from '../src/core/timeline';

const onsetsFor = (file: string) => onsetsOf(buildTimeline(parseSong(readFileSync(file, 'utf8')).song).notes);

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
    const scale = onsetsFor('src/songs/bass/exercises/03-c-major-scale.txt');
    const canon = onsetsFor('src/songs/bass/songs/02-canon-in-d.txt');
    expect(scale).toHaveLength(canon.length);
    expect(onsetAt(scale, 1)).toBe('1000');
    expect(onsetAt(canon, 1)).toBe('0');
  });
});
