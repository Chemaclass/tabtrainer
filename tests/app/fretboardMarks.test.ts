import { describe, expect, it } from 'vitest';
import { fretMarks, fretboardDescription, markRole, markedPositions, notesByPitchClass } from '../../src/app/fretboardMarks';
import { INSTRUMENTS } from '../../src/core/instruments';
import type { ScaleNote } from '../../src/core/scales';

const note = (pitchClass: number, name: string, degree: string, root = false): ScaleNote => ({ pitchClass, name, degree, root });
const A = note(9, 'A', '1', true);
const C = note(0, 'C', 'b3');
const C_SHARP = note(1, 'C#', '3');
const E = note(4, 'E', '5');
const B_SHARP = note(0, 'B#', '7');

describe('fretboard marks', () => {
  it('spells a pitch shared by the chord and the scale as the scale does', () => {
    const notes = notesByPitchClass([B_SHARP, E], [A, C, E]);
    expect(notes.get(0)?.name).toBe('C');
    expect([...notes.keys()].sort((a, b) => a - b)).toEqual([0, 4, 9]);
  });
  it('marks the scale root without a chord and the chord root and tones with one', () => {
    expect(markRole(A, null)).toBe('root');
    expect(markRole(C, null)).toBe('scale');
    const aMajor = { root: 9, tones: [9, 1, 4] };
    expect([A, C_SHARP, E, C].map(n => markRole(n, aMajor))).toEqual(['root', 'tone', 'tone', 'scale']);
  });
  it('labels with names or degrees and dims only the frets asked for', () => {
    const notes = notesByPitchClass([], [A, C, E]);
    const positions = markedPositions(INSTRUMENTS.bass4, notes);
    const open = fretMarks(positions, { notes, chord: null, labels: 'degrees' });
    expect(open.find(mark => mark.stringIndex === 3 && mark.fret === 5)).toEqual({ stringIndex: 3, fret: 5, label: '1', role: 'root', dimmed: false });
    const windowed = fretMarks(positions, { notes, chord: null, labels: 'names', isDimmed: fret => fret > 7 });
    expect(windowed.filter(mark => mark.dimmed).every(mark => mark.fret > 7)).toBe(true);
    expect(windowed.some(mark => mark.dimmed)).toBe(true);
  });
  it('describes the drawing with the chord and the position when given', () => {
    expect(fretboardDescription(INSTRUMENTS.bass4, 'A minor', null)).toBe('Fretboard of the Bass (4-string, E A D G), frets 0 to 12, with the notes of A minor marked');
    expect(fretboardDescription(INSTRUMENTS.bass4, 'A minor', 'Am', 'frets 5 to 8 at full strength')).toBe('Fretboard of the Bass (4-string, E A D G), frets 0 to 12, with the notes of A minor marked, the tones of Am stronger, frets 5 to 8 at full strength');
  });
});
