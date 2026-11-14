import { describe, expect, it } from 'vitest';
import { SCALES, isScaleId, rootName, scaleById, scaleNotes, scaleTitle, type ScaleId } from '../../src/core/scales';

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
