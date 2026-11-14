import { describe, expect, it } from 'vitest';
import { isMoveId, moveShapes, placeMove, type MoveId, type Walk } from '../../src/core/bassMoves';
import { INSTRUMENTS } from '../../src/core/instruments';

const A = 9, C = 0, D = 2, E = 4;
const MINOR = { intervals: [0, 3, 7] }, MAJOR = { intervals: [0, 4, 7] }, DOM7 = { intervals: [0, 4, 7, 10] }, HALF_DIM = { intervals: [0, 3, 6, 10] };
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
const amToDm: Walk = { from: A, to: D, scale: A_MINOR };

const frets = (instrument: string, root: number, id: MoveId, chord: { intervals: number[] }, first: number, last: number, walk: Walk | null = null) =>
  placeMove(INSTRUMENTS[instrument].tuning, root, moveShapes(id, chord, walk), first, last)?.map(n => [n.stringIndex, n.fret, n.order]) ?? null;

// String indexes count from string 1: on a 4 string bass G is 0 and E is 3.
describe('move shapes', () => {
  it('lists the notes of each move in playing order', () => {
    expect(moveShapes('root-fifth', MINOR, null)).toEqual([[0, 7]]);
    expect(moveShapes('root-fifth-octave', MAJOR, null)).toEqual([[0, 7, 12]]);
    expect(moveShapes('arpeggio', MINOR, null)).toEqual([[0, 3, 7, 12]]);
    expect(moveShapes('arpeggio', DOM7, null)).toEqual([[0, 4, 7, 10, 12]]);
    expect(moveShapes('root-fifth-below', MINOR, null)).toEqual([[0, -5]]);
  });
  it('keeps the flat fifth of a half diminished chord', () => {
    expect(moveShapes('root-fifth', HALF_DIM, null)).toEqual([[0, 6]]);
  });
  it('walks to the nearer copy of the next root first', () => {
    expect(moveShapes('approach-below', MINOR, amToDm)).toEqual([[0, 4, 5], [0, -8, -7]]);
    expect(moveShapes('approach-above', MINOR, amToDm)).toEqual([[0, 6, 5], [0, -6, -7]]);
    expect(moveShapes('approach-scale', MINOR, amToDm)).toEqual([[0, 7, 5], [0, -5, -7]]);
  });
  it('takes the scale step below when the step above is a half step', () => {
    expect(moveShapes('approach-scale', MINOR, { from: D, to: E, scale: A_MINOR })).toEqual([[0, 2], [0, -12, -10]]);
    expect(moveShapes('approach-scale', MAJOR, { from: 7, to: 9, scale: A_MINOR })).toEqual([[0, 4, 2], [0, -8, -10]]);
  });
  it('comes from below when the scale step above the next root is the current root', () => {
    expect(moveShapes('approach-scale', MINOR, { from: A, to: 7, scale: A_MINOR })).toEqual([[0, -4, -2], [0, 8, 10]]);
  });
  it('has no walk without a chord change', () => {
    expect(moveShapes('approach-below', MINOR, null)).toEqual([]);
    expect(moveShapes('approach-below', MINOR, { from: A, to: A, scale: A_MINOR })).toEqual([]);
  });
  it('knows its ids', () => {
    expect(isMoveId('arpeggio')).toBe(true);
    expect(isMoveId('slap')).toBe(false);
  });
});

describe('moves on a 4 string bass', () => {
  it('plays Am root, fifth, octave in position 5 from E string fret 5', () => {
    expect(frets('bass4', A, 'root-fifth-octave', MINOR, 5, 8)).toEqual([[3, 5, 1], [2, 7, 2], [1, 7, 3]]);
  });
  it('plays the Am triad arpeggio in position 5 as A C E A', () => {
    expect(frets('bass4', A, 'arpeggio', MINOR, 5, 8)).toEqual([[3, 5, 1], [3, 8, 2], [2, 7, 3], [1, 7, 4]]);
  });
  it('walks from Am to Dm through C# on A string fret 4', () => {
    expect(frets('bass4', A, 'approach-below', MINOR, 0, 12, amToDm)).toEqual([[3, 5, 1], [2, 4, 2], [2, 5, 3]]);
    expect(frets('bass4', A, 'approach-above', MINOR, 0, 12, amToDm)).toEqual([[2, 0, 1], [1, 1, 2], [1, 0, 3]]);
    expect(frets('bass4', A, 'approach-scale', MINOR, 0, 12, amToDm)).toEqual([[2, 0, 1], [1, 2, 2], [1, 0, 3]]);
  });
  it('moves the walk up an octave when C# has no fret in position 5', () => {
    expect(frets('bass4', A, 'approach-below', MINOR, 5, 8, amToDm)).toEqual([[1, 7, 1], [0, 6, 2], [0, 7, 3]]);
  });
  it('puts the fifth below on the same fret, one string lower', () => {
    expect(frets('bass4', A, 'root-fifth-below', MINOR, 5, 8)).toEqual([[1, 7, 1], [2, 7, 2]]);
    expect(frets('bass4', E, 'root-fifth-below', DOM7, 0, 12)).toEqual([[1, 2, 1], [2, 2, 2]]);
  });
  it('plays root and fifth with an open string when it is the most compact', () => {
    expect(frets('bass4', A, 'root-fifth', MINOR, 0, 12)).toEqual([[2, 0, 1], [1, 2, 2]]);
  });
  it('returns null when the move does not fit the frets', () => {
    expect(frets('bass4', E, 'arpeggio', DOM7, 0, 3)).toBeNull();
    expect(frets('bass4', C, 'root-fifth-octave', MAJOR, 1, 4)).toBeNull();
  });
});

describe('moves on a 5 string bass', () => {
  it('uses the low B string', () => {
    expect(frets('bass5', C, 'root-fifth-octave', MAJOR, 1, 4)).toEqual([[4, 1, 1], [3, 3, 2], [2, 3, 3]]);
  });
  it('plays the Am arpeggio in position 5 like a 4 string bass', () => {
    expect(frets('bass5', A, 'arpeggio', MINOR, 5, 8)).toEqual([[3, 5, 1], [3, 8, 2], [2, 7, 3], [1, 7, 4]]);
  });
});

describe('moves on a guitar', () => {
  it('plays the Am arpeggio in position 5 across the top four strings', () => {
    expect(frets('guitar6', A, 'arpeggio', MINOR, 5, 8)).toEqual([[3, 7, 1], [2, 5, 2], [1, 5, 3], [0, 5, 4]]);
  });
  it('plays root and fifth below with the fifth one string lower', () => {
    expect(frets('guitar6', A, 'root-fifth-below', MINOR, 5, 8)).toEqual([[3, 7, 1], [4, 7, 2]]);
  });
  it('walks from Am to Dm on the low strings', () => {
    expect(frets('guitar6', A, 'approach-below', MINOR, 0, 12, amToDm)).toEqual([[5, 5, 1], [4, 4, 2], [4, 5, 3]]);
  });
});
