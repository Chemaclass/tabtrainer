import { pitchClass, spellPitchClass } from './theory';

export type ScaleId = 'major' | 'minor' | 'major-pentatonic' | 'minor-pentatonic' | 'blues' | 'dorian' | 'mixolydian';

export interface Scale {
  id: ScaleId;
  name: string;
  title: string;
  intervals: readonly number[];
  degrees: readonly string[];
  /** Semitones from the root up to the tonic of the major key the scale borrows its accidentals from. */
  parent: number;
  /** Intervals always spelled with a flat, whatever the parent key. */
  flatIntervals?: readonly number[];
}

export interface ScaleNote { pitchClass: number; name: string; degree: string; root: boolean }

export const SCALES: readonly Scale[] = [
  { id: 'major', name: 'Major', title: 'major', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'], parent: 0 },
  { id: 'minor', name: 'Natural minor', title: 'minor', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], parent: 3 },
  { id: 'major-pentatonic', name: 'Major pentatonic', title: 'major pentatonic', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'], parent: 0 },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', title: 'minor pentatonic', intervals: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'], parent: 3 },
  { id: 'blues', name: 'Blues', title: 'blues', intervals: [0, 3, 5, 6, 7, 10], degrees: ['1', 'b3', '4', 'b5', '5', 'b7'], parent: 3, flatIntervals: [6] },
  { id: 'dorian', name: 'Dorian', title: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'], parent: 10 },
  { id: 'mixolydian', name: 'Mixolydian', title: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ['1', '2', '3', '4', '5', '6', 'b7'], parent: 5 },
];

const FLAT_PARENTS = new Set([5, 10, 3, 8, 1]);

export const isScaleId = (value: unknown): value is ScaleId => SCALES.some(scale => scale.id === value);

export function scaleById(id: ScaleId): Scale {
  const scale = SCALES.find(s => s.id === id);
  if (!scale) throw new Error(`Unknown scale "${id}"`);
  return scale;
}

export const usesFlats = (root: number, scale: Scale) => FLAT_PARENTS.has(pitchClass(root + scale.parent));

export function scaleNotes(root: number, id: ScaleId): ScaleNote[] {
  const scale = scaleById(id), flats = usesFlats(root, scale);
  return scale.intervals.map((interval, index) => {
    const pc = pitchClass(root + interval);
    return { pitchClass: pc, name: spellPitchClass(pc, flats || !!scale.flatIntervals?.includes(interval)), degree: scale.degrees[index], root: interval === 0 };
  });
}

export const rootName = (root: number, id: ScaleId) => spellPitchClass(root, usesFlats(root, scaleById(id)));

export const scaleTitle = (root: number, id: ScaleId) => `${rootName(root, id)} ${scaleById(id).title}`;
