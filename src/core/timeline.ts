import { PPQ, barTicks, type Song } from './model';

export interface TimedNote {
  /** Absolute position in quarter-note beats from the start of the song. */
  beat: number;
  /** Duration in beats until this string is played again (or the written length if longer), for let-ring playback. */
  ring: number;
  /** Sounding MIDI pitch. */
  midi: number;
  string: number;
  fret: number;
  bar: number;
  /** Stable key shared by every note struck at the same moment: used for highlighting. */
  key: string;
  /** A tied note: written as held, played again quietly so the synth's fading note stays audible. */
  soft?: boolean;
}

export interface BarSpan { bar: number; start: number; length: number; beats: number; beatValue: number }

export const onsetKey = (beat: number) => String(Math.round(beat * 1000));

export function buildTimeline(song: Song): { notes: TimedNote[]; bars: BarSpan[]; total: number } {
  const notes: TimedNote[] = []; const bars: BarSpan[] = [];
  const tuning = song.meta.instrument.tuning; const tr = song.meta.instrument.transpose;
  let pos = 0;
  for (const b of song.bars) {
    const len = barTicks(b) / PPQ;
    bars.push({ bar: b.index, start: pos, length: len, beats: b.beats, beatValue: b.beatValue });
    for (const e of b.events) {
      const beat = pos + e.start / PPQ;
      for (const n of e.notes) {
        notes.push({ beat, ring: e.dur / PPQ, midi: tuning[n.string - 1] + n.fret + tr, string: n.string, fret: n.fret, bar: b.index, key: onsetKey(beat), ...(n.tie ? { soft: true } : {}) });
      }
    }
    pos += len;
  }
  // let notes ring until the same string is struck again (bass/guitar sustain), capped at 4 beats
  for (let i = 0; i < notes.length; i++) {
    const nx = notes.slice(i + 1).find(x => x.string === notes[i].string);
    const until = nx ? nx.beat - notes[i].beat : notes[i].ring + 2;
    notes[i].ring = Math.min(4, Math.max(notes[i].ring, until));
  }
  return { notes, bars, total: pos };
}

/** Sorted onset keys of a timeline, for looking up the note sounding at a beat. */
export const onsetsOf = (notes: TimedNote[]): number[] => [...new Set(notes.map(n => Number(n.key)))].sort((a, b) => a - b);

/** Key of the last onset at or before the beat, or null before the first note. */
export function onsetAt(onsets: number[], beat: number): string | null {
  let k: number | null = null, lo = 0, hi = onsets.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (onsets[m] <= beat * 1000 + 5) { k = onsets[m]; lo = m + 1; } else hi = m - 1; }
  return k === null ? null : String(k);
}
