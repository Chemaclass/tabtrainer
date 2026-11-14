import { QUALITIES, type Quality } from './harmony';
import { letterName, pitchClass, spellPitchClass } from './theory';

export type ScaleId = 'major' | 'minor' | 'major-pentatonic' | 'minor-pentatonic' | 'blues' | 'dorian' | 'mixolydian' | 'phrygian' | 'lydian' | 'harmonic-minor';

export interface Scale {
  id: ScaleId;
  name: string;
  title: string;
  intervals: readonly number[];
  degrees: readonly string[];
  /** Semitones from the root up to the tonic of the major key the scale borrows its accidentals from; harmonic minor borrows the natural minor's and raises its seventh. */
  parent: number;
  /** Intervals always spelled with a flat, whatever the parent key. */
  flatIntervals?: readonly number[];
  /** The seven note scale whose chords a smaller scale plays over. */
  chordsFrom?: ScaleId;
}

export interface ScaleNote { pitchClass: number; name: string; degree: string; root: boolean }

export const SCALES: readonly Scale[] = [
  { id: 'major', name: 'Major', title: 'major', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'], parent: 0 },
  { id: 'minor', name: 'Natural minor', title: 'minor', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], parent: 3 },
  { id: 'major-pentatonic', name: 'Major pentatonic', title: 'major pentatonic', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'], parent: 0, chordsFrom: 'major' },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', title: 'minor pentatonic', intervals: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'], parent: 3, chordsFrom: 'minor' },
  { id: 'blues', name: 'Blues', title: 'blues', intervals: [0, 3, 5, 6, 7, 10], degrees: ['1', 'b3', '4', 'b5', '5', 'b7'], parent: 3, flatIntervals: [6], chordsFrom: 'minor' },
  { id: 'dorian', name: 'Dorian', title: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'], parent: 10 },
  { id: 'mixolydian', name: 'Mixolydian', title: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ['1', '2', '3', '4', '5', '6', 'b7'], parent: 5 },
  { id: 'phrygian', name: 'Phrygian', title: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'], parent: 8 },
  { id: 'lydian', name: 'Lydian', title: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], degrees: ['1', '2', '3', '#4', '5', '6', '7'], parent: 7 },
  { id: 'harmonic-minor', name: 'Harmonic minor', title: 'harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11], degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'], parent: 3 },
];

const FLAT_PARENTS = new Set([5, 10, 3, 8, 1]);

export const isScaleId = (value: unknown): value is ScaleId => SCALES.some(scale => scale.id === value);

export function scaleById(id: ScaleId): Scale {
  const scale = SCALES.find(s => s.id === id);
  if (!scale) throw new Error(`Unknown scale "${id}"`);
  return scale;
}

export const usesFlats = (root: number, scale: Scale) => FLAT_PARENTS.has(pitchClass(root + scale.parent));

export const rootName = (root: number, id: ScaleId) => spellPitchClass(root, usesFlats(root, scaleById(id)));

const degreeStep = (degree: string) => Number(degree.replace(/^[b#]/, '')) - 1;

/** The notes of a scale, spelled up from rootSpelling: pass the key's own name so Db keeps its flats. */
export function scaleNotes(root: number, id: ScaleId, rootSpelling = rootName(root, id)): ScaleNote[] {
  const scale = scaleById(id), key = rootSpelling;
  return scale.intervals.map((interval, index) => {
    const pc = pitchClass(root + interval), degree = scale.degrees[index];
    const name = scale.flatIntervals?.includes(interval) ? spellPitchClass(pc, true) : letterName(pc, key, degreeStep(degree));
    return { pitchClass: pc, name, degree, root: interval === 0 };
  });
}

export const scaleTitle = (root: number, id: ScaleId) => `${rootName(root, id)} ${scaleById(id).title}`;

export interface ScaleChord { step: number; numeral: string; name: string; quality: Quality; root: ScaleNote; tones: ScaleNote[] }

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const CHORD_QUALITIES: readonly Quality[] = ['major', 'minor', 'dim', 'aug', 'maj7', '7', 'm7', 'm7b5', 'dim7', 'mMaj7', 'maj7#5'];
const MINOR_THIRD = 3;
/** A lower case numeral already says minor, so the seventh numeral drops the chord's "m". */
const SEVENTH_NUMERAL_SUFFIXES: Partial<Record<Quality, string>> = { m7: '7', mMaj7: 'maj7' };

const hasMinorThird = (quality: Quality) => QUALITIES[quality].intervals.includes(MINOR_THIRD);

function numeralSuffix(quality: Quality, sevenths: boolean): string {
  if (!sevenths) return '';
  return SEVENTH_NUMERAL_SUFFIXES[quality] ?? QUALITIES[quality].suffix;
}

/** The scale whose chords a scale plays over: its parent for pentatonic and blues, itself otherwise. */
export const harmonyScaleId = (id: ScaleId): ScaleId => scaleById(id).chordsFrom ?? id;

const sameIntervals = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** The chord on each step of the scale, stacked in thirds; pentatonic and blues use their parent scale. */
export function scaleChords(root: number, id: ScaleId, sevenths: boolean): ScaleChord[] {
  const harmonyId = harmonyScaleId(id);
  const notes = scaleNotes(root, harmonyId);
  return notes.map((note, step) => {
    const tones = (sevenths ? [0, 2, 4, 6] : [0, 2, 4]).map(third => notes[(step + third) % notes.length]);
    const intervals = tones.map(tone => pitchClass(tone.pitchClass - note.pitchClass));
    const quality = CHORD_QUALITIES.find(q => sameIntervals(QUALITIES[q].intervals, intervals));
    if (!quality) throw new Error(`No chord quality for step ${step + 1} of ${harmonyId}`);
    const shift = pitchClass(note.pitchClass - root - MAJOR_STEPS[step]);
    const accidental = shift === 11 ? 'b' : shift === 1 ? '#' : '';
    const roman = hasMinorThird(quality) ? ROMANS[step].toLowerCase() : ROMANS[step];
    const suffix = QUALITIES[quality].suffix;
    return {
      step,
      numeral: accidental + roman + numeralSuffix(quality, sevenths),
      name: note.name + suffix,
      quality,
      root: note,
      tones,
    };
  });
}

const MAJOR_KEY_SCALES: readonly ScaleId[] = ['major', 'major-pentatonic'];
const MINOR_KEY_SCALES: readonly ScaleId[] = ['minor', 'minor-pentatonic', 'dorian'];
const BLUES_SCALES: readonly ScaleId[] = ['minor-pentatonic', 'blues'];

export interface ScaleFit { minorKey: boolean; bluesy: boolean }

/** The scales that fit a key, the usual one first: blues and rock lead with minor pentatonic and blues. */
export function fittingScales({ minorKey, bluesy }: ScaleFit): ScaleId[] {
  const keyScales = minorKey ? MINOR_KEY_SCALES : MAJOR_KEY_SCALES;
  if (!bluesy) return [...keyScales];
  const otherKeyScales = keyScales.filter(id => !BLUES_SCALES.includes(id));
  return [...BLUES_SCALES, ...otherKeyScales];
}
