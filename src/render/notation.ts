import { Accidental, Beam, Dot, Formatter, GhostNote, Renderer, Stave, StaveConnector, StaveNote, StaveTie, TabNote, TabStave, Tuplet, Voice } from 'vexflow';
import { PPQ, type Bar, type NoteEvent, type Song } from '../core/model';
import { onsetKey } from '../core/timeline';
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
    try { drawSystem(sys, group, song.bars[i - 1], { key, clef: inst.clef, tuning: inst.tuning, nStr, opt, barStart }); }
    catch (e) { sys.textContent = `Bars ${group[0].index} to ${group[group.length - 1].index} could not be drawn: ${(e as Error).message}`; sys.classList.add('error'); }
  }
}

interface Ctx { key: string; clef: 'bass' | 'treble'; tuning: number[]; nStr: number; opt: RenderOptions; barStart: Record<number, number> }

function drawSystem(div: HTMLDivElement, bars: Bar[], prev: Bar | undefined, c: Ctx) {
  const W = Math.max(240, c.opt.width);
  const top = c.opt.showNotation ? 66 : 46;
  const staffH = c.opt.showNotation ? 92 : 0;
  const H = top + staffH + 40 + c.nStr * 13 + 30; // provisional; resized to the real tab bottom below
  const r = new Renderer(div, Renderer.Backends.SVG); r.resize(W, H); const ctx = r.getContext();
  const lead = c.opt.showNotation ? 80 : 0;
  const weight = bars.map(b => 3 + b.events.length);
  const tw = weight.reduce((a, b) => a + b, 0);
  let x = 6; const avail = W - 12 - lead; let bottom = 0;
  const lyrics: [number, string][] = [];
  bars.forEach((bar, bi) => {
    const prevBar = bi === 0 ? prev : bars[bi - 1];
    const bw = (bi === 0 ? lead : 0) + (avail * weight[bi]) / tw;
    const st = c.opt.showNotation ? new Stave(x, top, bw) : null;
    const tab = new TabStave(x, top + staffH, bw, { num_lines: c.nStr });
    const tsChange = !prevBar || prevBar.beats !== bar.beats || prevBar.beatValue !== bar.beatValue;
    if (bi === 0) st?.addClef(c.clef).addKeySignature(c.key);
    if (tsChange || bi === 0) st?.addTimeSignature(`${bar.beats}/${bar.beatValue}`);
    st?.setMeasure(bar.index); if (!st) tab.setMeasure(bar.index);
    st?.setContext(ctx); tab.setContext(ctx);
    const nsx = Math.max(st ? st.getNoteStartX() : 0, tab.getNoteStartX());
    st?.setNoteStartX(nsx); tab.setNoteStartX(nsx);
    st?.draw(); tab.draw(); bottom = Math.max(bottom, tab.getYForLine(c.nStr - 1));
    if (st) {
      if (bi === 0) new StaveConnector(st, tab).setType('singleLeft').setContext(ctx).draw();
      new StaveConnector(st, tab).setType('singleRight').setContext(ctx).draw();
    }
    const sn: StaveNote[] = [], tn: (TabNote | GhostNote)[] = [], tags: [StaveNote | null, TabNote, string][] = [];
    const ties: [StaveNote, StaveNote][] = []; const trip: StaveNote[][] = [], ttrip: (TabNote | GhostNote)[][] = [];
    let g: StaveNote[] = [], tg: (TabNote | GhostNote)[] = [];
    const labels: [StaveNote | TabNote | GhostNote, NoteEvent][] = [];
    const lyricAt: [TabNote | GhostNote, string][] = [];
    for (const ev of bar.events) {
      const ps = pieces(ev); let prevS: StaveNote | null = null;
      ps.forEach(([val, dots, isT], pi) => {
        let s: StaveNote; let t: TabNote | GhostNote;
        const sorted = [...ev.notes].sort((a, b) => (c.tuning[a.string - 1] + a.fret) - (c.tuning[b.string - 1] + b.fret));
        if (!sorted.length) {
          s = new StaveNote({ clef: c.clef, keys: [c.clef === 'bass' ? 'd/3' : 'b/4'], duration: val + 'r' });
          t = new GhostNote({ duration: val });
        } else {
          s = new StaveNote({ clef: c.clef, keys: sorted.map(n => vexKey(c.tuning[n.string - 1] + n.fret, c.key)), duration: val, auto_stem: true });
          t = new TabNote({ positions: sorted.map(n => ({ str: n.string, fret: (pi > 0 || n.tie) ? `(${n.fret})` : String(n.fret) })), duration: val });
          if (pi === 0) tags.push([st ? s : null, t as TabNote, onsetKey(c.barStart[bar.index] + ev.start / PPQ)]);
          if (prevS) ties.push([prevS, s]);
        }
        if (dots) Dot.buildAndAttach([s], { all: true });
        if (isT) { g.push(s); tg.push(t); if (g.length === 3) { trip.push(g); ttrip.push(tg); g = []; tg = []; } }
        else if (g.length) { trip.push(g); ttrip.push(tg); g = []; tg = []; }
        if (pi === 0 && (ev.chord || ev.text)) labels.push([st ? s : t, ev]);
        if (pi === 0 && ev.lyric) lyricAt.push([t, ev.lyric]);
        sn.push(s); tn.push(t); prevS = sorted.length ? s : null;
      });
    }
    if (g.length) { trip.push(g); ttrip.push(tg); }
    const ticks = bar.beats; const bv = bar.beatValue;
    const tv = new Voice({ num_beats: ticks, beat_value: bv }).setMode(Voice.Mode.SOFT).addTickables(tn);
    ttrip.forEach(grp => new Tuplet(grp as never, { num_notes: 3, notes_occupied: 2 }));
    let sv: Voice | null = null; let beams: Beam[] = []; let tups: Tuplet[] = [];
    if (st) {
      sv = new Voice({ num_beats: ticks, beat_value: bv }).setMode(Voice.Mode.SOFT).addTickables(sn);
      Accidental.applyAccidentals([sv], c.key);
      const inTrip = new Set(trip.flat());
      beams = Beam.generateBeams(sn.filter(n => !n.isRest() && !inTrip.has(n)));
      trip.forEach(grp => { const beamable = grp.filter(n => !n.isRest() && ['8', '16', '32'].includes(n.getDuration())); if (beamable.length >= 2) beams.push(new Beam(beamable)); });
      tups = trip.map(grp => new Tuplet(grp, { num_notes: 3, notes_occupied: 2, bracketed: true }));
    }
    const fmt = new Formatter();
    if (sv) fmt.joinVoices([sv]);
    fmt.joinVoices([tv]).format(sv ? [sv, tv] : [tv], bw - (nsx - x) - 12);
    if (sv && st) sv.draw(ctx, st);
    tv.draw(ctx, tab);
    beams.forEach(b => b.setContext(ctx).draw()); tups.forEach(t => t.setContext(ctx).draw());
    if (st) ties.forEach(([a, b]) => { try { new StaveTie({ first_note: a, last_note: b, first_indices: a.getKeys().map((_, i) => i), last_indices: b.getKeys().map((_, i) => i) }).setContext(ctx).draw(); } catch { /* skip */ } });
    // labels
    ctx.save(); ctx.setFont('Inter, Arial, sans-serif', 12, 'bold');
    labels.forEach(([n, ev]) => { const px = n.getAbsoluteX(); ctx.fillText([ev.chord, ev.text].filter(Boolean).join('  '), px - 2, top - 6); });
    if (bar.section) { ctx.setFont('Inter, Arial, sans-serif', 11, 'bold'); ctx.fillText(bar.section.toUpperCase(), x + 4, top - 28); }
    ctx.restore();
    lyricAt.forEach(([n, words]) => lyrics.push([n.getAbsoluteX() - 2, words]));
    // tag elements for highlight + click
    tags.forEach(([s, t, k]) => {
      for (const o of [s, t]) {
        if (!o) continue;
        const id = o.getAttribute('id'); const el = div.querySelector<SVGElement>('#vf-' + CSS.escape(String(id)));
        if (el) { el.classList.add('note'); el.dataset.key = k; }
      }
    });
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    target.setAttribute('x', String(x)); target.setAttribute('y', String(top - 18));
    target.setAttribute('width', String(bw)); target.setAttribute('height', String(bottom - top + 42));
    target.setAttribute('tabindex', '0'); target.setAttribute('role', 'button');
    target.setAttribute('aria-label', `Select bar ${bar.index}`);
    target.classList.add('bar-target'); target.dataset.bar = String(bar.index);
    div.querySelector('svg')!.append(target);
    x += bw;
  });
  if (lyrics.length) {
    ctx.save(); ctx.setFont('Inter, Arial, sans-serif', 13, 'italic'); ctx.setFillStyle('#6b6b6b');
    lyrics.forEach(([px, words]) => ctx.fillText(words, px, bottom + 30));
    ctx.restore();
  }
  r.resize(W, Math.ceil(bottom + (lyrics.length ? 44 : 34)));
}
