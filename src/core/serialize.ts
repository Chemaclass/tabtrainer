import { INSTRUMENTS } from './instruments';
import type { Note, NoteEvent, Song } from './model';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const midiName = (m: number) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

function durToken(e: NoteEvent): string {
  return e.value + '.'.repeat(e.dots) + (e.triplet ? 't' : '');
}
const noteTok = (n: Note) => (n.tie ? '~' : '') + `${n.fret}.${n.string}`;

/** Turn a song back into the text format (stable, round-trips through parseSong). */
export function serializeSong(song: Song, barsPerLine = 2): string {
  const { meta } = song;
  const out: string[] = [`title: ${meta.title}`];
  if (meta.artist) out.push(`artist: ${meta.artist}`);
  if (meta.about) out.push(`about: ${meta.about}`);
  if (meta.listen) out.push(`listen: ${meta.listen}`);
  const preset = Object.values(INSTRUMENTS).find(i => i.id === meta.instrument.id);
  if (preset) out.push(`instrument: ${preset.id}`);
  else out.push(`tuning: ${[...meta.instrument.tuning].reverse().map(midiName).join(' ')}`);
  out.push(`tempo: ${meta.tempo}`, `key: ${meta.key}`);
  const versions = song.versions?.length ? song.versions : [{ name: 'Main', bars: song.bars }];
  const first = versions[0].bars[0];
  const headerTs = first ? `${first.beats}/${first.beatValue}` : '4/4';
  out.push(`time: ${headerTs}`, '');
  let line: string[] = [];
  const flush = () => { if (line.length) { out.push(line.join(' ')); line = []; } };
  versions.forEach((v, vi) => {
    // every version restarts from the header's time signature and the default duration
    let dur = ''; let ts = headerTs;
    if (versions.length > 1) { flush(); if (vi > 0) out.push(''); out.push(`== ${v.name}`); }
    v.bars.forEach((b, i) => {
      if (b.section) { flush(); out.push(`@${b.section}`); }
      const parts: string[] = [];
      const bts = `${b.beats}/${b.beatValue}`;
      if (bts !== ts) { parts.push(`[${bts}]`); ts = bts; }
      for (const e of b.events) {
        if (e.chord) parts.push(`"${e.chord}"`);
        if (e.text) parts.push(`{${e.text}}`);
        const d = durToken(e);
        if (d !== dur) { parts.push(`:${d}`); dur = d; }
        parts.push(!e.notes.length ? 'r' : e.notes.length === 1 ? noteTok(e.notes[0]) : `(${e.notes.map(noteTok).join(' ')})`);
      }
      line.push(parts.join(' ') + ' |');
      if ((i + 1) % barsPerLine === 0) flush();
    });
    flush();
  });
  flush();
  return out.join('\n') + '\n';
}
