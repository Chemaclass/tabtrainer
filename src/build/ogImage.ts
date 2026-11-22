import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import type { Note, Song } from '../core/model';
import { genreName, type Groove } from '../core/groove';
import { chordAt } from '../core/harmony';
import { escapeHtml } from './sharePages';

export const CARD_WIDTH = 1200, CARD_HEIGHT = 630;
const INK = '#111111', MUTED = '#5f6368', LINE = '#c4c7cc', ACCENT = '#e0312b', PAPER = '#ffffff';
const LEFT = 80, RIGHT = CARD_WIDTH - 80, STAFF_TOP = 400;
const TITLE_FONT = 'Inter Tight ExtraBold', TEXT_FONT = 'Inter Medium', MONO_FONT = 'JetBrains Mono Medium';

type Column = 'bar' | { notes: Note[]; chord?: string };
export interface Card { kicker: string; title: string; details: string[]; staff: { strings: number; columns: Column[] } | { chords: string[] } }

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const TAB_COLUMNS = 18;

export function songCard(song: Song, family: string): Card {
  const { meta } = song;
  const columns: Column[] = [];
  let chord: string | undefined;
  for (const bar of song.bars) {
    if (columns.filter(c => c !== 'bar').length >= TAB_COLUMNS) break;
    let played = false;
    for (const event of bar.events) {
      chord = event.chord ?? chord;
      if (!event.notes.length) continue;
      columns.push({ notes: event.notes, chord });
      chord = undefined;
      played = true;
    }
    if (played) columns.push('bar');
  }
  return {
    kicker: `${family} tab`,
    title: meta.title,
    details: [meta.artist === 'TabTrainer' ? undefined : meta.artist, `Key ${meta.key}`, `${meta.tempo} BPM`, meta.level && capitalize(meta.level)].filter((d): d is string => Boolean(d)),
    staff: { strings: meta.instrument.tuning.length, columns },
  };
}

const CHART_BARS = 8;
export function grooveCard(groove: Groove): Card {
  return {
    kicker: `${genreName(groove.genre)} groove`,
    title: groove.title,
    details: [`Key ${groove.key}`, `${groove.tempo} BPM`, groove.time.join('/')],
    staff: { chords: Array.from({ length: CHART_BARS }, (_, bar) => chordAt(groove.progression, groove.key, bar).name) },
  };
}

// Inter Tight ExtraBold runs about 0.56em per character; wrapping by count keeps the build free of a text layout engine.
const TITLE_WIDTH_PER_EM = 0.56;
function titleLines(title: string): { size: number; lines: string[] } {
  for (const size of [92, 76, 64]) {
    const perLine = Math.floor((RIGHT - LEFT) / (size * TITLE_WIDTH_PER_EM));
    const lines = wrapWords(title, perLine);
    if (lines.length <= 2) return { size, lines };
  }
  const perLine = Math.floor((RIGHT - LEFT) / (64 * TITLE_WIDTH_PER_EM));
  const [first, second] = wrapWords(title, perLine);
  return { size: 64, lines: [first, `${second.slice(0, perLine - 1).trimEnd()}…`] };
}

function wrapWords(text: string, perLine: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/).flatMap(word => word.match(new RegExp(`.{1,${perLine}}`, 'gu')) ?? []);
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= perLine) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const text = (x: number, y: number, font: string, size: number, fill: string, value: string, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}"${extra}>${escapeHtml(value)}</text>`;

function tabStaff(strings: number, columns: Column[]): string {
  const gap = strings > 4 ? 24 : 30, top = STAFF_TOP + (strings > 4 ? 10 : 20);
  const bottom = top + (strings - 1) * gap;
  const barLine = (x: number) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${INK}" stroke-width="2"/>`;
  const marks = [barLine(LEFT)];
  const step = 54;
  let x = LEFT + step * 0.7, end = RIGHT;
  for (const [i, column] of columns.entries()) {
    if (x > RIGHT - step * 0.4) break;
    if (column === 'bar') {
      const at = x - step * 0.35;
      marks.push(barLine(at));
      if (i === columns.length - 1) end = at;
      x += step * 0.3;
      continue;
    }
    if (column.chord) marks.push(text(x, top - 22, TEXT_FONT, 24, INK, column.chord, ' text-anchor="middle"'));
    for (const note of column.notes) {
      const y = top + (note.string - 1) * gap;
      const fret = note.dead ? 'x' : String(note.fret);
      const label = note.tie ? `(${fret})` : fret;
      marks.push(`<rect x="${x - label.length * 9 - 4}" y="${y - 14}" width="${label.length * 18 + 8}" height="28" fill="${PAPER}"/>`);
      marks.push(text(x, y + 10, MONO_FONT, 28, INK, label, ' text-anchor="middle"'));
    }
    x += step;
  }
  const lines = Array.from({ length: strings }, (_, i) => `<line x1="${LEFT}" y1="${top + i * gap}" x2="${end}" y2="${top + i * gap}" stroke="${LINE}" stroke-width="2"/>`);
  return [...lines, ...marks].join('');
}

function chordChart(chords: string[]): string {
  const width = (RIGHT - LEFT) / chords.length, top = STAFF_TOP + 10, bottom = top + 110;
  const marks = [`<line x1="${LEFT}" y1="${bottom}" x2="${RIGHT}" y2="${bottom}" stroke="${LINE}" stroke-width="2"/>`];
  chords.forEach((chord, i) => {
    const x = LEFT + i * width;
    marks.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${INK}" stroke-width="2"/>`);
    marks.push(text(x + 18, top + 64, MONO_FONT, 34, INK, chord));
  });
  marks.push(`<line x1="${RIGHT}" y1="${top}" x2="${RIGHT}" y2="${bottom}" stroke="${INK}" stroke-width="2"/>`);
  return marks.join('');
}

export function cardSvg(card: Card, siteLabel: string): string {
  const { size, lines } = titleLines(card.title);
  const titleTop = 200 + (lines.length === 1 ? 30 : 0);
  const title = lines.map((line, i) => text(LEFT, titleTop + i * size * 1.02, TITLE_FONT, size, INK, line, ' letter-spacing="-2"')).join('');
  const detailsY = titleTop + (lines.length - 1) * size * 1.02 + 56;
  const staff = 'chords' in card.staff ? chordChart(card.staff.chords) : tabStaff(card.staff.strings, card.staff.columns);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${PAPER}"/>
<g stroke="${INK}" stroke-width="3"><line x1="${LEFT}" y1="70" x2="${LEFT + 32}" y2="70"/><line x1="${LEFT}" y1="80" x2="${LEFT + 32}" y2="80"/><line x1="${LEFT}" y1="90" x2="${LEFT + 32}" y2="90"/></g>
<circle cx="${LEFT + 20}" cy="80" r="6.5" fill="${ACCENT}"/>
${text(LEFT + 48, 91, TITLE_FONT, 30, INK, 'TabTrainer', ' letter-spacing="-0.5"')}
${text(RIGHT, 91, TEXT_FONT, 24, ACCENT, card.kicker.toUpperCase(), ' text-anchor="end" letter-spacing="2"')}
${title}
${text(LEFT, detailsY, TEXT_FONT, 30, MUTED, card.details.join('  ·  '))}
${staff}
${text(LEFT, 600, TEXT_FONT, 22, MUTED, siteLabel)}
</svg>`;
}

const require = createRequire(import.meta.url);
const FONT_FILES = ['@fontsource/inter-tight/files/inter-tight-latin-800-normal.woff', '@fontsource/inter/files/inter-latin-500-normal.woff', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff'];

// resvg reads TrueType but not WOFF. WOFF 1 is the same tables, each zlib-compressed, so unpacking them gives the font back.
export function woffToSfnt(woff: Buffer): Buffer {
  const count = woff.readUInt16BE(12);
  const header = Buffer.alloc(12 + 16 * count);
  header.writeUInt32BE(woff.readUInt32BE(4), 0);
  header.writeUInt16BE(count, 4);
  const tables: Buffer[] = [];
  let offset = header.length;
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20;
    const at = woff.readUInt32BE(entry + 4), packed = woff.readUInt32BE(entry + 8), size = woff.readUInt32BE(entry + 12);
    const raw = woff.subarray(at, at + packed), data = packed < size ? inflateSync(raw) : raw;
    header.writeUInt32BE(woff.readUInt32BE(entry), 12 + i * 16);
    header.writeUInt32BE(woff.readUInt32BE(entry + 16), 16 + i * 16);
    header.writeUInt32BE(offset, 20 + i * 16);
    header.writeUInt32BE(size, 24 + i * 16);
    const padded = Buffer.alloc((data.length + 3) & ~3);
    data.copy(padded);
    tables.push(padded);
    offset += padded.length;
  }
  return Buffer.concat([header, ...tables]);
}

// resvg-js 2.6 ignores fontBuffers, so the unpacked fonts go through files.
const FONT_CACHE = 'node_modules/.cache/tabtrainer-fonts';
let fontFiles: string[] | undefined;
function unpackedFonts(): string[] {
  mkdirSync(FONT_CACHE, { recursive: true });
  return FONT_FILES.map(file => {
    const path = join(FONT_CACHE, basename(file).replace(/\.woff$/, '.ttf'));
    writeFileSync(path, woffToSfnt(readFileSync(require.resolve(file))));
    return path;
  });
}

export function cardPng(svg: string): Buffer {
  fontFiles ??= unpackedFonts();
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: TEXT_FONT } }).render().asPng();
}
