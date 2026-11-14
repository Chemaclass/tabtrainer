import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FRETBOARD_CHOICE, ROOT_OPTIONS, fretboardSheet, isFretboardChoice, type FretboardChoice } from '../../src/app/fretboardSheet';
import { pref, setPref } from '../../src/app/storage';

const choice = (change: Partial<FretboardChoice>): FretboardChoice => ({ ...DEFAULT_FRETBOARD_CHOICE, ...change });
const aMinorPentatonic = choice({ root: 9, scale: 'minor-pentatonic' });
const marksOn = (c: FretboardChoice, stringIndex: number) => fretboardSheet(c).marks.filter(m => m.stringIndex === stringIndex);

afterEach(() => vi.unstubAllGlobals());

describe('fretboard choices', () => {
  it('starts on a 4 string bass, C major, note names', () => {
    expect(DEFAULT_FRETBOARD_CHOICE).toEqual({ root: 0, scale: 'major', instrument: 'bass4', labels: 'names' });
  });
  it('labels black keys with both names', () => {
    expect(ROOT_OPTIONS.map(o => o.label)).toEqual(['C', 'C# / Db', 'D', 'D# / Eb', 'E', 'F', 'F# / Gb', 'G', 'G# / Ab', 'A', 'A# / Bb', 'B']);
  });
  it('rejects damaged values', () => {
    expect(isFretboardChoice(DEFAULT_FRETBOARD_CHOICE)).toBe(true);
    expect(isFretboardChoice(null)).toBe(false);
    expect(isFretboardChoice('C')).toBe(false);
    expect(isFretboardChoice(choice({ root: 12 }))).toBe(false);
    expect(isFretboardChoice(choice({ root: 1.5 }))).toBe(false);
    expect(isFretboardChoice(choice({ scale: 'lydian' as FretboardChoice['scale'] }))).toBe(false);
    expect(isFretboardChoice(choice({ instrument: 'banjo' }))).toBe(false);
    expect(isFretboardChoice(choice({ instrument: 'toString' }))).toBe(false);
    expect(isFretboardChoice(choice({ labels: 'both' as FretboardChoice['labels'] }))).toBe(false);
  });
});

describe('the cheat sheet', () => {
  it('states the choice and its notes', () => {
    expect(fretboardSheet(aMinorPentatonic).summary).toBe('A minor pentatonic: A C D E G');
    expect(fretboardSheet(choice({ root: 1 })).title).toBe('Db major');
  });
  it('marks A minor pentatonic roots only where A sits', () => {
    const roots = fretboardSheet(aMinorPentatonic).marks.filter(m => m.role === 'root').map(m => [m.stringIndex, m.fret]);
    expect(roots).toEqual([[0, 2], [1, 7], [2, 0], [2, 12], [3, 5]]);
  });
  it('labels Eb major with flats only', () => {
    const marks = fretboardSheet(choice({ root: 3 })).marks;
    expect(marks.filter(m => m.stringIndex === 3).map(m => [m.fret, m.label])).toEqual([[1, 'F'], [3, 'G'], [4, 'Ab'], [6, 'Bb'], [8, 'C'], [10, 'D'], [11, 'Eb']]);
    expect(marks.some(m => ['G#', 'A#', 'D#'].includes(m.label))).toBe(false);
  });
  it('shows Eb in A blues at fret 6 of the A string', () => {
    expect(marksOn(choice({ root: 9, scale: 'blues' }), 2).find(m => m.fret === 6)?.label).toBe('Eb');
  });
  it('labels degrees on request', () => {
    expect(marksOn({ ...aMinorPentatonic, labels: 'degrees' }, 3).map(m => [m.fret, m.label])).toEqual([[0, '5'], [3, 'b7'], [5, '1'], [8, 'b3'], [10, '4'], [12, '5']]);
  });
  it('draws the strings of the chosen instrument', () => {
    const five = fretboardSheet({ ...aMinorPentatonic, instrument: 'bass5' });
    expect(five.openNames).toEqual(['G', 'D', 'A', 'E', 'B']);
    expect(five.marks.filter(m => m.stringIndex === 4).map(m => m.fret)).toEqual([1, 3, 5, 8, 10]);
    expect(fretboardSheet(choice({ instrument: 'guitar6' })).openNames).toHaveLength(6);
  });
  it('lists the marked frets of each string as text', () => {
    const sheet = fretboardSheet(aMinorPentatonic);
    expect(sheet.strings[3].text).toBe('E string: open E, fret 3 G, fret 5 A root, fret 8 C, fret 10 D, fret 12 E');
    expect(fretboardSheet({ ...aMinorPentatonic, labels: 'degrees' }).strings[3].text).toMatch(/^E string: open E \(5\), fret 3 G \(b7\), fret 5 A \(1\) root/);
    const guitar = fretboardSheet(choice({ instrument: 'guitar6' }));
    expect(guitar.strings.map(s => s.name)).toEqual(['high E string', 'B string', 'G string', 'D string', 'A string', 'low E string']);
    expect(sheet.description).toContain('A minor pentatonic');
  });
});

describe('saving the choice', () => {
  it('restores a saved choice and falls back on a damaged one', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual(DEFAULT_FRETBOARD_CHOICE);
    expect(setPref('fretboardSheet', aMinorPentatonic)).toBe(true);
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual(aMinorPentatonic);
    values.set('tabtrainer:fretboardSheet', '{"root":9,"scale":"minor-pentatonic","instrument":"bass4"}');
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual(DEFAULT_FRETBOARD_CHOICE);
    values.set('tabtrainer:fretboardSheet', '{bad');
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual(DEFAULT_FRETBOARD_CHOICE);
  });
});
