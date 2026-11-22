import { INSTRUMENTS, customInstrument, type Instrument } from './instruments';
import { LEVELS, PPQ, barTicks, type Approach, type Bar, type Level, type Note, type NoteEvent, type Song, type Version } from './model';
import { APPROACH_MARK, approachOf, sourceOf } from './technique';
import { NO_TOKEN, hinted, spanOf, valueSpan, type IssueSpan, type ParseIssue, type SongIssueCode } from './parseIssue';

export interface ParseResult { song: Song; issues: ParseIssue[] }

const VALUES: Record<string, number> = { w: 4 * PPQ, h: 2 * PPQ, q: PPQ, '8': PPQ / 2, '16': PPQ / 4, '32': PPQ / 8 };
const HEADER = /^\s*(title|artist|about|level|listen|instrument|tuning|tempo|key|time|clef)\s*:\s*(.*?)\s*$/i;

interface Tok { text: string; line: number; col: number }

function tokenize(src: string, firstLine: number): Tok[] {
  const toks: Tok[] = [];
  src.split('\n').forEach((raw, i) => {
    const line = firstLine + i;
    const hash = raw.search(/(^|\s)#/);
    const text = hash >= 0 ? raw.slice(0, hash) : raw;
    if (/^\s*@/.test(text)) { toks.push({ text: text.trim(), line, col: text.indexOf('@') + 1 }); return; }
    if (/^\s*level\s*:/i.test(text)) { toks.push({ text: text.trim(), line, col: text.search(/\S/) + 1 }); return; }
    if (/^\s*==/.test(text)) { toks.push({ text: text.trim(), line, col: text.indexOf('=') + 1 }); return; }
    const re = /"[^"]*"|\{[^}]*\}|<[^>]*>|_?\([^)]*\)(:[^\s|]+)?|\[[^\]]*\]|\||[^\s|]+/g;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(text))) toks.push({ text: mt[0], line, col: mt.index + 1 });
  });
  return toks;
}

function isWebAddress(v: string): boolean {
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.'); } catch { return false; }
}

const asLevel = (v: string): Level | undefined => LEVELS.find(l => l === v.toLowerCase());
const LEVEL_HELP = (v: string) => `Level must be one of: ${LEVELS.join(', ')} (got "${v}")`;

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

export interface HeaderLine { key: string; line: number }

// Leaves out a line with no value: it sets nothing a song can rely on.
export function headerLines(src: string): HeaderLine[] {
  const found: HeaderLine[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  for (const [i, line] of lines.entries()) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const h = HEADER.exec(line);
    if (!h) break;
    if (h[2].replace(/(^|\s)#.*$/, '').trim()) found.push({ key: h[1].toLowerCase(), line: i + 1 });
  }
  return found;
}

export const headerKeys = (src: string) => new Set(headerLines(src).map(header => header.key));

type IssueDetails = Pick<ParseIssue, 'message' | 'hint' | 'beats' | 'expected'>;

export function parseSong(src: string): ParseResult {
  const issues: ParseIssue[] = [];
  const report = (severity: ParseIssue['severity'], code: SongIssueCode, at: IssueSpan, details: IssueDetails | string) =>
    issues.push({ ...at, code, severity, ...(typeof details === 'string' ? { message: details } : details) });
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const meta = { title: 'Untitled', artist: undefined as string | undefined, about: undefined as string | undefined, level: undefined as Level | undefined, listen: undefined as string | undefined, tempo: 90, key: 'C', instrument: INSTRUMENTS.bass4 as Instrument };
  let time: [number, number] = [4, 4];
  let tuning: { value: string; at: IssueSpan } | null = null; let clef: 'bass' | 'treble' | undefined;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(#.*)?$/.test(l)) { bodyStart = i + 1; continue; }
    if (/^\s*---\s*$/.test(l)) { bodyStart = i + 1; break; }
    const h = HEADER.exec(l);
    if (!h) { bodyStart = i; break; }
    const [, k, raw] = h; const key = k.toLowerCase();
    const v = raw.replace(/(^|\s)#.*$/, '').trim();
    const at = valueSpan(l, i + 1, v);
    if (key === 'title') meta.title = v;
    else if (key === 'artist') meta.artist = v;
    else if (key === 'about') meta.about = v;
    else if (key === 'level') { const lv = asLevel(v); if (lv) meta.level = lv; else report('error', 'level-unknown', at, LEVEL_HELP(v)); }
    else if (key === 'listen') { if (isWebAddress(v)) meta.listen = v; else report('error', 'listen-address', at, `"listen:" needs a web address starting with https://`); }
    else if (key === 'tempo') { const t = parseFloat(v); if (t >= 20 && t <= 400) meta.tempo = t; else report('error', 'tempo-range', at, `Tempo must be between 20 and 400 (got "${v}")`); }
    else if (key === 'key') meta.key = v;
    else if (key === 'instrument') { if (INSTRUMENTS[v]) meta.instrument = INSTRUMENTS[v]; else report('error', 'instrument-unknown', at, hinted(`Unknown instrument "${v}".`, `Use one of: ${Object.keys(INSTRUMENTS).join(', ')} (or a "tuning:" line)`)); }
    else if (key === 'tuning') tuning = { value: v, at };
    else if (key === 'clef') clef = v === 'treble' ? 'treble' : 'bass';
    else if (key === 'time') { const t = /^(\d+)\/(\d+)$/.exec(v); if (t) time = [+t[1], +t[2]]; else report('error', 'time-signature', at, `Time signature like 4/4 expected`); }
    bodyStart = i + 1;
  }
  if (tuning) { try { meta.instrument = customInstrument(tuning.value, clef); } catch (e) { report('error', 'tuning-unreadable', tuning.at, (e as Error).message); } }
  else if (clef) meta.instrument = { ...meta.instrument, clef };
  const strings = meta.instrument.tuning.length;

  const headerTime: [number, number] = [time[0], time[1]];
  const versions: Version[] = [];
  let versionName = 'Main'; let versionLine = 0; let versionLevel: Level | undefined;
  let versionAt = NO_TOKEN;
  const versionLines = new Map<Version, IssueSpan>();
  const version = (): Version => {
    const made = { name: versionName, bars, ...(versionLevel ? { level: versionLevel } : {}), ...(versionLine ? { line: versionLine } : {}) };
    versionLines.set(made, versionAt);
    return made;
  };
  let bars: Bar[] = [];
  const mutedStrings = new Set<number>();
  const palmStrings = new Set<number>();
  const st = { cur: null as Bar | null, notesAt: NO_TOKEN, startAt: null as Tok | null }; let t = 0;
  let dur = parseDuration('q')!;
  let pendingTempo: number | undefined;
  let pendingChord: string | undefined; let pendingText: string | undefined; let pendingLyric: string | undefined; let pendingSection: string | undefined;
  const beatsOf = (ticks: number) => Number((ticks / PPQ).toFixed(2));
  const expectedBeats = (bar: Bar) => bar.beats * 4 / bar.beatValue;
  const newBar = (tok: Tok): Bar => {
    const start = st.startAt ?? tok;
    const b: Bar = { index: bars.length + 1, beats: time[0], beatValue: time[1], events: [], line: start.line, col: start.col, section: pendingSection };
    st.startAt = null;
    st.notesAt = spanOf(tok);
    if (pendingTempo !== undefined) b.tempo = pendingTempo;
    pendingTempo = undefined; pendingSection = undefined; bars.push(b); t = 0; return b;
  };
  const closeBar = () => {
    if (!st.cur) return;
    const full = barTicks(st.cur);
    if (t < full && st.cur.events.length) {
      const beats = beatsOf(t); const expected = expectedBeats(st.cur);
      report('warning', 'bar-short', st.notesAt, { message: `Bar ${st.cur.index} has ${beats} of ${expected} beats; filled with a rest`, beats, expected });
      st.cur.events.push({ start: t, dur: full - t, notes: [], value: 'q', dots: 0, triplet: false });
    }
    if (!st.cur.events.length) bars.pop();
    st.cur = null; st.startAt = null;
  };
  const parseNote = (s: string, at: IssueSpan): Note | null => {
    const r = /^([~hp]?)(\d{1,2}|[xX])\.(\d{1,2})$/.exec(s);
    const dead = /^[xX]$/.test(r?.[2] ?? '');
    if (!r || (dead && r[1])) { report('error', 'note-unreadable', at, hinted(`Can't read "${s}".`, 'Notes are fret.string, e.g. 3.4 (fret 3 on string 4)')); return null; }
    const fret = dead ? 0 : +r[2], string = +r[3];
    if (string < 1 || string > strings) { report('error', 'string-missing', at, `String ${string} doesn't exist on this ${strings}-string instrument`); return null; }
    if (fret > meta.instrument.maxFret) { report('error', 'fret-high', at, `Fret ${fret} is above the instrument's ${meta.instrument.maxFret} frets`); return null; }
    const approach = approachOf(r[1]);
    const joined = approach && legatoFits(approach, fret, string, s, at) ? { approach } : {};
    return { string, fret, ...(r[1] === '~' ? { tie: true } : {}), ...joined, ...(dead ? { dead: true } : {}) };
  };
  const legatoFits = (approach: Approach, fret: number, string: number, s: string, at: IssueSpan): boolean => {
    const source = sourceOf(bars.at(-1)?.events.at(-1), { string });
    const target = `${fret}.${string}`;
    if (!source) report('error', 'legato-source', at, hinted(`"${s}" has no note on string ${string} right before it.`, 'A hammer-on or pull-off starts from the note before, on the same string'));
    else if (source.fret === fret) report('error', 'legato-direction', at, hinted(`"${s}" stays on fret ${fret}.`, `Use ~${target} to hold the note`));
    else if (approach === 'hammer' && fret < source.fret) report('error', 'legato-direction', at, hinted(`A hammer-on goes to a higher fret, but "${s}" comes from fret ${source.fret}.`, `Use ${APPROACH_MARK.pull}${target} for a pull-off`));
    else if (approach === 'pull' && fret > source.fret) report('error', 'legato-direction', at, hinted(`A pull-off goes to a lower fret, but "${s}" comes from fret ${source.fret}.`, `Use ${APPROACH_MARK.hammer}${target} for a hammer-on`));
    else return true;
    return false;
  };
  const pushEvent = (notes: Note[], tok: Tok, palmMute = false) => {
    if (!st.cur) st.cur = newBar(tok);
    else if (tok.line === st.notesAt.line) st.notesAt = { ...st.notesAt, length: tok.col + tok.text.length - st.notesAt.col };
    const full = barTicks(st.cur);
    if (t + dur.ticks > full + 0.001) {
      const expected = expectedBeats(st.cur);
      report('error', 'bar-long', spanOf(tok), { ...hinted(`Bar ${st.cur.index} is too long: this note goes past ${expected} beats`, '(missing a "|"?)'), beats: beatsOf(t + dur.ticks), expected });
    }
    const strs = notes.map(n => n.string);
    if (new Set(strs).size !== strs.length) report('error', 'string-twice', spanOf(tok), 'Two notes on the same string in one chord');
    if (notes.some(n => n.tie && mutedStrings.has(n.string))) report('error', 'tie-dead', spanOf(tok), "A tie can't hold a dead note. Write the dead note again, such as x.3");
    for (const n of notes) { if (n.dead) mutedStrings.add(n.string); else mutedStrings.delete(n.string); }
    const ev: NoteEvent = { start: t, dur: dur.ticks, notes, value: dur.value, dots: dur.dots, triplet: dur.triplet };
    if (pendingChord) ev.chord = pendingChord; if (pendingText) ev.text = pendingText; if (pendingLyric) ev.lyric = pendingLyric;
    // A tie keeps the palm mute of the note it holds, so the held part does not ring out.
    if (palmMute || (notes.length > 0 && notes.every(n => n.tie && palmStrings.has(n.string)))) ev.palmMute = true;
    for (const n of notes) { if (ev.palmMute) palmStrings.add(n.string); else palmStrings.delete(n.string); }
    pendingChord = pendingText = pendingLyric = undefined;
    st.cur.events.push(ev); t += dur.ticks;
  };

  for (const tok of tokenize(lines.slice(bodyStart).join('\n'), bodyStart + 1)) {
    let s = tok.text;
    if (s.startsWith('@')) { if (st.cur && st.cur.events.length) closeBar(); pendingSection = s.slice(1).trim(); continue; }
    if (!st.cur && !st.startAt && !s.startsWith('==') && !/^level\s*:/i.test(s) && s !== '|') st.startAt = tok;
    if (s.startsWith('==')) {
      // a new version of the song: finish the current one and start counting bars again
      closeBar();
      const name = s.replace(/^=+/, '').trim() || `Version ${versions.length + 1}`;
      if (bars.length || versionLine) versions.push(version());
      else if (versions.length === 0 && pendingSection) { /* section before the first version applies to it */ }
      bars = []; mutedStrings.clear(); palmStrings.clear(); st.startAt = null; versionName = name; versionLine = tok.line; versionAt = spanOf(tok); versionLevel = undefined;
      pendingTempo = undefined;
      time = [headerTime[0], headerTime[1]]; dur = parseDuration('q')!; pendingChord = pendingText = pendingLyric = undefined;
      if (versions.some(v => v.name === name)) report('warning', 'version-duplicate', spanOf(tok), `There is already a version called "${name}"`);
      continue;
    }
    if (/^level\s*:/i.test(s)) {
      const v = s.replace(/^level\s*:/i, '').trim(); const lv = asLevel(v);
      if (lv) versionLevel = lv; else report('error', 'level-unknown', valueSpan(s, tok.line, v, tok.col), LEVEL_HELP(v));
      continue;
    }
    if (s === '|') { closeBar(); continue; }
    if (s.startsWith('[tempo=')) {
      const match = /^\[tempo=(\d+(?:\.\d+)?)\]$/.exec(s);
      const tempo = match ? Number(match[1]) : NaN;
      if (!Number.isFinite(tempo) || tempo < 20 || tempo > 400) {
        report('error', 'tempo-range', spanOf(tok), hinted('Tempo must be between 20 and 400', 'e.g. [tempo=130]', ', '));
      } else if (st.cur?.events.length) {
        report('error', 'tempo-late', spanOf(tok), 'Put tempo changes before the first note of a bar');
      } else pendingTempo = tempo;
      continue;
    }
    if (s.startsWith('[')) {
      const r = /^\[(\d+)\/(\d+)\]$/.exec(s);
      if (!r) { report('error', 'time-signature', spanOf(tok), `Time signature like [3/4] expected`); continue; }
      time = [+r[1], +r[2]];
      if (st.cur && !st.cur.events.length) { st.cur.beats = time[0]; st.cur.beatValue = time[1]; }
      continue;
    }
    if (s.startsWith('"')) { pendingChord = s.slice(1, -1); continue; }
    if (s.startsWith('{')) { pendingText = s.slice(1, -1).trim(); continue; }
    if (s.startsWith('<') && s.endsWith('>')) { pendingLyric = s.slice(1, -1).trim(); continue; }
    // optional inline duration: token:dur
    let inline: string | null = null;
    const ci = s.lastIndexOf(':');
    if (ci >= 0) { inline = s.slice(ci + 1); s = s.slice(0, ci); }
    if (inline !== null) {
      const d = parseDuration(inline);
      if (!d) { report('error', 'duration-unknown', { line: tok.line, col: tok.col + ci, length: inline.length + 1 }, hinted(`Unknown duration ":${inline}".`, 'Use w h q 8 16 32, add "." for dotted, "t" for triplet')); continue; }
      dur = d;
      if (s === '') continue; // bare duration change like ":8"
    }
    const palmMute = s.startsWith('_');
    if (palmMute) s = s.slice(1);
    if (palmMute && (s === '' || s === 'r')) report('error', 'palm-mute-place', spanOf(tok), `"_" goes before a note or a chord, not a rest`);
    if (s === '') continue;
    if (s === 'r') { pushEvent([], tok); continue; }
    if (s.startsWith('(')) {
      const at = tok.col + (palmMute ? 2 : 1);
      const inner = [...s.slice(1, -1).matchAll(/\S+/g)];
      const notes = inner.map(x => {
        const span = { line: tok.line, col: at + x.index, length: x[0].length };
        if (!x[0].startsWith('_')) return parseNote(x[0], span);
        report('error', 'palm-mute-place', span, hinted(`"_" goes before the bracket, so it mutes the whole chord.`, 'e.g. _(0.6 2.5)'));
        return parseNote(x[0].slice(1), { ...span, col: span.col + 1, length: span.length - 1 });
      }).filter((x): x is Note => !!x);
      if (notes.length) pushEvent(notes, tok, palmMute);
      continue;
    }
    const n = parseNote(s, { line: tok.line, col: tok.col + (palmMute ? 1 : 0), length: s.length });
    if (n) pushEvent([n], tok, palmMute);
  }
  if (st.cur) closeBar();
  if (bars.length || !versions.length) versions.push(version());
  if (versions.every(v => !v.bars.length)) report('warning', 'song-empty', NO_TOKEN, hinted('No bars yet.', 'Add notes like:  :q 3.4 5.4 3.3 5.3 |'));
  for (const v of versions) if (!v.bars.length && versions.length > 1) report('warning', 'version-empty', versionLines.get(v) ?? NO_TOKEN, `Version "${v.name}" has no bars`);
  return { song: { meta, bars: versions[0].bars, versions }, issues };
}
