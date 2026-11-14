import { pitchClass } from './theory';

export interface FretPosition { stringIndex: number; fret: number; midi: number; pitchClass: number }

export type MarkRole = 'root' | 'tone' | 'scale';

export interface FretMark { stringIndex: number; fret: number; label: string; role: MarkRole; dimmed?: boolean }

/** Every fret from firstFret to lastFret whose pitch class is wanted, string 1 (tuning[0]) first. */
export function fretboardPositions(tuning: readonly number[], pitchClasses: readonly number[], firstFret: number, lastFret: number): FretPosition[] {
  const wanted = new Set(pitchClasses.map(pitchClass));
  const positions: FretPosition[] = [];
  tuning.forEach((open, stringIndex) => {
    for (let fret = Math.max(0, firstFret); fret <= lastFret; fret++) {
      const midi = open + fret, pc = pitchClass(midi);
      if (wanted.has(pc)) positions.push({ stringIndex, fret, midi, pitchClass: pc });
    }
  });
  return positions;
}

export interface FretWindow { first: number; last: number }

export const POSITION_SPAN = 4, STRETCH_SPAN = 5;

/**
 * One window per wanted fret of the lowest string from firstFret to lastFret. A window spans 4 frets,
 * or 5 when 4 frets miss a wanted pitch class on every string.
 */
export function positionWindows(tuning: readonly number[], pitchClasses: readonly number[], firstFret: number, lastFret: number): FretWindow[] {
  if (!tuning.length) return [];
  const lowest = tuning.indexOf(Math.min(...tuning));
  const wanted = new Set(pitchClasses.map(pitchClass));
  const covers = (first: number, span: number) => {
    const found = new Set(fretboardPositions(tuning, [...wanted], first, first + span - 1).map(p => p.pitchClass));
    return found.size === wanted.size;
  };
  return fretboardPositions([tuning[lowest]], [...wanted], firstFret, lastFret).map(({ fret }) => ({
    first: fret,
    last: fret + (covers(fret, POSITION_SPAN) ? POSITION_SPAN : STRETCH_SPAN) - 1,
  }));
}
