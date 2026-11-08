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
}

export interface BarSpan { bar: number; start: number; length: number }

export const onsetKey = (beat: number) => String(Math.round(beat * 1000));

export function buildTimeline(song: Song): { notes: TimedNote[]; bars: BarSpan[]; total: number } {
  const notes: TimedNote[] = []; const bars: BarSpan[] = [];
  const tuning = song.meta.instrument.tuning; const tr = song.meta.instrument.transpose;
  let pos = 0;
  for (const b of song.bars) {
    const len = barTicks(b) / PPQ;
    bars.push({ bar: b.index, start: pos, length: len });
    for (const e of b.events) {
      const beat = pos + e.start / PPQ;
      for (const n of e.notes) {
        if (n.tie) {
          // extend the ringing note on this string instead of re-striking it
          for (let i = notes.length - 1; i >= 0; i--) if (notes[i].string === n.string) { notes[i].ring = Math.max(notes[i].ring, beat + e.dur / PPQ - notes[i].beat); break; }
          continue;
        }
        notes.push({ beat, ring: e.dur / PPQ, midi: tuning[n.string - 1] + n.fret + tr, string: n.string, fret: n.fret, bar: b.index, key: onsetKey(beat) });
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
