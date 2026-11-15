import { Barline, Beam, Dot, Formatter, Renderer, StaveNote, Stem, TabNote, TabStave, Tuplet, Voice, type StemmableNote, type TabNotePosition } from 'vexflow';
import { PPQ, type Bar, type NoteEvent, type Song } from '../core/model';
import { onsetKey } from '../core/timeline';
import { timeSignatureDigitHeight } from '../app/sheetLayout';

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
  for (let i = 0; i < song.bars.length; i += opt.barsPerLine) {
    const group = song.bars.slice(i, i + opt.barsPerLine);
    const sys = document.createElement('div');
    sys.className = 'system'; sys.dataset.first = String(group[0].index); sys.dataset.last = String(group[group.length - 1].index);
    host.appendChild(sys);
    try { drawSystem(sys, group, song.bars[i - 1], { tuning, nStr: tuning.length, tempo: song.meta.tempo, opt, barStart }); }
    catch (e) { sys.textContent = `Bars ${group[0].index} to ${group[group.length - 1].index} could not be drawn: ${(e as Error).message}`; sys.classList.add('error'); }
  }
}

interface Ctx { tuning: number[]; nStr: number; tempo: number; opt: RenderOptions; barStart: Record<number, number> }

const SHEET_MUT = '#5c5c5c', SHEET_LINE = '#c4c4c4';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DIGIT_CAP_HEIGHT = 0.73, DIGIT_WIDTH = 0.62;
const ROW = { barNo: 0.4 * STRING_SPACE, label: 1.4 * STRING_SPACE, section: 2.8 * STRING_SPACE };
const LOOP_MARK_HEIGHT = 3;

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

function tabLineTop(bars: Bar[], firstSystem: boolean): number {
  const [row, size] = firstSystem || bars.some(b => b.section || b.tempo !== undefined) ? [ROW.section, 11]
    : bars.some(b => b.events.some(e => e.chord || e.text)) ? [ROW.label, 12] : [ROW.barNo, 9];
  return Math.round(row + size * DIGIT_CAP_HEIGHT + STRING_SPACE / 2);
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

function drawSystem(div: HTMLDivElement, bars: Bar[], prev: Bar | undefined, c: Ctx) {
  const W = Math.max(240, c.opt.width);
  const top = tabLineTop(bars, !prev);
  const H = top + 40 + c.nStr * 13 + 30; // provisional; resized to the real tab bottom below
  const r = new Renderer(div, Renderer.Backends.SVG); r.resize(W, H); const ctx = r.getContext();
  const svg = div.querySelector('svg')!;
  const weight = bars.map(b => 3 + b.events.length);
  const tw = weight.reduce((a, b) => a + b, 0);
  let x = 6; const avail = W - 12; let bottom = 0;
  const lyrics: [number, string][] = [];
  const hits: SVGRectElement[] = [], loopMarks: SVGRectElement[] = [];
  const tabOptions = { num_lines: c.nStr, space_above_staff_ln: 0, fill_style: SHEET_LINE };
  bars.forEach((bar, bi) => {
    const prevBar = bi === 0 ? prev : bars[bi - 1];
    const bw = (avail * weight[bi]) / tw;
    const tab = new TabStave(x, top, bw, tabOptions);
    const tsChange = !prevBar || prevBar.beats !== bar.beats || prevBar.beatValue !== bar.beatValue;
    tab.getModifiers().forEach(m => { if (m instanceof Barline) m.setStyle({ fillStyle: SHEET_MUT }); });
    tab.setContext(ctx);
    const timeSigLeft = tab.getNoteStartX();
    let nsx = timeSigLeft;
    if (tsChange) nsx += timeSignatureWidth(bar, c.nStr) + STRING_SPACE / 2;
    tab.setNoteStartX(nsx);
    tab.draw(); bottom = Math.max(bottom, tab.getYForLine(c.nStr - 1));
    if (tsChange) drawTimeSignature(svg, tab, timeSigLeft, bar, c.nStr);
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
          ? tabNote(sorted.map(n => ({ str: n.string, fret: (pi > 0 || n.tie) ? `(${n.fret})` : String(n.fret) })), val, dots)
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
    const tv = new Voice({ num_beats: bar.beats, beat_value: bar.beatValue }).setMode(Voice.Mode.SOFT).addTickables(tn);
    const beams = beamsFor(tn, trip, bar);
    const tups = trip.map(grp => new Tuplet(grp, { num_notes: 3, notes_occupied: 2, location: Tuplet.LOCATION_BOTTOM, bracketed: grp.some(n => !n.hasBeam()) }));
    tn.forEach(n => { if (n instanceof StaveNote) centreRest(n, c.nStr); });
    new Formatter().joinVoices([tv]).format([tv], bw - (nsx - x) - 12);
    tv.draw(ctx, tab);
    beams.forEach(b => b.setContext(ctx).draw()); tups.forEach(t => t.setContext(ctx).draw());
    bottom = Math.max(bottom, rhythmBottom(tn, tups));
    labels.forEach(([n, ev]) => svgText(svg, 'chord-label', n.getAbsoluteX() - 2, top - ROW.label, [ev.chord, ev.text].filter(Boolean).join('  ')));
    const sectionY = top - ROW.section;
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
}
