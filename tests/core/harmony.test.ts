import { describe, expect, it } from 'vitest';
import { OWN_PROGRESSION, PROGRESSION_PRESETS, chordAt, degreeInterval, isMinorProgression, keyTonic, parseNumeral, presetProgression, type Numeral } from '../../src/core/harmony';
import { degreeName, letterName, pitchClassName, pitchClassOf } from '../../src/core/theory';

const progression = (text: string): Numeral[] => text.split(' ').map(t => {
  const r = parseNumeral(t);
  if ('error' in r) throw new Error(r.error);
  return r.numeral;
});
const names = (text: string, key: string) => {
  const p = progression(text);
  return p.map((_, bar) => chordAt(p, key, bar).name);
};

describe('chordAt', () => {
  it('gives the I, IV and V of a blues in A, each with a flat seventh', () => {
    const p = progression('I7 IV7 V7');
    const chords = p.map((_, bar) => chordAt(p, 'A', bar));
    expect(chords.map(c => c.name)).toEqual(['A7', 'D7', 'E7']);
    expect(chords.map(c => c.root)).toEqual([9, 2, 4]);
    for (const c of chords) expect(c.tones).toContain((c.root + 10) % 12);
  });
  it('reads numerals in a minor key from its tonic', () => {
    expect(names('i bVI bIII bVII', 'Am')).toEqual(['Am', 'F', 'C', 'G']);
    expect(names('i iv v7', 'Em')).toEqual(['Em', 'Am', 'Bm7']);
  });
  it('spells chords with flats in flat keys and for flat numerals', () => {
    expect(names('I7 IV7 V7', 'Bb')).toEqual(['Bb7', 'Eb7', 'F7']);
    expect(names('I bVII IV', 'C')).toEqual(['C', 'Bb', 'F']);
    expect(names('i bVI', 'Cm')).toEqual(['Cm', 'Ab']);
    expect(names('I #IVm7b5', 'C')).toEqual(['C', 'F#m7b5']);
    expect(names('I IV V', 'E')).toEqual(['E', 'A', 'B']);
    expect(names('I bVII bIII', 'E')).toEqual(['E', 'D', 'G']);
  });
  it('spells roots from the letter of the scale step in far keys', () => {
    expect(names('I IV V', 'Gb')).toEqual(['Gb', 'Cb', 'Db']);
    expect(names('I VII', 'F#')).toEqual(['F#', 'E#']);
    expect(names('I III', 'C#')).toEqual(['C#', 'E#']);
    expect(names('I', 'Cb')).toEqual(['Cb']);
    expect(names('I bII', 'Gb')).toEqual(['Gb', 'G']);
  });
  it('builds every quality', () => {
    const p = progression('I Imaj7 im7 Im7 vii7 viim7b5 viidim Isus4 I5 imaj7');
    expect(p.map((_, bar) => chordAt(p, 'C', bar).name)).toEqual(['C', 'Cmaj7', 'Cm7', 'Cm7', 'Bm7', 'Bm7b5', 'Bdim', 'Csus4', 'C5', 'Cm(maj7)']);
    expect(chordAt(p, 'C', 5).intervals).toEqual([0, 3, 6, 10]);
    expect(chordAt(p, 'C', 7).tones).toEqual([0, 5, 7]);
  });
  it('wraps the bar number around the progression', () => {
    const p = progression('I IV V');
    expect(chordAt(p, 'G', 4).name).toBe('C');
    expect(chordAt(p, 'G', -1).name).toBe('D');
  });
  it('does not share interval lists between chords', () => {
    const p = progression('I7');
    chordAt(p, 'A', 0).intervals.push(99);
    expect(chordAt(p, 'A', 0).intervals).toEqual([0, 4, 7, 10]);
  });
});

describe('parseNumeral', () => {
  it('names an unknown numeral', () => {
    expect(parseNumeral('IX')).toEqual({ error: expect.stringContaining('"IX"') });
  });
  it('names an unknown quality and the token', () => {
    const r = parseNumeral('V9');
    expect('error' in r && r.error).toMatch(/"9".*"V9"/);
  });
});

describe('degreeInterval', () => {
  it('follows the third and fifth of the chord', () => {
    const p = progression('I7 iim7b5 Isus4');
    const [dom, halfDim, sus] = p.map((_, bar) => chordAt(p, 'C', bar));
    expect(degreeInterval(dom, '3')).toBe(4);
    expect(degreeInterval(halfDim, '3')).toBe(3);
    expect(degreeInterval(halfDim, '5')).toBe(6);
    expect(degreeInterval(sus, '3')).toBe(5);
    expect(['1', '6', 'b7', '8'].map(d => degreeInterval(dom, d as '1'))).toEqual([0, 9, 10, 12]);
  });
  it('doubles the root for a third over a power chord, in major and minor', () => {
    const p = progression('I5 v5');
    const [major, minor] = p.map((_, bar) => chordAt(p, 'Am', bar));
    expect(degreeInterval(major, '3')).toBe(0);
    expect(degreeInterval(minor, '3')).toBe(0);
    expect(degreeInterval(minor, '5')).toBe(7);
  });
  it('plays the major seventh for b7 over a maj7 chord', () => {
    const p = progression('Imaj7 ii7');
    const [maj7, m7] = p.map((_, bar) => chordAt(p, 'C', bar));
    expect(degreeInterval(maj7, 'b7')).toBe(11);
    expect(degreeInterval(m7, 'b7')).toBe(10);
  });
});

describe('progression presets', () => {
  const chordNames = (numerals: Numeral[], key: string) => numerals.map((_, bar) => chordAt(numerals, key, bar).name);
  const preset = (slug: string, own = progression('I7 IV7')) => presetProgression(slug, own)!;

  it('offers the presets by name and keeps the groove progression as the default', () => {
    expect(PROGRESSION_PRESETS.map(p => p.name)).toEqual(['12 bar blues', 'Minor blues', 'I IV V', 'I V vi IV', 'i bVII bVI bVII', 'ii V I', 'One chord vamp']);
    expect(preset(OWN_PROGRESSION).map(n => n.text)).toEqual(['I7', 'IV7']);
    expect(presetProgression('polka', progression('I'))).toBeNull();
  });
  it('spells ii V I in Bb as Cm7, F7 and Bbmaj7, turning back through Gm7', () => {
    expect(chordNames(preset('ii-v-i'), 'Bb')).toEqual(['Cm7', 'F7', 'Bbmaj7', 'Bbmaj7', 'Cm7', 'F7', 'Bbmaj7', 'Gm7']);
  });
  it('spells the blues and minor presets in their keys', () => {
    expect(chordNames(preset('12-bar-blues'), 'A')).toEqual(['A7', 'D7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7']);
    expect(chordNames(preset('minor-blues'), 'Am').slice(8)).toEqual(['F7', 'E7', 'Am7', 'E7']);
    expect(chordNames(preset('i-bvii-bvi-bvii'), 'Em')).toEqual(['Em', 'D', 'C', 'D', 'C', 'C', 'D', 'D']);
    expect(chordNames(preset('i-v-vi-iv'), 'G')).toEqual(['G', 'D', 'Em', 'C', 'Em', 'C', 'G', 'D']);
    expect(chordNames(preset('i-iv-v'), 'C')).toEqual(['C', 'F', 'C', 'G', 'F', 'F', 'C', 'G']);
  });
  it('vamps on the first chord of the groove for eight bars', () => {
    expect(preset('one-chord', progression('i7 IV7')).map(n => n.text)).toEqual(Array(8).fill('i7'));
  });
  it('gives every preset at least eight bars, a second half of its own and a last bar away from home', () => {
    for (const { slug } of PROGRESSION_PRESETS.filter(p => p.slug !== 'one-chord')) {
      const bars = preset(slug).map(n => n.text);
      expect(bars.length, slug).toBeGreaterThanOrEqual(8);
      expect(bars.slice(4, 8), slug).not.toEqual(bars.slice(0, 4));
      expect(bars.at(-1), slug).not.toBe(bars[0]);
    }
  });
  it('tells a minor progression from its first chord', () => {
    expect(isMinorProgression(preset('minor-blues'))).toBe(true);
    expect(isMinorProgression(preset('i-bvii-bvi-bvii'))).toBe(true);
    expect(isMinorProgression(preset('ii-v-i'))).toBe(false);
    expect(isMinorProgression(preset('12-bar-blues'))).toBe(false);
  });
});

describe('pitch class names', () => {
  it('reads and spells pitch classes', () => {
    expect(['C', 'F#', 'Bb', 'Cb', 'H'].map(pitchClassOf)).toEqual([0, 6, 10, 11, null]);
    expect(['A', 'C#', 'E', 'G', 'G#', 'Bb'].map(note => degreeName('A', note))).toEqual(['1', '3', '5', 'b7', '7', 'b2']);
    expect(degreeName('Eb', 'Gb')).toBe('b3');
    expect(degreeName('D#', 'F##')).toBe('3');
    expect(letterName(7, 'D#', 2)).toBe('F##');
    expect(letterName(8, 'E', 2)).toBe('G#');
    expect(['F##', 'Bbb'].map(pitchClassOf)).toEqual([7, 9]);
    expect(pitchClassName(3, 'A')).toBe('D#');
    expect(pitchClassName(3, 'Bb')).toBe('Eb');
    expect(keyTonic('F#m')).toBe(6);
    expect(keyTonic('H')).toBeNull();
  });
});
