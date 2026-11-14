import { describe, expect, it } from 'vitest';
import { parseNumeral } from '../../src/core/harmony';
import { MOODS, isMoodId, moodById, type MoodId } from '../../src/core/moods';
import { isScaleId } from '../../src/core/scales';

describe('mood table', () => {
  it('names an existing scale for every mood', () => {
    for (const mood of MOODS) expect(isScaleId(mood.scale), mood.id).toBe(true);
  });
  it('writes every progression in numerals parseNumeral reads', () => {
    for (const mood of MOODS) {
      for (const numeral of mood.progressions.flatMap(bars => bars.split(' '))) {
        expect(parseNumeral(numeral), `${mood.id}: ${numeral}`).toHaveProperty('numeral');
      }
    }
  });
  it('gives every mood a progression and a reason', () => {
    for (const mood of MOODS) {
      expect(mood.progressions.length, mood.id).toBeGreaterThan(0);
      expect(mood.why, mood.id).not.toBe('');
    }
  });
  it('knows its mood ids', () => {
    expect(MOODS.map(mood => mood.id)).toEqual(['happy', 'sad', 'epic', 'dark', 'dreamy', 'bluesy', 'funky', 'tense']);
    expect(isMoodId('dark')).toBe(true);
    expect(isMoodId('angry')).toBe(false);
    expect(moodById('dreamy').scale).toBe('lydian');
    expect(() => moodById('angry' as MoodId)).toThrow();
  });
});
