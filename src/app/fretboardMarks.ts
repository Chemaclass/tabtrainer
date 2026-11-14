import { fretboardPositions, type FretMark, type FretPosition, type MarkRole } from '../core/fretboard';
import type { Instrument } from '../core/instruments';
import type { ScaleNote } from '../core/scales';
import { spellPitchClass } from '../core/theory';

export type FretLabels = 'names' | 'degrees';

export const FIRST_FRET = 0, LAST_FRET = 12;

export const isFretLabels = (value: unknown): value is FretLabels => value === 'names' || value === 'degrees';

/** The pitch classes of the chord being marked; null marks the scale on its own. */
export interface MarkedChord { root: number; tones: readonly number[] }

/** One note per pitch class; a scale note replaces a chord tone of the same pitch so both share one spelling. */
export function notesByPitchClass(chordNotes: readonly ScaleNote[], scaleNotes: readonly ScaleNote[]): Map<number, ScaleNote> {
  const notes = new Map<number, ScaleNote>();
  for (const note of chordNotes) {
    notes.set(note.pitchClass, note);
  }
  for (const note of scaleNotes) {
    notes.set(note.pitchClass, note);
  }
  return notes;
}

/** Every fret from FIRST_FRET to LAST_FRET that plays one of the notes. */
export function markedPositions(instrument: Instrument, notes: ReadonlyMap<number, ScaleNote>): FretPosition[] {
  return fretboardPositions(instrument.tuning, [...notes.keys()], FIRST_FRET, LAST_FRET);
}

export function markRole(note: ScaleNote, chord: MarkedChord | null): MarkRole {
  if (!chord) return note.root ? 'root' : 'scale';
  if (note.pitchClass === chord.root) return 'root';
  if (chord.tones.includes(note.pitchClass)) return 'tone';
  return 'scale';
}

export const markLabel = (note: ScaleNote, labels: FretLabels) => (labels === 'degrees' ? note.degree : note.name);

export interface MarkOptions {
  notes: ReadonlyMap<number, ScaleNote>;
  chord: MarkedChord | null;
  labels: FretLabels;
  /** Frets outside the position window; none when left out. */
  isDimmed?: (fret: number) => boolean;
}

const NOTHING_DIMMED = () => false;

export function fretMarks(positions: readonly FretPosition[], { notes, chord, labels, isDimmed = NOTHING_DIMMED }: MarkOptions): FretMark[] {
  return positions.map(({ stringIndex, fret, pitchClass }): FretMark => {
    const note = notes.get(pitchClass)!;
    return { stringIndex, fret, label: markLabel(note, labels), role: markRole(note, chord), dimmed: isDimmed(fret) };
  });
}

export const openStringNames = (instrument: Instrument, flats: boolean) => instrument.tuning.map(open => spellPitchClass(open, flats));

/** The sentence a screen reader reads for the drawing; positionText describes a position window when one is shown. */
export function fretboardDescription(instrument: Instrument, scaleTitle: string, chordName: string | null, positionText = ''): string {
  const chordText = chordName ? `, the tones of ${chordName} stronger` : '';
  return `Fretboard of the ${instrument.name}, frets ${FIRST_FRET} to ${LAST_FRET}, with the notes of ${scaleTitle} marked${chordText}${positionText}`;
}
