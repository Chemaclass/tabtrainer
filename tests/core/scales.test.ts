import { describe, expect, it } from 'vitest';
import { SCALES, isScaleId, rootName, scaleById, scaleChords, scaleNotes, scaleTitle, type ScaleId } from '../../src/core/scales';
import { parseNumeral } from '../../src/core/harmony';

const names = (root: number, id: ScaleId) => scaleNotes(root, id).map(n => n.name);

describe('scale table', () => {
  it('has a degree label for every interval', () => {
    for (const scale of SCALES) expect(scale.degrees).toHaveLength(scale.intervals.length);
  });
  it('knows the scale ids', () => {
    expect(isScaleId('blues')).toBe(true);
    expect(isScaleId('lydian')).toBe(false);
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
  });
  it('uses the parent scale for pentatonic and blues', () => {
    expect(chordNames(9, 'minor-pentatonic')).toEqual(chordNames(9, 'minor'));
    expect(chordNames(9, 'blues')).toEqual(chordNames(9, 'minor'));
    expect(chordNames(0, 'major-pentatonic')).toEqual(chordNames(0, 'major'));
  });
});
