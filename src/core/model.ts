import type { Instrument } from './instruments';

/** Ticks per quarter note. 48 divides evenly into 16ths (12), 8th-triplets (16), 32nds (6) and 16th-triplets (8). */
export const PPQ = 48;

export interface Note {
  /** 1 = highest-pitched string (standard tab numbering). */
  string: number;
  fret: number;
  /** Tied from the previous note on this string: keep it ringing, don't pick again. */
  tie?: boolean;
}

export interface NoteEvent {
  /** Offset from the start of the bar, in ticks. */
  start: number;
  /** Written duration in ticks. */
  dur: number;
  /** Empty array = rest. Several notes = chord. */
  notes: Note[];
  /** Base value used for notation ('w','h','q','8','16','32'). */
  value: string;
  dots: number;
  triplet: boolean;
  /** Chord symbol shown above the event, e.g. "Am7". */
  chord?: string;
  /** Free text shown above the event, e.g. "p", "rit.", "let ring". */
  text?: string;
}

export interface Bar {
  index: number; // 1-based bar number
  beats: number;
  beatValue: number;
  section?: string;
  events: NoteEvent[];
  /** Source line of the bar's first token, for editor error reporting. */
  line?: number;
}

export interface SongMeta {
  title: string;
  artist?: string;
  /** What the song trains, shown under the title. */
  about?: string;
  tempo: number;
  key: string; // e.g. "C", "Ab", "F#m"
  instrument: Instrument;
}

/** One way of playing a song (e.g. "Bass line", "Melody + chords"). Every version shares the song's header. */
export interface Version {
  name: string;
  bars: Bar[];
}

export interface Song {
  meta: SongMeta;
  /** Bars of the version being shown; equal to versions[0].bars right after parsing. */
  bars: Bar[];
  /** Always at least one. A song without "== Name" lines has a single version called "Main". */
  versions: Version[];
}

/** The same song, showing another of its versions (index is clamped to the available range). */
export function withVersion(song: Song, index: number): Song {
  const v = song.versions[Math.max(0, Math.min(index, song.versions.length - 1))];
  return { ...song, bars: v.bars };
}

export const barTicks = (b: Pick<Bar, 'beats' | 'beatValue'>): number => (b.beats * PPQ * 4) / b.beatValue;
