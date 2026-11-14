import { fretboardPositions, type FretMark, type MarkRole } from '../core/fretboard';
import type { GrooveBar } from '../core/grooveTimeline';
import { keyTonic, type Chord } from '../core/harmony';
import { INSTRUMENTS, type Family, type Instrument } from '../core/instruments';
import { spellChordTones } from '../core/progressions';
import { rootName, scaleById, scaleNotes, scaleTitle, usesFlats, type ScaleId, type ScaleNote } from '../core/scales';
import { spellPitchClass } from '../core/theory';
import { FIRST_FRET, LAST_FRET, type FretLabels } from './fretboardSheet';
import { pref, setPref } from './storage';

export const BASS_INSTRUMENTS = ['bass4', 'bass5', 'bass6'] as const;
export type BassInstrument = typeof BASS_INSTRUMENTS[number];
const GUITAR_INSTRUMENT = 'guitar6';

const isBassInstrument = (value: unknown): value is BassInstrument => BASS_INSTRUMENTS.some(id => id === value);
const isFretLabels = (value: unknown): value is FretLabels => value === 'names' || value === 'degrees';

/** The bass the player owns and how the marks are labelled, kept for every groove. */
export class JamFretboardSettings {
  private chosenBass: BassInstrument;
  private chosenLabels: FretLabels;

  constructor() {
    const saved = pref('jamFretboard', {});
    this.chosenBass = isBassInstrument(saved.bass) ? saved.bass : 'bass4';
    this.chosenLabels = isFretLabels(saved.labels) ? saved.labels : 'names';
  }

  get bass(): BassInstrument { return this.chosenBass; }
  get labels(): FretLabels { return this.chosenLabels; }

  instrumentFor(family: Family): Instrument {
    if (family === 'bass') return INSTRUMENTS[this.chosenBass];
    return INSTRUMENTS[GUITAR_INSTRUMENT];
  }

  setBass(id: BassInstrument): boolean {
    if (id === this.chosenBass) return false;
    this.chosenBass = id;
    this.save();
    return true;
  }

  toggleLabels() {
    this.chosenLabels = this.chosenLabels === 'degrees' ? 'names' : 'degrees';
    this.save();
  }

  private save() { setPref('jamFretboard', { bass: this.chosenBass, labels: this.chosenLabels }); }
}

export interface BarChords { chord: Chord; next: Chord }

/** The chord of a bar and the chord one bar later, wrapping round to the first bar after the last. */
export function barChords(bars: readonly GrooveBar[], bar: number): BarChords {
  const index = bar % bars.length;
  const nextIndex = (index + 1) % bars.length;
  return { chord: bars[index].chord, next: bars[nextIndex].chord };
}

export interface JamFretboardInput {
  instrument: Instrument;
  key: string;
  scale: ScaleId;
  labels: FretLabels;
  chord: Chord;
  next: Chord;
}

export interface JamFretboard {
  openNames: string[];
  marks: FretMark[];
  /** The chord, its tones and the scale, for the line screen readers announce. */
  summary: string;
  next: string;
  description: string;
}

function roleOf(pitchClass: number, chordRoot: number, chordTones: ReadonlySet<number>): MarkRole {
  if (pitchClass === chordRoot) return 'root';
  if (chordTones.has(pitchClass)) return 'tone';
  return 'scale';
}

const noteNames = (notes: readonly ScaleNote[]) => notes.map(note => note.name).join(' ');

/** Scale notes of the key across the neck, with the tones of the chord that is playing marked stronger. */
export function jamFretboard({ instrument, key, scale, labels, chord, next }: JamFretboardInput): JamFretboard {
  const scaleRoot = keyTonic(key) ?? 0;
  const scaleRootName = rootName(scaleRoot, scale);
  const notes = scaleNotes(scaleRoot, scale);
  const harmonyNotes = scaleNotes(scaleRoot, scaleById(scale).chordsFrom ?? scale);
  const chordNotes = spellChordTones(chord, scaleRootName, harmonyNotes);
  const chordTones = new Set(chord.tones);
  const noteAt = new Map<number, ScaleNote>();
  for (const note of [...chordNotes, ...notes]) noteAt.set(note.pitchClass, note);

  const positions = fretboardPositions(instrument.tuning, [...noteAt.keys()], FIRST_FRET, LAST_FRET);
  const marks = positions.map(({ stringIndex, fret, pitchClass }): FretMark => {
    const note = noteAt.get(pitchClass)!;
    const label = labels === 'degrees' ? note.degree : note.name;
    return { stringIndex, fret, label, role: roleOf(pitchClass, chord.root, chordTones) };
  });

  const flats = usesFlats(scaleRoot, scaleById(scale));
  const title = scaleTitle(scaleRoot, scale);
  return {
    openNames: instrument.tuning.map(open => spellPitchClass(open, flats)),
    marks,
    summary: `${chord.name}: ${noteNames(chordNotes)}. Scale: ${title}, ${noteNames(notes)}.`,
    next: `Next: ${next.name}`,
    description: `Fretboard of the ${instrument.name}, frets ${FIRST_FRET} to ${LAST_FRET}, with the notes of ${title} marked and the tones of ${chord.name} stronger`,
  };
}
