import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FRETBOARD_CHOICE, ROOT_OPTIONS, fretboardSheet, isFretboardChoice, stepPosition, type FretboardChoice } from '../../src/app/fretboardSheet';
import { pref, setPref } from '../../src/app/storage';

const choice = (change: Partial<FretboardChoice>): FretboardChoice => ({ ...DEFAULT_FRETBOARD_CHOICE, ...change });
const aMinorPentatonic = choice({ root: 9, scale: 'minor-pentatonic' });
const marksOn = (c: FretboardChoice, stringIndex: number) => fretboardSheet(c).marks.filter(m => m.stringIndex === stringIndex);

afterEach(() => vi.unstubAllGlobals());

describe('fretboard choices', () => {
  it('starts on a 4 string bass, C major, note names', () => {
    expect(DEFAULT_FRETBOARD_CHOICE).toEqual({ root: 0, scale: 'major', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: null });
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
    expect(isFretboardChoice(choice({ chord: 7 }))).toBe(false);
    expect(isFretboardChoice(choice({ chord: 1.5 }))).toBe(false);
    expect(isFretboardChoice(choice({ sevenths: 'yes' as unknown as boolean }))).toBe(false);
    expect(isFretboardChoice(choice({ position: 13 }))).toBe(false);
    expect(isFretboardChoice(choice({ position: -1 }))).toBe(false);
    expect(isFretboardChoice(choice({ chord: 6, sevenths: true, position: 12 }))).toBe(true);
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

const g = choice({ chord: 4 });
const rolesOn = (c: FretboardChoice, stringIndex: number, role: string) => marksOn(c, stringIndex).filter(m => m.role === role).map(m => m.fret);

describe('chords of the key', () => {
  it('lists the chords of C major with numerals', () => {
    const sheet = fretboardSheet(DEFAULT_FRETBOARD_CHOICE);
    expect(sheet.chords.map(c => c.name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(sheet.chords.map(c => c.numeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii']);
    expect(sheet.chord).toBeNull();
  });
  it('marks the tones of G stronger, with G as the root', () => {
    expect(rolesOn(g, 3, 'root')).toEqual([3]);
    expect(rolesOn(g, 3, 'tone')).toEqual([7, 10]);
    expect(rolesOn(g, 3, 'scale')).toEqual([0, 1, 5, 8, 12]);
    expect(fretboardSheet(g).summary).toBe('G in C major: G B D');
  });
  it('adds the seventh on request', () => {
    const g7 = fretboardSheet({ ...g, sevenths: true });
    expect(g7.chord?.name).toBe('G7');
    expect(g7.summary).toBe('G7 in C major: G B D F');
    expect(rolesOn({ ...g, sevenths: true }, 3, 'tone')).toEqual([1, 7, 10]);
  });
  it('goes back to the plain scale with no chord', () => {
    expect(fretboardSheet(choice({ chord: null })).marks.some(m => m.role === 'tone')).toBe(false);
    expect(fretboardSheet(choice({ chord: null })).summary).toBe('C major: C D E F G A B');
  });
  it('marks chord tones the pentatonic leaves out', () => {
    const f = fretboardSheet({ ...aMinorPentatonic, chord: 5 });
    expect(f.summary).toBe('F in A minor pentatonic: F A C');
    expect(rolesOn({ ...aMinorPentatonic, chord: 5 }, 3, 'root')).toEqual([1]);
    expect(marksOn({ ...aMinorPentatonic, chord: 5, labels: 'degrees' }, 3).find(m => m.fret === 1)?.label).toBe('b6');
  });
  it('names chord tones in the text list', () => {
    expect(fretboardSheet(g).strings[3].text).toBe('E string: open E, fret 1 F, fret 3 G chord root, fret 5 A, fret 7 B chord tone, fret 8 C, fret 10 D chord tone, fret 12 E');
  });
});

describe('playing positions', () => {
  const position5 = { ...aMinorPentatonic, position: 5 };
  it('keeps the window at full strength and dims the rest', () => {
    const marks = fretboardSheet(position5).marks;
    const full = marks.filter(m => !m.dimmed).map(m => [m.stringIndex, m.fret]);
    expect(full).toEqual([[0, 5], [0, 7], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 8]]);
    expect(marks.filter(m => m.dimmed)).toHaveLength(marks.length - 8);
    expect(fretboardSheet(position5).window).toEqual({ first: 5, last: 8 });
  });
  it('shows every fret at full strength with no position', () => {
    expect(fretboardSheet(aMinorPentatonic).marks.some(m => m.dimmed)).toBe(false);
    expect(fretboardSheet(aMinorPentatonic).window).toBeNull();
  });
  it('steps to the next and previous scale note of the lowest string', () => {
    const { windows } = fretboardSheet(position5);
    expect(stepPosition(windows, 5, 1)).toBe(8);
    expect(stepPosition(windows, 5, -1)).toBe(3);
    expect(stepPosition(windows, 0, -1)).toBeUndefined();
    expect(stepPosition(windows, 10, 1)).toBeUndefined();
    expect(windows.slice(-2)).toEqual([{ first: 8, last: 12 }, { first: 10, last: 12 }]);
    expect(stepPosition(windows, null, 1)).toBe(0);
    expect(stepPosition(windows, null, -1)).toBe(10);
  });
  it('moves a saved position that is not a scale note to the nearest one', () => {
    expect(fretboardSheet({ ...aMinorPentatonic, position: 6 }).window).toEqual({ first: 5, last: 8 });
    expect(stepPosition(fretboardSheet(aMinorPentatonic).windows, 6, 1)).toBe(8);
  });
  it('lists only the frets of the position as text', () => {
    const sheet = fretboardSheet(position5);
    expect(sheet.strings[3].text).toBe('E string: fret 5 A root, fret 8 C');
    expect(sheet.description).toContain('frets 5 to 8 at full strength');
    expect(sheet.summary).toBe('A minor pentatonic: A C D E G; frets 5 to 8');
    expect(fretboardSheet({ ...position5, chord: 4 }).summary).toBe('Em in A minor pentatonic: E G B; frets 5 to 8');
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
    values.set('tabtrainer:fretboardSheet', '{"root":9,"scale":"minor-pentatonic","instrument":"bass4","labels":"degrees"}');
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual({ ...aMinorPentatonic, labels: 'degrees' });
    values.set('tabtrainer:fretboardSheet', '{bad');
    expect(pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE)).toEqual(DEFAULT_FRETBOARD_CHOICE);
  });
});
