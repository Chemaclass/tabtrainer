import { pitchClass } from './theory';

export interface FretPosition { stringIndex: number; fret: number; midi: number; pitchClass: number }

export type MarkRole = 'root' | 'scale';

export interface FretMark { stringIndex: number; fret: number; label: string; role: MarkRole }

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
