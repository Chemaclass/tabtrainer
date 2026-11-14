import { ACCIDENTAL_SHIFTS, FLAT_FIFTH, MAJOR_SCALE, MAJOR_SECOND, MAJOR_SIXTH, MINOR_SEVENTH, MINOR_THIRD, OCTAVE, PERFECT_FIFTH, PERFECT_FOURTH, ROOT, SHARP_FIFTH, isKey, keyRootName, pitchClass, pitchClassOf, safeKey, scaleStepName } from './theory';

export type Quality = 'major' | 'minor' | '7' | 'm7' | 'maj7' | 'mMaj7' | 'm7b5' | 'dim' | 'dim7' | 'aug' | 'maj7#5' | 'sus4' | '5';

export interface Numeral { text: string; step: number; degree: number; quality: Quality }

export interface Chord { root: number; name: string; intervals: number[]; tones: number[] }

export type BassDegree = '1' | '2' | '3' | '5' | '6' | 'b7' | '8';
export const BASS_DEGREES: readonly BassDegree[] = ['1', '2', '3', '5', '6', 'b7', '8'];

export const ROMAN_NUMERALS: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const QUALITIES: Readonly<Record<Quality, { readonly intervals: readonly number[]; readonly suffix: string }>> = {
  major: { intervals: [0, 4, 7], suffix: '' },
  minor: { intervals: [0, 3, 7], suffix: 'm' },
  '7': { intervals: [0, 4, 7, 10], suffix: '7' },
  m7: { intervals: [0, 3, 7, 10], suffix: 'm7' },
  maj7: { intervals: [0, 4, 7, 11], suffix: 'maj7' },
  mMaj7: { intervals: [0, 3, 7, 11], suffix: 'm(maj7)' },
  m7b5: { intervals: [0, 3, 6, 10], suffix: 'm7b5' },
  dim: { intervals: [0, 3, 6], suffix: 'dim' },
  dim7: { intervals: [0, 3, 6, 9], suffix: 'dim7' },
  aug: { intervals: [0, 4, 8], suffix: 'aug' },
  'maj7#5': { intervals: [0, 4, 8, 11], suffix: 'maj7#5' },
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
  const isLowerCase = roman === roman.toLowerCase();
  const quality = qualityOf(suffix, isLowerCase);
  if (!quality) return { error: `Unknown chord quality "${suffix}" in "${text}": use 7, maj7, m7, m7b5, dim, sus4 or 5` };
  const shift = ACCIDENTAL_SHIFTS[accidental ?? ''] ?? 0;
  const step = ROMAN_NUMERALS.indexOf(roman.toUpperCase());
  const degree = pitchClass(MAJOR_SCALE[step] + shift);
  return { numeral: { text, step, degree, quality } };
}

export function keyTonic(key: string): number | null {
  return isKey(key) ? pitchClassOf(keyRootName(key)) : null;
}

const TONIC: Numeral = { text: 'I', step: 0, degree: 0, quality: 'major' };
const wrap = (n: number, len: number) => ((n % len) + len) % len;

export function chordAt(progression: readonly Numeral[], key: string, bar: number): Chord {
  key = safeKey(key);
  const numeral = progression.length ? progression[wrap(bar, progression.length)] : TONIC;
  const { intervals, suffix } = QUALITIES[numeral.quality];
  const root = pitchClass((keyTonic(key) ?? 0) + numeral.degree);
  const name = scaleStepName(root, key, numeral.step) + suffix;
  const tones = intervals.map(interval => pitchClass(root + interval));
  return { root, name, intervals: [...intervals], tones };
}

export function degreeInterval(chord: { readonly intervals: readonly number[] }, degree: BassDegree): number {
  switch (degree) {
    case '1': return ROOT;
    case '2': return MAJOR_SECOND;
    // A power chord has no third, so the bass doubles the root rather than choose one for it
    case '3': return chord.intervals.find(i => i >= MINOR_THIRD && i <= PERFECT_FOURTH) ?? ROOT;
    case '5': return chord.intervals.find(i => i >= FLAT_FIFTH && i <= SHARP_FIFTH) ?? PERFECT_FIFTH;
    case '6': return MAJOR_SIXTH;
    // A major seventh chord keeps its own seventh, so the bass never clashes with it
    case 'b7': return chord.intervals.find(i => i >= MINOR_SEVENTH) ?? MINOR_SEVENTH;
    case '8': return OCTAVE;
  }
}

export const OWN_PROGRESSION = 'groove';
export interface ProgressionPreset { slug: string; name: string }

export const TWELVE_BAR_BLUES = 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7';

const PRESETS: readonly (ProgressionPreset & { text: string })[] = [
  { slug: '12-bar-blues', name: '12 bar blues', text: TWELVE_BAR_BLUES },
  { slug: 'minor-blues', name: 'Minor blues', text: 'i7 iv7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7' },
  { slug: 'i-iv-v', name: 'I IV V', text: 'I IV I V' },
  { slug: 'i-v-vi-iv', name: 'I V vi IV', text: 'I V vi IV' },
  { slug: 'i-bvii-bvi-bvii', name: 'i bVII bVI bVII', text: 'i bVII bVI bVII' },
  { slug: 'ii-v-i', name: 'ii V I', text: 'ii7 V7 Imaj7 Imaj7' },
  { slug: 'one-chord', name: 'One chord vamp', text: '' },
];
const VAMP_BARS = 4;

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = PRESETS.map(({ slug, name }) => ({ slug, name }));

export function numerals(text: string): Numeral[] {
  return text.split(' ').map(t => {
    const r = parseNumeral(t);
    if ('error' in r) throw new Error(r.error);
    return r.numeral;
  });
}

export function presetProgression(slug: string, own: readonly Numeral[]): Numeral[] | null {
  if (slug === OWN_PROGRESSION) return [...own];
  const preset = PRESETS.find(p => p.slug === slug);
  if (!preset) return null;
  return preset.text ? numerals(preset.text) : Array<Numeral>(VAMP_BARS).fill(own[0] ?? TONIC);
}

const MINOR_QUALITIES: readonly Quality[] = ['minor', 'm7', 'mMaj7', 'm7b5', 'dim'];

export function isMinorProgression(progression: readonly Numeral[]): boolean {
  const first = progression[0];
  if (!first) return false;
  return first.degree === ROOT && MINOR_QUALITIES.includes(first.quality);
}
