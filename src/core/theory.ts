const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);

export const ROOT = 0;
export const HALF_STEP = 1;
export const MAJOR_SECOND = 2;
export const MINOR_THIRD = 3;
export const PERFECT_FOURTH = 5;
export const FLAT_FIFTH = 6;
export const PERFECT_FIFTH = 7;
export const SHARP_FIFTH = 8;
export const MAJOR_SIXTH = 9;
export const MINOR_SEVENTH = 10;
export const OCTAVE = 12;
export const MAJOR_SCALE: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

export const pitchClass = (n: number) => ((n % OCTAVE) + OCTAVE) % OCTAVE;

export const spellPitchClass = (pc: number, flats: boolean) => (flats ? FLAT : SHARP)[pitchClass(pc)];

export function pitchClassName(pc: number, key: string): string {
  return spellPitchClass(pc, FLAT_KEYS.has(key));
}

const LETTERS = 'CDEFGAB';
const LETTER_COUNT = LETTERS.length;
/** The accidental that turns a natural letter into a note this many semitones above it. */
export const SINGLE_ACCIDENTALS: Readonly<Record<number, string>> = { 0: '', 1: '#', 11: 'b' };
const ACCIDENTALS: Readonly<Record<number, string>> = { ...SINGLE_ACCIDENTALS, 2: '##', 10: 'bb' };
export const ACCIDENTAL_SHIFTS: Readonly<Record<string, number>> = { '##': 2, '#': 1, bb: -2, b: -1 };

/** The letter index letterSteps letters above the letter of noteName. */
const letterAbove = (noteName: string, letterSteps: number) => (LETTERS.indexOf(noteName[0]) + letterSteps) % LETTER_COUNT;

// C major has no sharps or flats, so its steps are the pitch classes of the natural letters
const semitonesAboveLetter = (pc: number, letter: number) => pitchClass(pc - MAJOR_SCALE[letter]);

export function scaleStepName(pc: number, key: string, step: number): string {
  const letter = letterAbove(key, step);
  const accidental = SINGLE_ACCIDENTALS[semitonesAboveLetter(pc, letter)];
  if (accidental === undefined) return pitchClassName(pc, key);
  return LETTERS[letter] + accidental;
}

/** The note letterSteps letters above fromName, with up to two sharps or flats: the third of D# is F##. */
export function letterName(pc: number, fromName: string, letterSteps: number): string {
  const letter = letterAbove(fromName, letterSteps);
  return LETTERS[letter] + (ACCIDENTALS[semitonesAboveLetter(pc, letter)] ?? '');
}

/** The degree of a spelled note above a spelled root, measured on the major scale: G# above A is "7", G is "b7". */
export function degreeName(rootName: string, noteName: string): string {
  const letterSteps = (LETTERS.indexOf(noteName[0]) - LETTERS.indexOf(rootName[0]) + LETTER_COUNT) % LETTER_COUNT;
  const semitones = pitchClass((pitchClassOf(noteName) ?? 0) - (pitchClassOf(rootName) ?? 0));
  const majorScaleSemitones = MAJOR_SCALE[letterSteps];
  const accidental = ACCIDENTALS[pitchClass(semitones - majorScaleSemitones)] ?? '';
  return `${accidental}${letterSteps + 1}`;
}

export function pitchClassOf(name: string): number | null {
  const r = /^([A-G])(##|#|bb|b)?$/.exec(name);
  if (!r) return null;
  const pc = SHARP.indexOf(r[1]);
  const shift = ACCIDENTAL_SHIFTS[r[2] ?? ''] ?? 0;
  return pitchClass(pc + shift);
}

const VALID_KEYS = new Set(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);
export const isKey = (k: string) => VALID_KEYS.has(k);
export const safeKey = (k: string) => (isKey(k) ? k : 'C');

export const isMinorKey = (key: string) => key.endsWith('m');
export const keyRootName = (key: string) => key.replace(/m$/, '');
