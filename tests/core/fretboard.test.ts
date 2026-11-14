import { describe, expect, it } from 'vitest';
import { fretboardPositions, positionWindows } from '../../src/core/fretboard';
import { INSTRUMENTS } from '../../src/core/instruments';
import { scaleNotes } from '../../src/core/scales';

const aMinorPentatonic = scaleNotes(9, 'minor-pentatonic').map(n => n.pitchClass);
const fretsOn = (tuning: number[], stringIndex: number, first = 0, last = 12) =>
  fretboardPositions(tuning, aMinorPentatonic, first, last).filter(p => p.stringIndex === stringIndex).map(p => p.fret);

describe('fretboard positions', () => {
  it('finds A minor pentatonic on a 4 string bass', () => {
    const tuning = INSTRUMENTS.bass4.tuning;
    expect(fretsOn(tuning, 3)).toEqual([0, 3, 5, 8, 10, 12]);
    expect(fretsOn(tuning, 2)).toEqual([0, 3, 5, 7, 10, 12]);
    expect(fretsOn(tuning, 1)).toEqual([0, 2, 5, 7, 10, 12]);
    expect(fretsOn(tuning, 0)).toEqual([0, 2, 5, 7, 9, 12]);
  });
  it('adds the low B string of a 5 string bass', () => {
    expect(fretsOn(INSTRUMENTS.bass5.tuning, 4)).toEqual([1, 3, 5, 8, 10]);
  });
  it('returns the midi note and pitch class of each match', () => {
    const [first] = fretboardPositions(INSTRUMENTS.bass4.tuning, [9], 0, 12);
    expect(first).toEqual({ stringIndex: 0, fret: 2, midi: INSTRUMENTS.bass4.tuning[0] + 2, pitchClass: 9 });
  });
  it('keeps to the fret range and never goes below the open string', () => {
    expect(fretsOn(INSTRUMENTS.bass4.tuning, 3, 5, 8)).toEqual([5, 8]);
    expect(fretboardPositions([40], [4], -3, 0).map(p => p.fret)).toEqual([0]);
  });
  it('accepts pitch classes outside 0 to 11', () => {
    expect(fretboardPositions([40], [16], 0, 12).map(p => p.fret)).toEqual([0, 12]);
  });
});

describe('position windows', () => {
  const bass = INSTRUMENTS.bass4.tuning;
  it('starts a window on each scale note of the lowest string', () => {
    expect(positionWindows(bass, aMinorPentatonic, 0, 11)).toEqual([
      { first: 0, last: 3 }, { first: 3, last: 7 }, { first: 5, last: 8 }, { first: 8, last: 12 }, { first: 10, last: 13 },
    ]);
  });
  it('stretches to 5 frets when 4 frets miss a scale note', () => {
    const cMajor = scaleNotes(0, 'major').map(n => n.pitchClass);
    expect(positionWindows(bass, cMajor, 8, 8)).toEqual([{ first: 8, last: 12 }]);
    expect(positionWindows(bass, cMajor, 5, 5)).toEqual([{ first: 5, last: 8 }]);
  });
  it('finds the lowest string wherever the tuning puts it', () => {
    expect(positionWindows(INSTRUMENTS.bass5.tuning, aMinorPentatonic, 0, 4).map(w => w.first)).toEqual([1, 3]);
    expect(positionWindows(INSTRUMENTS.ukulele.tuning, aMinorPentatonic, 0, 4).map(w => w.first)).toEqual([0, 2, 4]);
    expect(positionWindows([], aMinorPentatonic, 0, 12)).toEqual([]);
  });
});
