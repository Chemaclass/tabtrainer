import { describe, expect, it } from 'vitest';
import { isProgressionSlug, nextChange, progressionKey, progressions } from '../../src/core/progressions';
import { MOODS } from '../../src/core/moods';
import { SCALES, type ScaleId } from '../../src/core/scales';

const names = (root: number, id: ScaleId, slug: string) => progressions(root, id).find(p => p.slug === slug)!.chords.map(c => c.name);

describe('progressions of a key', () => {
  it('lists the major and minor progressions with numerals', () => {
    expect(progressions(0, 'major').map(p => p.name)).toEqual(['I IV V', 'I V vi IV', 'ii V I', 'I vi IV V', 'I IV iv', 'I iii IV iv']);
    expect(progressions(9, 'minor').map(p => p.name)).toEqual(['i iv v', 'i bVII bVI bVII', 'i bVI bIII bVII', 'ii m7b5 V7 i', 'i bVI bVII']);
    expect(progressions(0, 'major')[1].chords.map(c => c.numeral)).toEqual(['I', 'V', 'vi', 'IV']);
  });
  it('spells I V vi IV in C as C G Am F and i bVII bVI bVII in A minor as Am G F G', () => {
    expect(names(0, 'major', 'i-v-vi-iv')).toEqual(['C', 'G', 'Am', 'F']);
    expect(names(9, 'minor', 'i-bvii-bvi-bvii')).toEqual(['Am', 'G', 'F', 'G']);
  });
  it('spells the other progressions in their keys', () => {
    expect(names(0, 'major', 'major-i-iv-v')).toEqual(['C', 'F', 'G']);
    expect(names(0, 'major', 'ii-v-i')).toEqual(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
    expect(names(0, 'major', 'major-i-vi-iv-v')).toEqual(['C', 'Am', 'F', 'G']);
    expect(names(9, 'minor', 'minor-i-iv-v')).toEqual(['Am', 'Dm', 'Em']);
    expect(names(9, 'minor', 'minor-i-bvi-biii-bvii')).toEqual(['Am', 'F', 'C', 'G']);
    expect(names(9, 'minor', 'minor-ii-v-i')).toEqual(['Bm7b5', 'E7', 'Am']);
    expect(names(1, 'major', 'i-v-vi-iv')).toEqual(['Db', 'Ab', 'Bbm', 'Gb']);
    expect(names(1, 'minor', 'i-bvii-bvi-bvii')).toEqual(['C#m', 'B', 'A', 'B']);
    expect(names(5, 'major', 'major-i-iv-v')).toEqual(['F', 'Bb', 'C']);
  });
  it('plays the 12 bar blues in A with A7, D7 and E7 in the standard order', () => {
    expect(progressions(9, 'blues').map(p => p.name)).toEqual(['12 bar blues']);
    expect(names(9, 'blues', '12-bar-blues')).toEqual(['A7', 'D7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7']);
  });
  it('names chord tones outside the scale with their own degree', () => {
    const e7 = progressions(9, 'minor')[3].chords[1];
    expect(e7.tones.map(t => t.name)).toEqual(['E', 'G#', 'B', 'D']);
    expect(e7.tones.map(t => t.degree)).toEqual(['5', '7', '2', '4']);
    const a7 = progressions(9, 'blues')[0].chords[0];
    expect(a7.tones.map(t => `${t.name} ${t.degree}`)).toEqual(['A 1', 'C# 3', 'E 5', 'G b7']);
    expect(a7.root.name).toBe('A');
  });
  it('spells a third that needs a double sharp', () => {
    const dSharp7 = progressions(3, 'blues')[0].chords[0];
    expect(dSharp7.tones.map(t => `${t.name} ${t.degree}`)).toEqual(['D# 1', 'F## 3', 'A# 5', 'C# b7']);
    const aSharp7 = progressions(3, 'minor')[3].chords[1];
    expect(aSharp7.tones.map(t => t.name)).toEqual(['A#', 'C##', 'E#', 'G#']);
  });
  it('uses the parent key for pentatonic scales', () => {
    expect(progressions(0, 'major-pentatonic')).toHaveLength(4);
    expect(names(9, 'minor-pentatonic', 'i-bvii-bvi-bvii')).toEqual(['Am', 'G', 'F', 'G']);
  });
  it('lists the progressions of the moods on a mode', () => {
    expect(names(2, 'dorian', 'funky-i7-iv7')).toEqual(['Dm7', 'G7']);
    expect(progressions(4, 'phrygian').map(p => p.name)).toEqual(['i bII', 'i bII bvii']);
    expect(names(0, 'lydian', 'dreamy-imaj7-ii')).toEqual(['Cmaj7', 'D']);
    expect(names(7, 'mixolydian', 'mixolydian-i-bvii-iv')).toEqual(['G', 'F', 'C']);
  });
  it('lists no other mood progressions once a mood is picked', () => {
    const happy = progressions(0, 'major', MOODS.find(m => m.id === 'happy')!).map(p => p.name);
    expect(happy).toEqual(['I V vi IV', 'I IV V', 'ii V I', 'I vi IV V']);
    const melancholic = progressions(0, 'major', MOODS.find(m => m.id === 'melancholic')!).map(p => p.name);
    expect(melancholic.slice(0, 2)).toEqual(['I IV iv', 'I iii IV iv']);
  });
  it('finds a key signature for every root of every scale', () => {
    for (const scale of SCALES) {
      for (let root = 0; root < 12; root++) {
        expect(() => progressions(root, scale.id)).not.toThrow();
        expect(progressions(root, scale.id).length, `${root} ${scale.id}`).toBeGreaterThan(0);
        expect(progressions(root, scale.id).flatMap(p => p.chords).every(c => /^[A-G][#b]?/.test(c.name))).toBe(true);
      }
    }
    expect(progressionKey(1, 'major')).toBe('Db');
    expect(progressionKey(1, 'minor')).toBe('C#m');
  });
  it('gives every progression of a mood its own slug, reusing the scale list where the numerals match', () => {
    for (const mood of MOODS) {
      const listed = progressions(0, mood.scale, mood).slice(0, mood.progressions.length);
      expect(new Set(listed.map(p => p.slug)).size, mood.id).toBe(mood.progressions.length);
      for (const progression of listed) expect(isProgressionSlug(progression.slug), progression.slug).toBe(true);
    }
    expect(progressions(9, 'blues', MOODS.find(m => m.id === 'bluesy')!).map(p => p.slug)).toEqual(['12-bar-blues']);
  });
  it('knows its slugs', () => {
    expect(isProgressionSlug('12-bar-blues')).toBe(true);
    expect(isProgressionSlug('minor-ii-v-i')).toBe(true);
    expect(isProgressionSlug('one-chord')).toBe(false);
    expect(isProgressionSlug(3)).toBe(false);
  });
});

describe('the next change', () => {
  it('skips repeated chords and wraps round', () => {
    const blues = progressions(9, 'blues')[0].chords;
    expect(nextChange(blues, 0)?.name).toBe('D7');
    expect(nextChange(blues, 2)?.name).toBe('D7');
    expect(nextChange(blues, 6)?.name).toBe('E7');
    expect(nextChange(blues, 11)?.name).toBe('A7');
    const iiVI = progressions(0, 'major')[2].chords;
    expect(nextChange(iiVI, 2)?.name).toBe('Dm7');
  });
});
