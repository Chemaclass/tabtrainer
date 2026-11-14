import type { FretMark } from '../core/fretboard';
import type { GrooveBar } from '../core/grooveTimeline';
import { keyTonic, type Chord } from '../core/harmony';
import { INSTRUMENTS, type Family, type Instrument } from '../core/instruments';
import { spellChordTones } from '../core/progressions';
import { harmonyScaleId, scaleById, scaleNotes, usesFlats, type ScaleId, type ScaleNote } from '../core/scales';
import { fretMarks, fretboardDescription, isFretLabels, markedPositions, notesByPitchClass, openStringNames, type FretLabels } from './fretboardMarks';
import { pref, setPref } from './storage';

export const BASS_INSTRUMENTS = ['bass4', 'bass5', 'bass6'] as const;
export type BassInstrument = typeof BASS_INSTRUMENTS[number];
const GUITAR_INSTRUMENT = 'guitar6';
const MINOR_KEY_SUFFIX = /m$/;
const FLAT = 'b';

export const isBassInstrument = (value: unknown): value is BassInstrument => BASS_INSTRUMENTS.some(id => id === value);

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

const noteNames = (notes: readonly ScaleNote[]) => notes.map(note => note.name).join(' ');

/** Scale notes of the key across the neck, with the tones of the chord that is playing marked stronger. */
export function jamFretboard({ instrument, key, scale, labels, chord, nextChord }: JamFretboardInput): JamFretboard {
  const spelled = spelledNotes(key, scale, chord);
  const notes = notesByPitchClass(spelled.chord, spelled.scale);
  const positions = markedPositions(instrument, notes);
  return {
    openNames: openStringNames(instrument, spelled.flats),
    marks: fretMarks(positions, { notes, chord, labels }),
    chordText: `${chord.name}: ${noteNames(spelled.chord)}`,
    scaleText: `Scale: ${spelled.scaleTitle}, ${noteNames(spelled.scale)}`,
    nextChordText: `Next: ${nextChord.name}`,
    description: fretboardDescription(instrument, spelled.scaleTitle, chord.name),
  };
}
