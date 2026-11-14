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

export function pitchClassOf(name: string): number | null {
  const r = /^([A-G])(#|b)?$/.exec(name);
  if (!r) return null;
  const pc = SHARP.indexOf(r[1]);
  return pitchClass(pc + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0));
}

/** VexFlow key string ("eb/3") for a written MIDI pitch, spelled to suit the key signature. */
export function vexKey(midi: number, key: string): string {
  return `${pitchClassName(midi, key).toLowerCase()}/${Math.floor(midi / 12) - 1}`;
}

const VALID_KEYS = new Set(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);
export const isKey = (k: string) => VALID_KEYS.has(k);
export const safeKey = (k: string) => (isKey(k) ? k : 'C');
