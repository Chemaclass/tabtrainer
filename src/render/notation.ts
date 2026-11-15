import { Accidental, Barline, Beam, Dot, Formatter, GhostNote, Renderer, Stave, StaveConnector, StaveNote, StaveTie, Stem, TabNote, TabStave, Tuplet, Voice, type StemmableNote, type TabNotePosition } from 'vexflow';
import { PPQ, type Bar, type NoteEvent, type Song } from '../core/model';
import { onsetKey } from '../core/timeline';
import { timeSignatureDigitHeight } from '../app/sheetLayout';
import { safeKey, vexKey } from '../core/theory';

export interface RenderOptions { barsPerLine: number; showNotation: boolean; width: number }

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

type TabTickable = TabNote | StaveNote | GhostNote;
const STRING_SPACE = 13, RHYTHM_GLYPH_SCALE = 26;

function tabNote(positions: TabNotePosition[], duration: string, dots: number, rhythm: boolean): TabNote {
  if (!rhythm) return new TabNote({ positions, duration });
  const note = new TabNote({ positions, duration, dots }, true);
  note.render_options.glyph_font_scale = RHYTHM_GLYPH_SCALE;
  if (duration !== 'w') note.setStemLength(duration === 'h' ? STRING_SPACE : 2 * STRING_SPACE);
  note.setStemDirection(Stem.DOWN);
  return note;
}

const centreRest = (rest: StaveNote, nStr: number) => rest.setKeyLine(0, 5 - (nStr - 1) / 2);

function tabRest(duration: string, dots: number, rhythm: boolean, nStr: number): StaveNote | GhostNote {
  if (!rhythm) return new GhostNote({ duration });
  return centreRest(new StaveNote({ keys: ['b/4'], duration: duration + 'r', dots }), nStr);
}

function beamsFor(notes: StemmableNote[], triplets: StemmableNote[][], stem_direction?: number): Beam[] {
  const inTrip = new Set(triplets.flat());
  const beams = Beam.generateBeams(notes.filter(n => !inTrip.has(n)), { stem_direction });
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
  const inst = song.meta.instrument; const key = safeKey(song.meta.key.trim());
  const nStr = inst.tuning.length;
  let beat = 0; const barStart: Record<number, number> = {};
  for (const b of song.bars) { barStart[b.index] = beat; beat += (b.beats * 4) / b.beatValue; }
  for (let i = 0; i < song.bars.length; i += opt.barsPerLine) {
    const group = song.bars.slice(i, i + opt.barsPerLine);
    const sys = document.createElement('div');
    sys.className = 'system'; sys.dataset.first = String(group[0].index); sys.dataset.last = String(group[group.length - 1].index);
    host.appendChild(sys);
    try { drawSystem(sys, group, song.bars[i - 1], { key, clef: inst.clef, tuning: inst.tuning, nStr, tempo: song.meta.tempo, opt, barStart }); }
    catch (e) { sys.textContent = `Bars ${group[0].index} to ${group[group.length - 1].index} could not be drawn: ${(e as Error).message}`; sys.classList.add('error'); }
  }
}

interface Ctx { key: string; clef: 'bass' | 'treble'; tuning: number[]; nStr: number; tempo: number; opt: RenderOptions; barStart: Record<number, number> }

const SHEET_MUT = '#5c5c5c', SHEET_LINE = '#c4c4c4';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DIGIT_CAP_HEIGHT = 0.73, DIGIT_WIDTH = 0.62;
const ROW = { barNo: 0.4 * STRING_SPACE, label: 1.4 * STRING_SPACE, section: 2.8 * STRING_SPACE };

function svgText(svg: SVGSVGElement, className: string, x: number, y: number, text: string): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('class', className); el.setAttribute('x', String(x)); el.setAttribute('y', String(y));
  el.textContent = text; svg.append(el);
  return el;
}

function tabLineTop(bars: Bar[], firstSystem: boolean): number {
  const [row, size] = firstSystem || bars.some(b => b.section) ? [ROW.section, 11]
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
  const tabOnly = !c.opt.showNotation;
  const top = tabOnly ? tabLineTop(bars, !prev) : 66;
  const staffH = tabOnly ? 0 : 92;
  const H = top + staffH + 40 + c.nStr * 13 + 30; // provisional; resized to the real tab bottom below
  const r = new Renderer(div, Renderer.Backends.SVG); r.resize(W, H); const ctx = r.getContext();
  const svg = div.querySelector('svg')!;
  const lead = tabOnly ? 0 : 80;
  const weight = bars.map(b => 3 + b.events.length);
  const tw = weight.reduce((a, b) => a + b, 0);
  let x = 6; const avail = W - 12 - lead; let bottom = 0;
  const lyrics: [number, string][] = [];
  const hits: SVGRectElement[] = [];
  const targetTop = tabOnly ? 0 : top - 18;
  const tabOptions = tabOnly ? { num_lines: c.nStr, space_above_staff_ln: 0, fill_style: SHEET_LINE } : { num_lines: c.nStr };
  bars.forEach((bar, bi) => {
    const prevBar = bi === 0 ? prev : bars[bi - 1];
    const bw = (bi === 0 ? lead : 0) + (avail * weight[bi]) / tw;
    const st = tabOnly ? null : new Stave(x, top, bw);
    const tab = new TabStave(x, top + staffH, bw, tabOptions);
    const tsChange = !prevBar || prevBar.beats !== bar.beats || prevBar.beatValue !== bar.beatValue;
    if (bi === 0) st?.addClef(c.clef).addKeySignature(c.key);
    if (tsChange || bi === 0) st?.addTimeSignature(`${bar.beats}/${bar.beatValue}`);
    st?.setMeasure(bar.index);
    if (tabOnly) tab.getModifiers().forEach(m => { if (m instanceof Barline) m.setStyle({ fillStyle: SHEET_MUT }); });
    st?.setContext(ctx); tab.setContext(ctx);
    const timeSigLeft = tab.getNoteStartX(); const showTimeSig = tabOnly && tsChange;
    let nsx = Math.max(st ? st.getNoteStartX() : 0, timeSigLeft);
    if (showTimeSig) nsx += timeSignatureWidth(bar, c.nStr) + STRING_SPACE / 2;
    st?.setNoteStartX(nsx); tab.setNoteStartX(nsx);
    st?.draw(); tab.draw(); bottom = Math.max(bottom, tab.getYForLine(c.nStr - 1));
    if (showTimeSig) drawTimeSignature(svg, tab, timeSigLeft, bar, c.nStr);
    if (st) {
      if (bi === 0) new StaveConnector(st, tab).setType('singleLeft').setContext(ctx).draw();
      new StaveConnector(st, tab).setType('singleRight').setContext(ctx).draw();
    }
    const sn: StaveNote[] = [], tn: TabTickable[] = [];
    const targets: { notation: StaveNote | null; tab: TabTickable; event: NoteEvent }[] = [];
    const ties: [StaveNote, StaveNote][] = []; const trip: StaveNote[][] = [], ttrip: TabTickable[][] = [];
    let g: StaveNote[] = [], tg: TabTickable[] = [];
    const labels: [TabTickable, NoteEvent][] = [];
    const lyricAt: [TabTickable, string][] = [];
    for (const ev of bar.events) {
      const ps = pieces(ev); let prevS: StaveNote | null = null;
      ps.forEach(([val, dots, isT], pi) => {
        let s: StaveNote; let t: TabTickable;
        const sorted = [...ev.notes].sort((a, b) => (c.tuning[a.string - 1] + a.fret) - (c.tuning[b.string - 1] + b.fret));
        if (!sorted.length) {
          s = new StaveNote({ clef: c.clef, keys: [c.clef === 'bass' ? 'd/3' : 'b/4'], duration: val + 'r' });
          t = tabRest(val, dots, tabOnly, c.nStr);
        } else {
          s = new StaveNote({ clef: c.clef, keys: sorted.map(n => vexKey(c.tuning[n.string - 1] + n.fret, c.key)), duration: val, auto_stem: true });
          t = tabNote(sorted.map(n => ({ str: n.string, fret: (pi > 0 || n.tie) ? `(${n.fret})` : String(n.fret) })), val, dots, tabOnly);
          if (prevS) ties.push([prevS, s]);
        }
        if (dots) Dot.buildAndAttach([s], { all: true });
        if (dots && tabOnly) Dot.buildAndAttach([t]);
        if (isT) { g.push(s); tg.push(t); if (g.length === 3) { trip.push(g); ttrip.push(tg); g = []; tg = []; } }
        else if (g.length) { trip.push(g); ttrip.push(tg); g = []; tg = []; }
        if (pi === 0 && (ev.chord || ev.text)) labels.push([st ? s : t, ev]);
        if (pi === 0 && ev.lyric) lyricAt.push([t, ev.lyric]);
        sn.push(s); tn.push(t); targets.push({ notation: st ? s : null, tab: t, event: ev }); prevS = sorted.length ? s : null;
      });
    }
    if (g.length) { trip.push(g); ttrip.push(tg); }
    const ticks = bar.beats; const bv = bar.beatValue;
    const tv = new Voice({ num_beats: ticks, beat_value: bv }).setMode(Voice.Mode.SOFT).addTickables(tn);
    let beams = tabOnly ? beamsFor(tn, ttrip, Stem.DOWN) : [];
    const below = (grp: TabTickable[]) => tabOnly ? { location: Tuplet.LOCATION_BOTTOM, bracketed: grp.some(n => !n.hasBeam()) } : {};
    const ttups = ttrip.map(grp => new Tuplet(grp as never, { num_notes: 3, notes_occupied: 2, ...below(grp) }));
    let sv: Voice | null = null; let tups = tabOnly ? ttups : [];
    if (tabOnly) tn.forEach(n => { if (n instanceof StaveNote) centreRest(n, c.nStr); });
    if (st) {
      sv = new Voice({ num_beats: ticks, beat_value: bv }).setMode(Voice.Mode.SOFT).addTickables(sn);
      Accidental.applyAccidentals([sv], c.key);
      beams = beamsFor(sn, trip);
      tups = trip.map(grp => new Tuplet(grp, { num_notes: 3, notes_occupied: 2, bracketed: true }));
    }
    const fmt = new Formatter();
    if (sv) fmt.joinVoices([sv]);
    fmt.joinVoices([tv]).format(sv ? [sv, tv] : [tv], bw - (nsx - x) - 12);
    if (sv && st) sv.draw(ctx, st);
    tv.draw(ctx, tab);
    beams.forEach(b => b.setContext(ctx).draw()); tups.forEach(t => t.setContext(ctx).draw());
    if (tabOnly) bottom = Math.max(bottom, rhythmBottom(tn, tups));
    if (st) ties.forEach(([a, b]) => { try { new StaveTie({ first_note: a, last_note: b, first_indices: a.getKeys().map((_, i) => i), last_indices: b.getKeys().map((_, i) => i) }).setContext(ctx).draw(); } catch { /* skip */ } });
    labels.forEach(([n, ev]) => svgText(svg, 'chord-label', n.getAbsoluteX() - 2, top - (tabOnly ? ROW.label : 6), [ev.chord, ev.text].filter(Boolean).join('  ')));
    const sectionY = top - (tabOnly ? ROW.section : 28);
    const section = bar.section ? svgText(svg, 'section-label', x + 4, sectionY, bar.section.toUpperCase()) : null;
    if (tabOnly) {
      svgText(svg, 'bar-no', x + 2, top - ROW.barNo, String(bar.index));
      if (!prev && bi === 0) drawTempo(svg, section, x + 4, sectionY, c.tempo);
    }
    lyricAt.forEach(([n, words]) => lyrics.push([n.getAbsoluteX() - 2, words]));
    const target = document.createElementNS(SVG_NS, 'rect');
    target.setAttribute('x', String(x)); target.setAttribute('y', String(targetTop));
    target.setAttribute('width', String(bw));
    target.setAttribute('tabindex', '0'); target.setAttribute('role', 'button');
    target.setAttribute('aria-label', `Select bar ${bar.index}`);
    target.classList.add('bar-target'); target.dataset.bar = String(bar.index);
    hits.push(target);
    targets.forEach(({ notation, tab: note, event }, index) => {
      if (!event.notes.length) return;
      const key = onsetKey(c.barStart[bar.index] + event.start / PPQ);
      const center = note.getAbsoluteX() + 5;
      const left = index ? (targets[index - 1].tab.getAbsoluteX() + 5 + center) / 2 : x;
      const right = index + 1 < targets.length ? (center + targets[index + 1].tab.getAbsoluteX() + 5) / 2 : x + bw;
      for (const item of [notation, note]) {
        if (!item) continue;
        const id = item.getAttribute('id'); const el = div.querySelector<SVGElement>('#vf-' + CSS.escape(String(id)));
        if (el) { el.classList.add('note'); el.dataset.key = key; }
        const ys = item.getYs();
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
      }
    });
    x += bw;
  });
  const pad = tabOnly ? { lyric: STRING_SPACE + 11, lyricEnd: STRING_SPACE + 18, end: 14 } : { lyric: 30, lyricEnd: 44, end: 34 };
  lyrics.forEach(([px, words]) => svgText(svg, 'lyric', px, bottom + pad.lyric, words));
  const end = Math.ceil(bottom + (lyrics.length ? pad.lyricEnd : pad.end));
  hits.forEach(hit => { if (hit.classList.contains('bar-target')) hit.setAttribute('height', String(Math.min(bottom + 24, end) - targetTop)); });
  svg.append(...hits);
  r.resize(W, end);
}
