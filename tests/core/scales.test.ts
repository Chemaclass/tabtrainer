import { describe, expect, it } from 'vitest';
import { SCALES, isScaleId, rootName, scaleById, scaleChords, scaleNotes, scaleTitle, type ScaleId } from '../../src/core/scales';
import { parseNumeral } from '../../src/core/harmony';
import { scaleStepName } from '../../src/core/theory';

const names = (root: number, id: ScaleId) => scaleNotes(root, id).map(n => n.name);

describe('scale table', () => {
  it('has a degree label for every interval', () => {
    for (const scale of SCALES) expect(scale.degrees).toHaveLength(scale.intervals.length);
  });
  it('knows the scale ids', () => {
    expect(isScaleId('blues')).toBe(true);
    expect(isScaleId('lydian')).toBe(true);
    expect(isScaleId('locrian')).toBe(false);
    expect(isScaleId(3)).toBe(false);
    expect(() => scaleById('nope' as ScaleId)).toThrow();
  });
});

describe('scale notes', () => {
  it('builds C major with the root marked', () => {
    const notes = scaleNotes(0, 'major');
    expect(notes.map(n => n.name)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(notes.filter(n => n.root).map(n => n.name)).toEqual(['C']);
  });
  it('builds A minor pentatonic with its degrees', () => {
    const notes = scaleNotes(9, 'minor-pentatonic');
    expect(notes.map(n => n.name)).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(notes.map(n => n.degree)).toEqual(['1', 'b3', '4', '5', 'b7']);
    expect(notes.map(n => n.pitchClass)).toEqual([9, 0, 2, 4, 7]);
  });
  it('spells Eb major with flats only', () => {
    expect(names(3, 'major')).toEqual(['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D']);
  });
  it('spells with the sharps or flats of the parent major key', () => {
    expect(names(1, 'major')).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']);
    expect(names(1, 'minor')).toEqual(['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B']);
    expect(names(7, 'minor')).toEqual(['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F']);
    expect(names(2, 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(names(0, 'dorian')).toEqual(['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']);
    expect(names(7, 'mixolydian')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F']);
    expect(names(4, 'mixolydian')).toEqual(['E', 'F#', 'G#', 'A', 'B', 'C#', 'D']);
    expect(names(4, 'major-pentatonic')).toEqual(['E', 'F#', 'G#', 'B', 'C#']);
  });
  it('spells each step from its letter in sharp keys', () => {
    expect(names(6, 'major')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(names(3, 'minor')).toEqual(['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#']);
    expect(names(1, 'mixolydian')).toEqual(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B']);
    expect(names(8, 'dorian')).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#']);
    expect(names(6, 'major-pentatonic')).toEqual(['F#', 'G#', 'A#', 'C#', 'D#']);
  });
  it('spells C# major with B# through the shared step speller', () => {
    expect([0, 2, 4, 5, 7, 9, 11].map((interval, step) => scaleStepName(1 + interval, 'C#', step)))
      .toEqual(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#']);
  });
  it('uses each letter once and never mixes sharps with flats, apart from the raised seventh of harmonic minor', () => {
    const isRaisedSeventh = (id: ScaleId, degree: string) => id === 'harmonic-minor' && degree === '7';
    for (const scale of SCALES) {
      for (let root = 0; root < 12; root++) {
        const spelled = names(root, scale.id);
        const keySignatureNotes = scaleNotes(root, scale.id).filter(n => !isRaisedSeventh(scale.id, n.degree));
        const accidentals = new Set(keySignatureNotes.map(n => n.name.slice(1)).filter(Boolean));
        expect(accidentals.size, `${root} ${scale.id}: ${spelled}`).toBeLessThanOrEqual(1);
        if (scale.intervals.length === 7) expect(new Set(spelled.map(n => n[0])).size, `${root} ${scale.id}: ${spelled}`).toBe(7);
      }
    }
  });
  it('spells Phrygian, Lydian and harmonic minor from their parent keys', () => {
    expect(names(4, 'phrygian')).toEqual(['E', 'F', 'G', 'A', 'B', 'C', 'D']);
    expect(names(0, 'lydian')).toEqual(['C', 'D', 'E', 'F#', 'G', 'A', 'B']);
    expect(names(5, 'lydian')).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E']);
    expect(names(9, 'harmonic-minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    expect(names(0, 'harmonic-minor')).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B']);
    expect(names(2, 'harmonic-minor')).toEqual(['D', 'E', 'F', 'G', 'A', 'Bb', 'C#']);
    expect(names(8, 'harmonic-minor')).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F##']);
  });
  it('always spells the added blues note as a flat', () => {
    expect(names(9, 'blues')).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
    expect(names(4, 'blues')).toEqual(['E', 'G', 'A', 'Bb', 'B', 'D']);
  });
});

describe('scale titles', () => {
  it('names the root with the same rule', () => {
    expect(rootName(1, 'major')).toBe('Db');
    expect(rootName(1, 'minor')).toBe('C#');
    expect(scaleTitle(1, 'major')).toBe('Db major');
    expect(scaleTitle(1, 'minor')).toBe('C# minor');
    expect(scaleTitle(9, 'minor-pentatonic')).toBe('A minor pentatonic');
  });
});

const chordNames = (root: number, id: ScaleId, sevenths = false) => scaleChords(root, id, sevenths).map(c => c.name);
const numerals = (root: number, id: ScaleId, sevenths = false) => scaleChords(root, id, sevenths).map(c => c.numeral);

describe('scale chords', () => {
  it('builds the seven chords of C major', () => {
    expect(chordNames(0, 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(numerals(0, 'major')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii']);
  });
  it('stacks a seventh on request', () => {
    const g = scaleChords(0, 'major', true)[4];
    expect(g.name).toBe('G7');
    expect(g.tones.map(t => t.name)).toEqual(['G', 'B', 'D', 'F']);
    expect(chordNames(0, 'major', true)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
    expect(numerals(0, 'major', true)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viim7b5']);
  });
  it('writes minor and modal numerals against the major scale', () => {
    expect(chordNames(9, 'minor')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(numerals(9, 'minor')).toEqual(['i', 'ii', 'bIII', 'iv', 'v', 'bVI', 'bVII']);
    expect(numerals(2, 'dorian')).toEqual(['i', 'ii', 'bIII', 'IV', 'v', 'vi', 'bVII']);
    expect(numerals(7, 'mixolydian')).toEqual(['I', 'ii', 'iii', 'IV', 'v', 'vi', 'bVII']);
  });
  it('writes seventh numerals the groove format reads back', () => {
    for (const chord of scaleChords(9, 'minor', true)) {
      expect(parseNumeral(chord.numeral)).toMatchObject({ numeral: { quality: chord.quality, degree: (chord.root.pitchClass - 9 + 12) % 12 } });
    }
  });
  it('spells chords with the scale spelling', () => {
    expect(chordNames(3, 'major')).toEqual(['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim']);
    expect(chordNames(6, 'major')).toEqual(['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim']);
    expect(chordNames(6, 'major', true)[6]).toBe('E#m7b5');
  });
  it('builds the chords of the new scales, augmented third included', () => {
    expect(chordNames(4, 'phrygian')).toEqual(['Em', 'F', 'G', 'Am', 'Bdim', 'C', 'Dm']);
    expect(numerals(4, 'phrygian')).toEqual(['i', 'bII', 'bIII', 'iv', 'v', 'bVI', 'bvii']);
    expect(chordNames(0, 'lydian')).toEqual(['C', 'D', 'Em', 'F#dim', 'G', 'Am', 'Bm']);
    expect(numerals(0, 'lydian')).toEqual(['I', 'II', 'iii', '#iv', 'V', 'vi', 'vii']);
    expect(chordNames(9, 'harmonic-minor')).toEqual(['Am', 'Bdim', 'Caug', 'Dm', 'E', 'F', 'G#dim']);
    expect(chordNames(9, 'harmonic-minor', true)).toEqual(['Am(maj7)', 'Bm7b5', 'Cmaj7#5', 'Dm7', 'E7', 'Fmaj7', 'G#dim7']);
  });
  it('uses the parent scale for pentatonic and blues', () => {
    expect(chordNames(9, 'minor-pentatonic')).toEqual(chordNames(9, 'minor'));
    expect(chordNames(9, 'blues')).toEqual(chordNames(9, 'minor'));
    expect(chordNames(0, 'major-pentatonic')).toEqual(chordNames(0, 'major'));
  });
});
