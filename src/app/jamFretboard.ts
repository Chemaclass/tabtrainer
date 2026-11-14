import { fretboardPositions, type FretMark, type MarkRole } from '../core/fretboard';
import type { GrooveBar } from '../core/grooveTimeline';
import { keyTonic, type Chord } from '../core/harmony';
import { INSTRUMENTS, type Family, type Instrument } from '../core/instruments';
import { spellChordTones } from '../core/progressions';
import { harmonyScaleId, scaleById, scaleNotes, usesFlats, type ScaleId, type ScaleNote } from '../core/scales';
import { spellPitchClass } from '../core/theory';
import { FIRST_FRET, LAST_FRET, type FretLabels } from './fretboardSheet';
import { pref, setPref } from './storage';

export const BASS_INSTRUMENTS = ['bass4', 'bass5', 'bass6'] as const;
export type BassInstrument = typeof BASS_INSTRUMENTS[number];
const GUITAR_INSTRUMENT = 'guitar6';
const MINOR_KEY_SUFFIX = /m$/;
const FLAT = 'b';

export const isBassInstrument = (value: unknown): value is BassInstrument => BASS_INSTRUMENTS.some(id => id === value);
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

export interface BarChords { chord: Chord; nextChord: Chord }

/** The chord of a bar and the chord one bar later, wrapping round to the first bar after the last. */
export function barChords(bars: readonly GrooveBar[], bar: number): BarChords {
  const index = bar % bars.length;
  const nextIndex = (index + 1) % bars.length;
  return { chord: bars[index].chord, nextChord: bars[nextIndex].chord };
}

export interface JamFretboardInput {
  instrument: Instrument;
  key: string;
  scale: ScaleId;
  labels: FretLabels;
  chord: Chord;
  nextChord: Chord;
}

export interface JamFretboard {
  openNames: string[];
  marks: FretMark[];
  /** The chord and its tones, for the line screen readers announce on each chord change. */
  chordText: string;
  scaleText: string;
  nextChordText: string;
  description: string;
}

interface SpelledNotes { scaleTitle: string; scale: ScaleNote[]; chord: ScaleNote[]; flats: boolean }

/** Spells the scale up from the key's own name, so a Db blues keeps its flats, and the chord tones to match. */
function spelledNotes(key: string, scale: ScaleId, chord: Chord): SpelledNotes {
  const root = keyTonic(key) ?? 0;
  const rootSpelling = key.replace(MINOR_KEY_SUFFIX, '');
  const scaleNotesOfKey = scaleNotes(root, scale, rootSpelling);
  const harmonyNotes = scaleNotes(root, harmonyScaleId(scale), rootSpelling);
  return {
    scaleTitle: `${rootSpelling} ${scaleById(scale).title}`,
    scale: scaleNotesOfKey,
    chord: spellChordTones(chord, rootSpelling, harmonyNotes),
    flats: rootSpelling.includes(FLAT) || usesFlats(root, scaleById(scale)),
  };
}

/** One note per pitch class; a scale note replaces a chord tone of the same pitch so both share one spelling. */
function notesByPitchClass(chordNotes: readonly ScaleNote[], scaleNotesOfKey: readonly ScaleNote[]): Map<number, ScaleNote> {
  const notes = new Map<number, ScaleNote>();
  for (const note of chordNotes) {
    notes.set(note.pitchClass, note);
  }
  for (const note of scaleNotesOfKey) {
    notes.set(note.pitchClass, note);
  }
  return notes;
}

function roleOf(pitchClass: number, chord: Chord): MarkRole {
  if (pitchClass === chord.root) return 'root';
  if (chord.tones.includes(pitchClass)) return 'tone';
  return 'scale';
}

function fretMarks(instrument: Instrument, notes: ReadonlyMap<number, ScaleNote>, chord: Chord, labels: FretLabels): FretMark[] {
  const positions = fretboardPositions(instrument.tuning, [...notes.keys()], FIRST_FRET, LAST_FRET);
  return positions.map(({ stringIndex, fret, pitchClass }): FretMark => {
    const note = notes.get(pitchClass)!;
    const label = labels === 'degrees' ? note.degree : note.name;
    return { stringIndex, fret, label, role: roleOf(pitchClass, chord) };
  });
}

const noteNames = (notes: readonly ScaleNote[]) => notes.map(note => note.name).join(' ');

/** Scale notes of the key across the neck, with the tones of the chord that is playing marked stronger. */
export function jamFretboard({ instrument, key, scale, labels, chord, nextChord }: JamFretboardInput): JamFretboard {
  const spelled = spelledNotes(key, scale, chord);
  const notes = notesByPitchClass(spelled.chord, spelled.scale);
  return {
    openNames: instrument.tuning.map(open => spellPitchClass(open, spelled.flats)),
    marks: fretMarks(instrument, notes, chord, labels),
    chordText: `${chord.name}: ${noteNames(spelled.chord)}`,
    scaleText: `Scale: ${spelled.scaleTitle}, ${noteNames(spelled.scale)}`,
    nextChordText: `Next: ${nextChord.name}`,
    description: `Fretboard of the ${instrument.name}, frets ${FIRST_FRET} to ${LAST_FRET}, with the notes of ${spelled.scaleTitle} marked and the tones of ${chord.name} stronger`,
  };
}
