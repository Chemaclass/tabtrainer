import { INSTRUMENTS, customInstrument, type Instrument } from './instruments';
import { PPQ, barTicks, type Bar, type Note, type NoteEvent, type Song } from './model';

export interface ParseIssue { line: number; col: number; message: string; severity: 'error' | 'warning' }
export interface ParseResult { song: Song; issues: ParseIssue[] }

const VALUES: Record<string, number> = { w: 4 * PPQ, h: 2 * PPQ, q: PPQ, '8': PPQ / 2, '16': PPQ / 4, '32': PPQ / 8 };
const HEADER = /^\s*(title|artist|instrument|tuning|tempo|key|time|clef)\s*:\s*(.*?)\s*$/i;

interface Tok { text: string; line: number; col: number }

function tokenize(src: string, firstLine: number): Tok[] {
  const toks: Tok[] = [];
  src.split('\n').forEach((raw, i) => {
    const line = firstLine + i;
    const hash = raw.search(/(^|\s)#/);
    const text = hash >= 0 ? raw.slice(0, hash) : raw;
    if (/^\s*@/.test(text)) { toks.push({ text: text.trim(), line, col: text.indexOf('@') + 1 }); return; }
    const re = /"[^"]*"|\{[^}]*\}|\([^)]*\)(:[^\s|]+)?|\[[^\]]*\]|\||[^\s|]+/g;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(text))) toks.push({ text: mt[0], line, col: mt.index + 1 });
  });
  return toks;
}

export function parseDuration(s: string): { ticks: number; value: string; dots: number; triplet: boolean } | null {
  const r = /^(w|h|q|8|16|32)(\.{0,2})(t?)$/.exec(s);
  if (!r) return null;
  let ticks = VALUES[r[1]];
  const dots = r[2].length;
  let add = ticks;
  for (let i = 0; i < dots; i++) { add /= 2; ticks += add; }
  const triplet = r[3] === 't';
  if (triplet) ticks = (ticks * 2) / 3;
  return { ticks, value: r[1], dots, triplet };
}

export function parseSong(src: string): ParseResult {
  const issues: ParseIssue[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const meta = { title: 'Untitled', artist: undefined as string | undefined, tempo: 90, key: 'C', instrument: INSTRUMENTS.bass4 as Instrument };
  let time: [number, number] = [4, 4];
  let tuning: string | null = null; let clef: 'bass' | 'treble' | undefined;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(#.*)?$/.test(l)) { bodyStart = i + 1; continue; }
    if (/^\s*---\s*$/.test(l)) { bodyStart = i + 1; break; }
    const h = HEADER.exec(l);
    if (!h) { bodyStart = i; break; }
    const [, k, v] = h; const key = k.toLowerCase();
    if (key === 'title') meta.title = v;
    else if (key === 'artist') meta.artist = v;
    else if (key === 'tempo') { const t = parseFloat(v); if (t >= 20 && t <= 400) meta.tempo = t; else issues.push({ line: i + 1, col: 1, message: `Tempo must be 20–400 (got "${v}")`, severity: 'error' }); }
    else if (key === 'key') meta.key = v;
    else if (key === 'instrument') { if (INSTRUMENTS[v]) meta.instrument = INSTRUMENTS[v]; else issues.push({ line: i + 1, col: 1, message: `Unknown instrument "${v}". Use one of: ${Object.keys(INSTRUMENTS).join(', ')} (or a "tuning:" line)`, severity: 'error' }); }
    else if (key === 'tuning') tuning = v;
    else if (key === 'clef') clef = v === 'treble' ? 'treble' : 'bass';
    else if (key === 'time') { const t = /^(\d+)\/(\d+)$/.exec(v); if (t) time = [+t[1], +t[2]]; else issues.push({ line: i + 1, col: 1, message: `Time signature like 4/4 expected`, severity: 'error' }); }
    bodyStart = i + 1;
  }
  if (tuning) { try { meta.instrument = customInstrument(tuning, clef); } catch (e) { issues.push({ line: 1, col: 1, message: (e as Error).message, severity: 'error' }); } }
  else if (clef) meta.instrument = { ...meta.instrument, clef };
  const strings = meta.instrument.tuning.length;

  const bars: Bar[] = [];
  const st = { cur: null as Bar | null }; let t = 0;
  let dur = parseDuration('q')!;
  let pendingChord: string | undefined; let pendingText: string | undefined; let pendingSection: string | undefined;
  const newBar = (line: number): Bar => {
    const b: Bar = { index: bars.length + 1, beats: time[0], beatValue: time[1], events: [], line, section: pendingSection };
    pendingSection = undefined; bars.push(b); t = 0; return b;
  };
  const closeBar = (tok: Tok) => {
    if (!st.cur) return;
    const full = barTicks(st.cur);
    if (t < full && st.cur.events.length) {
      issues.push({ line: st.cur.line ?? tok.line, col: 1, message: `Bar ${st.cur.index} has ${(t / PPQ).toFixed(2).replace(/\.?0+$/, '')} of ${st.cur.beats * 4 / st.cur.beatValue} beats; filled with a rest`, severity: 'warning' });
      st.cur.events.push({ start: t, dur: full - t, notes: [], value: 'q', dots: 0, triplet: false });
    }
    if (!st.cur.events.length) bars.pop();
    st.cur = null;
  };
  const parseNote = (s: string, tok: Tok): Note | null => {
    const tie = s.startsWith('~'); const body = tie ? s.slice(1) : s;
    const r = /^(\d{1,2})\.(\d{1,2})$/.exec(body);
    if (!r) { issues.push({ line: tok.line, col: tok.col, message: `Can't read "${s}". Notes are fret.string, e.g. 3.4 (fret 3 on string 4)`, severity: 'error' }); return null; }
    const fret = +r[1], string = +r[2];
    if (string < 1 || string > strings) { issues.push({ line: tok.line, col: tok.col, message: `String ${string} doesn't exist on this ${strings}-string instrument`, severity: 'error' }); return null; }
    if (fret > meta.instrument.maxFret) { issues.push({ line: tok.line, col: tok.col, message: `Fret ${fret} is above the instrument's ${meta.instrument.maxFret} frets`, severity: 'error' }); return null; }
    return { string, fret, ...(tie ? { tie: true } : {}) };
  };
  const pushEvent = (notes: Note[], tok: Tok) => {
    if (!st.cur) st.cur = newBar(tok.line);
    const full = barTicks(st.cur);
    if (t + dur.ticks > full + 0.001) {
      issues.push({ line: tok.line, col: tok.col, message: `Bar ${st.cur.index} is too long: this note goes past ${st.cur.beats * 4 / st.cur.beatValue} beats (missing a "|"?)`, severity: 'error' });
    }
    const strs = notes.map(n => n.string);
    if (new Set(strs).size !== strs.length) issues.push({ line: tok.line, col: tok.col, message: 'Two notes on the same string in one chord', severity: 'error' });
    const ev: NoteEvent = { start: t, dur: dur.ticks, notes, value: dur.value, dots: dur.dots, triplet: dur.triplet };
    if (pendingChord) ev.chord = pendingChord; if (pendingText) ev.text = pendingText;
    pendingChord = pendingText = undefined;
    st.cur.events.push(ev); t += dur.ticks;
  };

  for (const tok of tokenize(lines.slice(bodyStart).join('\n'), bodyStart + 1)) {
    let s = tok.text;
    if (s.startsWith('@')) { if (st.cur && st.cur.events.length) closeBar(tok); pendingSection = s.slice(1).trim(); continue; }
    if (s === '|') { closeBar(tok); continue; }
    if (s.startsWith('[')) {
      const r = /^\[(\d+)\/(\d+)\]$/.exec(s);
      if (!r) { issues.push({ line: tok.line, col: tok.col, message: `Time signature like [3/4] expected`, severity: 'error' }); continue; }
      time = [+r[1], +r[2]];
      if (st.cur && !st.cur.events.length) { st.cur.beats = time[0]; st.cur.beatValue = time[1]; }
      continue;
    }
    if (s.startsWith('"')) { pendingChord = s.slice(1, -1); continue; }
    if (s.startsWith('{')) { pendingText = s.slice(1, -1).trim(); continue; }
    // optional inline duration: token:dur
    let inline: string | null = null;
    const ci = s.lastIndexOf(':');
    if (ci >= 0) { inline = s.slice(ci + 1); s = s.slice(0, ci); }
    if (inline !== null) {
      const d = parseDuration(inline);
      if (!d) { issues.push({ line: tok.line, col: tok.col, message: `Unknown duration ":${inline}". Use w h q 8 16 32, add "." for dotted, "t" for triplet`, severity: 'error' }); continue; }
      dur = d;
      if (s === '') continue; // bare duration change like ":8"
    }
    if (s === 'r') { pushEvent([], tok); continue; }
    if (s.startsWith('(')) {
      const inner = s.slice(1, -1).trim().split(/\s+/).filter(Boolean);
      const notes = inner.map(x => parseNote(x, tok)).filter((x): x is Note => !!x);
      if (notes.length) pushEvent(notes, tok);
      continue;
    }
    const n = parseNote(s, tok);
    if (n) pushEvent([n], tok);
  }
  if (st.cur) closeBar({ text: '', line: lines.length, col: 1 });
  if (!bars.length) issues.push({ line: 1, col: 1, message: 'No bars yet. Add notes like:  :q 3.4 5.4 3.3 5.3 |', severity: 'warning' });
  return { song: { meta, bars }, issues };
}
