import { Barline, Beam, Dot, Formatter, Renderer, StaveNote, Stem, TabNote, TabStave, Tuplet, Voice, type StemmableNote, type TabNotePosition } from 'vexflow';
import { PPQ, type Bar, type Note, type NoteEvent, type Song } from '../core/model';
import { onsetKey } from '../core/timeline';
import { barWidths, labelRows, lineBreaks, timeSignatureDigitHeight } from '../app/sheetLayout';

export interface RenderOptions { barsPerLine: number; width: number; touchSize: number }

const TABLE: [number, string, number, boolean][] = [
  [4 * PPQ, 'w', 0, false], [3 * PPQ, 'h', 1, false], [2 * PPQ, 'h', 0, false], [1.5 * PPQ, 'q', 1, false], [PPQ, 'q', 0, false],
  [0.75 * PPQ, '8', 1, false], [0.5 * PPQ, '8', 0, false], [PPQ / 3, '8', 0, true], [0.25 * PPQ, '16', 0, false], [PPQ / 6, '16', 0, true], [PPQ / 8, '32', 0, false],
];
/** Pieces used to notate an event: its own written value when it has one, else tied standard values. */
function pieces(e: NoteEvent): [string, number, boolean][] {
  if (e.value) return [[e.value, e.dots, e.triplet]];
  const out: [string, number, boolean][] = []; let d = e.dur;
  while (d > 0.5) { const t = TABLE.find(x => x[0] <= d + 0.01)!; out.push([t[1], t[2], t[3]]); d -= t[0]; }
  return out;
}

type TabTickable = TabNote | StaveNote;

const fretLabel = (n: Note, continued: boolean) => {
  const fret = n.dead ? 'X' : String(n.fret);
  return continued || n.tie ? `(${fret})` : fret;
};
const STRING_SPACE = 13, RHYTHM_GLYPH_SCALE = 26;

function tabNote(positions: TabNotePosition[], duration: string, dots: number): TabNote {
  const note = new TabNote({ positions, duration, dots }, true);
  note.render_options.glyph_font_scale = RHYTHM_GLYPH_SCALE;
  if (duration !== 'w') note.setStemLength(duration === 'h' ? STRING_SPACE : 2 * STRING_SPACE);
  note.setStemDirection(Stem.DOWN);
  return note;
}

const centreRest = (rest: StaveNote, nStr: number) => rest.setKeyLine(0, 5 - (nStr - 1) / 2);

function tabRest(duration: string, dots: number, nStr: number): StaveNote {
  return centreRest(new StaveNote({ keys: ['b/4'], duration: duration + 'r', dots }), nStr);
}

function beamsFor(notes: StemmableNote[], triplets: StemmableNote[][], bar: Bar): Beam[] {
  const inTrip = new Set(triplets.flat());
  const groups = Beam.getDefaultBeamGroups(`${bar.beats}/${bar.beatValue}`);
  const beams = Beam.generateBeams(notes.filter(n => !inTrip.has(n)), { stem_direction: Stem.DOWN, groups });
  triplets.forEach(grp => { const beamable = grp.filter(n => !n.isRest() && ['8', '16', '32'].includes(n.getDuration())); if (beamable.length >= 2) beams.push(new Beam(beamable)); });
  return beams;
}

function rhythmBottom(notes: TabTickable[], tuplets: Tuplet[]): number {
  const stems = notes.filter((n): n is TabNote => n instanceof TabNote && n.hasStem()).map(n => n.getStemExtents().topY);
  const marks = tuplets.map(t => t.getYPosition() + 14);
  return Math.max(0, ...stems, ...marks);
}

export function renderSong(host: HTMLElement, song: Song, opt: RenderOptions): void {
  host.innerHTML = '';
  const { tuning } = song.meta.instrument;
  let beat = 0; const barStart: Record<number, number> = {};
  for (const b of song.bars) { barStart[b.index] = beat; beat += (b.beats * 4) / b.beatValue; }
  const c: Ctx = { tuning, nStr: tuning.length, tempo: song.meta.tempo, opt, barStart };
  const changes = song.bars.map((bar, i) => timeSignatureChanges(bar, song.bars[i - 1]));
  const room = noteStartOffset(c);
  const mins = song.bars.map((bar, i) => barMinWidth(bar, barNotes(bar, c).minWidth, changes[i], room, c));
  let i = 0;
  for (const count of lineBreaks(mins, sheetWidth(opt) - 12, opt.barsPerLine)) {
    const group = song.bars.slice(i, i + count);
    const sys = document.createElement('div');
    sys.className = 'system'; sys.dataset.first = String(group[0].index); sys.dataset.last = String(group[group.length - 1].index);
    host.appendChild(sys);
    try {
      const rows = drawSystem(sys, group, song.bars[i - 1], c, 1);
      if (rows > 1) { sys.innerHTML = ''; drawSystem(sys, group, song.bars[i - 1], c, rows); }
    }
    catch (e) { sys.textContent = `Bars ${group[0].index} to ${group[group.length - 1].index} could not be drawn: ${(e as Error).message}`; sys.classList.add('error'); }
    i += count;
  }
}

interface Ctx { tuning: number[]; nStr: number; tempo: number; opt: RenderOptions; barStart: Record<number, number> }

const SHEET_MUT = '#5c5c5c', SHEET_LINE = '#c4c4c4';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DIGIT_CAP_HEIGHT = 0.73, DIGIT_WIDTH = 0.62;
const ROW = { barNo: 0.4 * STRING_SPACE, label: 1.4 * STRING_SPACE, section: 2.8 * STRING_SPACE };
const LOOP_MARK_HEIGHT = 3, LABEL_ROW = 1.1 * STRING_SPACE, LABEL_GAP = 6, NOTE_ROOM = 1.15, FORMAT_PAD = 12;

function svgRect(className: string, x: number, y: number, width: number, height: number): SVGRectElement {
  const el = document.createElementNS(SVG_NS, 'rect');
  el.setAttribute('class', className); el.setAttribute('x', String(x)); el.setAttribute('y', String(y));
  el.setAttribute('width', String(width)); el.setAttribute('height', String(height));
  return el;
}

function svgText(svg: SVGSVGElement, className: string, x: number, y: number, text: string): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('class', className); el.setAttribute('x', String(x)); el.setAttribute('y', String(y));
  el.textContent = text; svg.append(el);
  return el;
}

function tabLineTop(bars: Bar[], firstSystem: boolean, lift: number): number {
  const [row, size] = firstSystem || bars.some(b => b.section || b.tempo !== undefined) ? [ROW.section, 11]
    : bars.some(b => b.events.some(e => e.chord || e.text)) ? [ROW.label, 12] : [ROW.barNo, 9];
  return Math.round(row + size * DIGIT_CAP_HEIGHT + STRING_SPACE / 2 + lift);
}

const timeSignatureFontSize = (nStr: number) => 0.85 * timeSignatureDigitHeight(nStr, STRING_SPACE) / DIGIT_CAP_HEIGHT;
const timeSignatureWidth = (bar: Bar, nStr: number) => Math.max(String(bar.beats).length, String(bar.beatValue).length) * timeSignatureFontSize(nStr) * DIGIT_WIDTH;

function drawTimeSignature(svg: SVGSVGElement, tab: TabStave, left: number, bar: Bar, nStr: number) {
  const height = timeSignatureDigitHeight(nStr, STRING_SPACE); const x = left + timeSignatureWidth(bar, nStr) / 2;
  const middle = (tab.getYForLine(0) + tab.getYForLine(nStr - 1)) / 2;
  [[bar.beats, middle], [bar.beatValue, middle + height]].forEach(([digits, y]) => {
    svgText(svg, 'time-sig', x, y, String(digits)).style.fontSize = `${timeSignatureFontSize(nStr)}px`;
  });
}

function drawTempo(svg: SVGSVGElement, section: SVGTextElement | null, x: number, y: number, tempo: number) {
  const text = `\u2669 = ${tempo}`;
  if (!section) { svgText(svg, 'tempo-mark', x, y, text); return; }
  const mark = document.createElementNS(SVG_NS, 'tspan');
  mark.setAttribute('class', 'tempo-mark'); mark.setAttribute('dx', '8'); mark.textContent = text;
  section.append(mark);
}

interface BarNotes {
  tn: TabTickable[]; targets: { note: TabTickable; event: NoteEvent }[]; labels: [TabTickable, NoteEvent][]; lyricAt: [TabTickable, string][];
  voice: Voice; beams: Beam[]; tups: Tuplet[]; formatter: Formatter; minWidth: number;
}

function barNotes(bar: Bar, c: Ctx): BarNotes {
  const tn: TabTickable[] = [];
  const targets: { note: TabTickable; event: NoteEvent }[] = [];
  const trip: TabTickable[][] = [];
  let g: TabTickable[] = [];
  const labels: [TabTickable, NoteEvent][] = [];
  const lyricAt: [TabTickable, string][] = [];
  for (const ev of bar.events) {
    pieces(ev).forEach(([val, dots, isT], pi) => {
      const sorted = [...ev.notes].sort((a, b) => (c.tuning[a.string - 1] + a.fret) - (c.tuning[b.string - 1] + b.fret));
      const t = sorted.length
        ? tabNote(sorted.map(n => ({ str: n.string, fret: fretLabel(n, pi > 0) })), val, dots)
        : tabRest(val, dots, c.nStr);
      if (dots) Dot.buildAndAttach([t]);
      if (isT) { g.push(t); if (g.length === 3) { trip.push(g); g = []; } }
      else if (g.length) { trip.push(g); g = []; }
      if (pi === 0 && (ev.chord || ev.text)) labels.push([t, ev]);
      if (pi === 0 && ev.lyric) lyricAt.push([t, ev.lyric]);
      tn.push(t); targets.push({ note: t, event: ev });
    });
  }
  if (g.length) trip.push(g);
  const voice = new Voice({ num_beats: bar.beats, beat_value: bar.beatValue }).setMode(Voice.Mode.SOFT).addTickables(tn);
  const beams = beamsFor(tn, trip, bar);
  const tups = trip.map(grp => new Tuplet(grp, { num_notes: 3, notes_occupied: 2, location: Tuplet.LOCATION_BOTTOM, bracketed: grp.some(n => !n.hasBeam()) }));
  tn.forEach(n => { if (n instanceof StaveNote) centreRest(n, c.nStr); });
  const formatter = new Formatter().joinVoices([voice]);
  return { tn, targets, labels, lyricAt, voice, beams, tups, formatter, minWidth: formatter.preCalculateMinTotalWidth([voice]) };
}

const sheetWidth = (opt: RenderOptions) => Math.max(240, opt.width);
const tabOptionsFor = (c: Ctx) => ({ num_lines: c.nStr, space_above_staff_ln: 0, fill_style: SHEET_LINE });
const noteStartOffset = (c: Ctx) => new TabStave(0, 0, 100, tabOptionsFor(c)).getNoteStartX();
const timeSignatureChanges = (bar: Bar, prev: Bar | undefined) => !prev || prev.beats !== bar.beats || prev.beatValue !== bar.beatValue;
const barMinWidth = (bar: Bar, notesWidth: number, tsChange: boolean, noteStart: number, c: Ctx) =>
  notesWidth * NOTE_ROOM + noteStart + FORMAT_PAD + (tsChange ? timeSignatureWidth(bar, c.nStr) + STRING_SPACE / 2 : 0);

function labelWidth(el: SVGTextElement): number {
  try { const w = el.getComputedTextLength(); if (w > 0) return w; } catch { /* not laid out */ }
  return (el.textContent ?? '').length * 7;
}

function drawSystem(div: HTMLDivElement, bars: Bar[], prev: Bar | undefined, c: Ctx, rows: number): number {
  const W = sheetWidth(c.opt);
  const lift = (rows - 1) * LABEL_ROW;
  const top = tabLineTop(bars, !prev, lift);
  const H = top + 40 + c.nStr * 13 + 30; // provisional; resized to the real tab bottom below
  const r = new Renderer(div, Renderer.Backends.SVG); r.resize(W, H); const ctx = r.getContext();
  const svg = div.querySelector('svg')!;
  const tabOptions = tabOptionsFor(c);
  const noteStart = noteStartOffset(c);
  const tsChanges = bars.map((bar, bi) => timeSignatureChanges(bar, bi === 0 ? prev : bars[bi - 1]));
  const notes = bars.map(bar => barNotes(bar, c));
  const mins = notes.map((n, bi) => barMinWidth(bars[bi], n.minWidth, tsChanges[bi], noteStart, c));
  let x = 6; const avail = W - 12; let bottom = 0;
  const widths = barWidths(avail, bars.map(b => 3 + b.events.length), mins);
  const lyrics: [number, string][] = [];
  const allLabels: SVGTextElement[] = [];
  const hits: SVGRectElement[] = [], loopMarks: SVGRectElement[] = [];
  bars.forEach((bar, bi) => {
    const bw = widths[bi];
    const tab = new TabStave(x, top, bw, tabOptions);
    const tsChange = tsChanges[bi];
    tab.getModifiers().forEach(m => { if (m instanceof Barline) m.setStyle({ fillStyle: SHEET_MUT }); });
    tab.setContext(ctx);
    const timeSigLeft = tab.getNoteStartX();
    let nsx = timeSigLeft;
    if (tsChange) nsx += timeSignatureWidth(bar, c.nStr) + STRING_SPACE / 2;
    tab.setNoteStartX(nsx);
    tab.draw(); bottom = Math.max(bottom, tab.getYForLine(c.nStr - 1));
    if (tsChange) drawTimeSignature(svg, tab, timeSigLeft, bar, c.nStr);
    const { tn, targets, labels, lyricAt, voice: tv, beams, tups, formatter } = notes[bi];
    formatter.format([tv], bw - (nsx - x) - FORMAT_PAD);
    tv.draw(ctx, tab);
    beams.forEach(b => b.setContext(ctx).draw()); tups.forEach(t => t.setContext(ctx).draw());
    bottom = Math.max(bottom, rhythmBottom(tn, tups));
    labels.forEach(([n, ev]) => allLabels.push(svgText(svg, 'chord-label', n.getAbsoluteX() - 2, top - ROW.label, [ev.chord, ev.text].filter(Boolean).join('  '))));
    const sectionY = top - ROW.section - lift;
    const section = bar.section ? svgText(svg, 'section-label', x + 4, sectionY, bar.section.toUpperCase()) : null;
    svgText(svg, 'bar-no', x + 2, top - ROW.barNo, String(bar.index)).dataset.bar = String(bar.index);
    const loopMark = svgRect('loop-mark', x, 0, bw, LOOP_MARK_HEIGHT);
    loopMark.dataset.bar = String(bar.index);
    loopMarks.push(loopMark);
    if (bar.tempo !== undefined || !prev && bi === 0) drawTempo(svg, section, x + 4, sectionY, bar.tempo ?? c.tempo);
    lyricAt.forEach(([n, words]) => lyrics.push([n.getAbsoluteX() - 2, words]));
    const target = svgRect('bar-target', x, 0, bw, 0);
    target.setAttribute('tabindex', '0'); target.setAttribute('role', 'button');
    target.setAttribute('aria-label', `Select bar ${bar.index}`);
    target.dataset.bar = String(bar.index);
    const barNumber = svgRect('bar-no-target', x, Math.max(0, top - 2 - c.opt.touchSize), Math.min(bw, c.opt.touchSize), c.opt.touchSize);
    barNumber.setAttribute('tabindex', '0'); barNumber.setAttribute('role', 'button');
    barNumber.setAttribute('aria-label', `Bar ${bar.index}, set loop`);
    barNumber.dataset.bar = String(bar.index);
    hits.push(target, barNumber);
    targets.forEach(({ note, event }, index) => {
      if (!event.notes.length) return;
      const key = onsetKey(c.barStart[bar.index] + event.start / PPQ);
      const center = note.getAbsoluteX() + 5;
      const left = index ? (targets[index - 1].note.getAbsoluteX() + 5 + center) / 2 : x;
      const right = index + 1 < targets.length ? (center + targets[index + 1].note.getAbsoluteX() + 5) / 2 : x + bw;
      const id = note.getAttribute('id'); const el = div.querySelector<SVGElement>('#vf-' + CSS.escape(String(id)));
      if (el) { el.classList.add('note'); el.dataset.key = key; }
      const ys = note.getYs();
      const hit = document.createElementNS(SVG_NS, 'rect');
      const hitLeft = Math.max(left, center - 12); const hitRight = Math.min(right, center + 12);
      hit.setAttribute('x', String(hitLeft)); hit.setAttribute('y', String(Math.min(...ys) - 12));
      hit.setAttribute('width', String(Math.max(0, hitRight - hitLeft)));
      hit.setAttribute('height', String(Math.max(...ys) - Math.min(...ys) + 24));
      hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', `Select note in bar ${bar.index}, beat ${Number((event.start / PPQ * bar.beatValue / 4 + 1).toFixed(3))}`);
      hit.setAttribute('aria-pressed', 'false');
      hit.classList.add('note-target'); hit.dataset.key = key; hit.dataset.bar = String(bar.index);
      hits.push(hit);
    });
    x += bw;
  });
  lyrics.forEach(([px, words]) => svgText(svg, 'lyric', px, bottom + STRING_SPACE + 11, words));
  const end = Math.ceil(bottom + (lyrics.length ? STRING_SPACE + 18 : 14));
  hits.forEach(hit => { if (hit.classList.contains('bar-target')) hit.setAttribute('height', String(Math.min(bottom + 24, end))); });
  svg.prepend(...loopMarks);
  svg.append(...hits);
  r.resize(W, end);
  const spans = allLabels.map(el => {
    const width = labelWidth(el);
    const left = Math.max(2, Math.min(Number(el.getAttribute('x')), W - 2 - width));
    el.setAttribute('x', String(left));
    return { left, width };
  });
  const placed = labelRows(spans, LABEL_GAP);
  placed.forEach((row, i) => allLabels[i].setAttribute('y', String(top - ROW.label - row * LABEL_ROW)));
  return Math.max(1, ...placed.map(row => row + 1));
}
