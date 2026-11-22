import { fretboardPositions, type FretMark, type FretPosition, type MarkRole } from '../core/fretboard';
import type { Instrument } from '../core/instruments';
import type { ScaleNote } from '../core/scales';
import { spellPitchClass } from '../core/theory';

export type FretLabels = 'names' | 'degrees';

export const FIRST_FRET = 0;
export const LAST_FRET = 12;

export const isFretLabels = (value: unknown): value is FretLabels => value === 'names' || value === 'degrees';

/** The pitch classes of the chord being marked. */
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

const markLabel = (note: ScaleNote, labels: FretLabels) => (labels === 'degrees' ? note.degree : note.name);

export interface MarkOptions {
  notes: ReadonlyMap<number, ScaleNote>;
  /** Null marks the scale on its own, with its root as the root. */
  chord: MarkedChord | null;
  labels: FretLabels;
  /** Frets outside the position window; none when left out. */
  isDimmed?: (fret: number) => boolean;
  /** The pitch class of the note that carries a mood, marked apart. */
  moodNote?: number | null;
}

const NOTHING_DIMMED = () => false;

export function fretMarks(positions: readonly FretPosition[], { notes, chord, labels, isDimmed = NOTHING_DIMMED, moodNote = null }: MarkOptions): FretMark[] {
  return positions.map(({ stringIndex, fret, pitchClass }): FretMark => {
    const note = notes.get(pitchClass)!;
    const label = markLabel(note, labels);
    const role = markRole(note, chord);
    const dimmed = isDimmed(fret);
    const mark: FretMark = { stringIndex, fret, label, role, dimmed };
    return pitchClass === moodNote ? { ...mark, mood: true } : mark;
  });
}

export const noteNames = (notes: readonly ScaleNote[]) => notes.map(note => note.name).join(' ');

export const openStringNames = (instrument: Instrument, flats: boolean) => instrument.tuning.map(open => spellPitchClass(open, flats));

/** The sentence a screen reader reads for the drawing; positionText describes a position window when one is shown. */
export function fretboardDescription(instrument: Instrument, scaleTitle: string, chordName: string | null, positionText: string | null = null): string {
  const parts = [`Fretboard of the ${instrument.name}`, `frets ${FIRST_FRET} to ${LAST_FRET}`, `with the notes of ${scaleTitle} marked`];
  if (chordName) parts.push(`the tones of ${chordName} stronger`);
  if (positionText) parts.push(positionText);
  return parts.join(', ');
}
