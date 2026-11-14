import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FRETBOARD_CHOICE, ROOT_OPTIONS, fretboardSheet, isFretboardChoice, stepPosition, withOfferedMove, type FretboardChoice } from '../../src/app/fretboardSheet';
import { pref, setPref } from '../../src/app/storage';

const choice = (change: Partial<FretboardChoice>): FretboardChoice => ({ ...DEFAULT_FRETBOARD_CHOICE, ...change });
const aMinorPentatonic = choice({ root: 9, scale: 'minor-pentatonic' });
const marksOn = (c: FretboardChoice, stringIndex: number) => fretboardSheet(c).marks.filter(m => m.stringIndex === stringIndex);

afterEach(() => vi.unstubAllGlobals());

describe('fretboard choices', () => {
  it('starts on a 4 string bass, C major, note names', () => {
    expect(DEFAULT_FRETBOARD_CHOICE).toEqual({ root: 0, scale: 'major', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: null, progression: null, bar: null, move: null });
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

describe('progressions on the cheat sheet', () => {
  const aMinor = choice({ root: 9, scale: 'minor' });
  const am = { ...aMinor, progression: 'minor-i-iv-v', bar: 0 };
  const ordered = (c: FretboardChoice) => fretboardSheet(c).marks.filter(m => m.order).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(m => [m.stringIndex, m.fret, m.label]);

  it('lists the progressions of the key with real chord names', () => {
    const sheet = fretboardSheet(DEFAULT_FRETBOARD_CHOICE);
    expect(sheet.progressions.find(p => p.slug === 'i-v-vi-iv')?.chords.map(c => c.name)).toEqual(['C', 'G', 'Am', 'F']);
    expect(fretboardSheet(choice({ scale: 'dorian' })).progressions).toEqual([]);
  });
  it('selects a progression chord and marks its tones', () => {
    const c: FretboardChoice = { ...DEFAULT_FRETBOARD_CHOICE, progression: 'i-v-vi-iv', bar: 2 };
    const sheet = fretboardSheet(c);
    expect(sheet.chord?.name).toBe('Am');
    expect(sheet.summary).toBe('Am in C major: A C E');
    expect(rolesOn(c, 3, 'root')).toEqual([5]);
    expect(sheet.next?.name).toBe('F');
  });
  it('marks chord tones outside the scale, as C# in A7 of the A blues', () => {
    const c: FretboardChoice = { ...choice({ root: 9, scale: 'blues' }), progression: '12-bar-blues', bar: 0 };
    expect(fretboardSheet(c).summary).toBe('A7 in A blues: A C# E G');
    expect(marksOn(c, 2).find(m => m.fret === 4)).toMatchObject({ label: 'C#', role: 'tone' });
  });
  it('ignores a progression the scale does not list', () => {
    expect(fretboardSheet({ ...DEFAULT_FRETBOARD_CHOICE, progression: '12-bar-blues', bar: 0 }).chord).toBeNull();
  });
  it('offers the walks only for a progression chord', () => {
    expect(fretboardSheet(choice({ chord: 0 })).moves.map(m => m.id)).toEqual(['root-fifth', 'root-fifth-octave', 'arpeggio', 'root-fifth-below']);
    expect(fretboardSheet(am).moves.map(m => m.id)).toContain('approach-scale');
    expect(fretboardSheet(choice({})).moves).toEqual([]);
    expect(fretboardSheet(am).moves[0]).toEqual({ id: 'root-fifth', name: 'Root and fifth', when: 'Safe under any major or minor chord.' });
  });
  it('numbers Am root, fifth, octave in position 5 on a 4 string bass', () => {
    expect(ordered({ ...am, position: 5, move: 'root-fifth-octave' })).toEqual([[3, 5, '1'], [2, 7, '2'], [1, 7, '3']]);
    expect(fretboardSheet({ ...am, position: 5, move: 'root-fifth-octave' }).move?.text).toBe('Root, fifth, octave: 1 E string fret 5 A, 2 A string fret 7 E, 3 D string fret 7 A');
  });
  it('numbers the Am triad arpeggio in position 5 as A C E A', () => {
    expect(ordered({ ...am, position: 5, move: 'arpeggio' })).toEqual([[3, 5, '1'], [3, 8, '2'], [2, 7, '3'], [1, 7, '4']]);
  });
  it('dims every mark outside the move', () => {
    expect(fretboardSheet({ ...am, position: 5, move: 'arpeggio' }).marks.filter(m => !m.dimmed)).toHaveLength(4);
  });
  it('walks from Am to Dm through C# on A string fret 4', () => {
    const c: FretboardChoice = { ...am, move: 'approach-below' };
    expect(ordered(c)).toEqual([[3, 5, '1'], [2, 4, '2'], [2, 5, '3']]);
    expect(fretboardSheet(c).move?.text).toBe('Half step below: 1 E string fret 5 A, 2 A string fret 4 C#, 3 A string fret 5 D');
    expect(fretboardSheet({ ...am, move: 'approach-above' }).move?.text).toBe('Half step above: 1 A string open A, 2 D string fret 1 Eb, 3 D string open D');
  });
  it('says when a move does not fit the position and offers the nearest one that fits', () => {
    const e7: FretboardChoice = { ...aMinor, progression: 'minor-ii-v-i', bar: 1, move: 'arpeggio' };
    const sheet = fretboardSheet({ ...e7, position: 5 });
    expect(sheet.move?.notes).toBeNull();
    expect(sheet.move?.fits).toEqual({ first: 8, last: 12 });
    expect(sheet.move?.text).toBe('Seventh arpeggio does not fit frets 5 to 8. It fits frets 8 to 12.');
    expect(ordered({ ...e7, position: 8 })).toEqual([[3, 12, '1'], [2, 11, '2'], [1, 9, '3'], [1, 12, '4'], [0, 9, '5']]);
  });
  it('names the flat fifth of a half diminished chord', () => {
    expect(fretboardSheet({ ...aMinor, progression: 'minor-ii-v-i', bar: 0 }).moves[0].name).toBe('Root and flat fifth');
  });
  it('drops a saved walk once the chord has no next chord', () => {
    const walking: FretboardChoice = { ...am, move: 'approach-below' };
    expect(withOfferedMove(walking)).toBe(walking);
    expect(withOfferedMove({ ...walking, progression: null, bar: null, chord: 0 }).move).toBeNull();
    expect(withOfferedMove({ ...am, move: 'arpeggio', progression: null, bar: null, chord: 0 }).move).toBe('arpeggio');
  });
  it('rejects unknown progressions, bars and moves', () => {
    expect(isFretboardChoice({ ...am, move: 'slap' })).toBe(false);
    expect(isFretboardChoice({ ...am, progression: 'bossa' })).toBe(false);
    expect(isFretboardChoice({ ...am, bar: 12 })).toBe(false);
    expect(isFretboardChoice({ ...am, move: 'approach-scale' })).toBe(true);
  });
});
