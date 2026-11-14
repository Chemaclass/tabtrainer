const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);

export const pitchClass = (n: number) => ((n % 12) + 12) % 12;

export const spellPitchClass = (pc: number, flats: boolean) => (flats ? FLAT : SHARP)[pitchClass(pc)];

export function pitchClassName(pc: number, key: string): string {
  return spellPitchClass(pc, FLAT_KEYS.has(key));
}

const LETTERS = 'CDEFGAB';
const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export function scaleStepName(pc: number, key: string, step: number): string {
  const letter = (LETTERS.indexOf(key[0]) + step) % 7;
  const accidental = { 0: '', 1: '#', 11: 'b' }[pitchClass(pc - NATURALS[letter])];
  return accidental === undefined ? pitchClassName(pc, key) : LETTERS[letter] + accidental;
}

const LETTER_COUNT = LETTERS.length;
const ACCIDENTALS: Record<number, string> = { 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' };

/** The note letterSteps letters above fromName, with up to two sharps or flats: the third of D# is F##. */
export function letterName(pc: number, fromName: string, letterSteps: number): string {
  const letter = (LETTERS.indexOf(fromName[0]) + letterSteps) % LETTER_COUNT;
  return LETTERS[letter] + (ACCIDENTALS[pitchClass(pc - NATURALS[letter])] ?? '');
}

/** The degree of a spelled note above a spelled root, measured on the major scale: G# above A is "7", G is "b7". */
export function degreeName(rootName: string, noteName: string): string {
  const letterSteps = (LETTERS.indexOf(noteName[0]) - LETTERS.indexOf(rootName[0]) + LETTER_COUNT) % LETTER_COUNT;
  const semitones = pitchClass((pitchClassOf(noteName) ?? 0) - (pitchClassOf(rootName) ?? 0));
  const majorScaleSemitones = NATURALS[letterSteps];
  const accidental = ACCIDENTALS[pitchClass(semitones - majorScaleSemitones)] ?? '';
  return `${accidental}${letterSteps + 1}`;
}

export function pitchClassOf(name: string): number | null {
  const r = /^([A-G])(##|#|bb|b)?$/.exec(name);
  if (!r) return null;
  const pc = SHARP.indexOf(r[1]);
  const shift = { '##': 2, '#': 1, bb: -2, b: -1 }[r[2] ?? ''] ?? 0;
  return pitchClass(pc + shift);
}

/** VexFlow key string ("eb/3") for a written MIDI pitch, spelled to suit the key signature. */
export function vexKey(midi: number, key: string): string {
  return `${pitchClassName(midi, key).toLowerCase()}/${Math.floor(midi / 12) - 1}`;
}

const VALID_KEYS = new Set(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);
export const isKey = (k: string) => VALID_KEYS.has(k);
export const safeKey = (k: string) => (isKey(k) ? k : 'C');
