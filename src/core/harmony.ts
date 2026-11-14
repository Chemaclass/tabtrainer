import { isKey, pitchClass, pitchClassOf, safeKey, scaleStepName } from './theory';

export type Quality = 'major' | 'minor' | '7' | 'm7' | 'maj7' | 'mMaj7' | 'm7b5' | 'dim' | 'sus4' | '5';

export interface Numeral { text: string; step: number; degree: number; quality: Quality }

export interface Chord { root: number; name: string; intervals: number[]; tones: number[] }

export type BassDegree = '1' | '3' | '5' | '6' | 'b7' | '8';
export const BASS_DEGREES: readonly BassDegree[] = ['1', '3', '5', '6', 'b7', '8'];

const ROMANS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export const QUALITIES: Readonly<Record<Quality, { readonly intervals: readonly number[]; readonly suffix: string }>> = {
  major: { intervals: [0, 4, 7], suffix: '' },
  minor: { intervals: [0, 3, 7], suffix: 'm' },
  '7': { intervals: [0, 4, 7, 10], suffix: '7' },
  m7: { intervals: [0, 3, 7, 10], suffix: 'm7' },
  maj7: { intervals: [0, 4, 7, 11], suffix: 'maj7' },
  mMaj7: { intervals: [0, 3, 7, 11], suffix: 'm(maj7)' },
  m7b5: { intervals: [0, 3, 6, 10], suffix: 'm7b5' },
  dim: { intervals: [0, 3, 6], suffix: 'dim' },
  sus4: { intervals: [0, 5, 7], suffix: 'sus4' },
  '5': { intervals: [0, 7], suffix: '5' },
};

function qualityOf(suffix: string, minor: boolean): Quality | null {
  switch (suffix) {
    case '': return minor ? 'minor' : 'major';
    case '7': return minor ? 'm7' : '7';
    case 'maj7': return minor ? 'mMaj7' : 'maj7';
    case 'm7': case 'm7b5': case 'dim': case 'sus4': case '5': return suffix;
    default: return null;
  }
}

export type NumeralResult = { numeral: Numeral } | { error: string };

export function parseNumeral(text: string): NumeralResult {
  const r = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(text);
  if (!r) return { error: `Unknown chord "${text}": use roman numerals like I7, iv or bVII` };
  const [, accidental, roman, suffix] = r;
  const quality = qualityOf(suffix, roman === roman.toLowerCase());
  if (!quality) return { error: `Unknown chord quality "${suffix}" in "${text}": use 7, maj7, m7, m7b5, dim, sus4 or 5` };
  const shift = accidental === 'b' ? -1 : accidental === '#' ? 1 : 0;
  const step = ROMANS.indexOf(roman.toLowerCase());
  return { numeral: { text, step, degree: pitchClass(MAJOR_SCALE[step] + shift), quality } };
}

export function keyTonic(key: string): number | null {
  return isKey(key) ? pitchClassOf(key.replace(/m$/, '')) : null;
}

const TONIC: Numeral = { text: 'I', step: 0, degree: 0, quality: 'major' };
const wrap = (n: number, len: number) => ((n % len) + len) % len;

export function chordAt(progression: readonly Numeral[], key: string, bar: number): Chord {
  key = safeKey(key);
  const numeral = progression.length ? progression[wrap(bar, progression.length)] : TONIC;
  const { intervals, suffix } = QUALITIES[numeral.quality];
  const root = pitchClass((keyTonic(key) ?? 0) + numeral.degree);
  return { root, name: scaleStepName(root, key, numeral.step) + suffix, intervals: [...intervals], tones: intervals.map(i => pitchClass(root + i)) };
}

export function degreeInterval(chord: Chord, degree: BassDegree): number {
  switch (degree) {
    case '1': return 0;
    // A power chord has no third, so the bass doubles the root rather than choose one for it
    case '3': return chord.intervals.find(i => i >= 3 && i <= 5) ?? 0;
    case '5': return chord.intervals.find(i => i >= 6 && i <= 8) ?? 7;
    case '6': return 9;
    case 'b7': return 10;
    case '8': return 12;
  }
}
