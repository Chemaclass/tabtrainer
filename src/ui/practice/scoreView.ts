import type { Song } from '../../core/model';
import { renderSong } from '../../render/notation';
import { pref, setPref } from '../../app/storage';
import { barsPerLine, nextZoom, type ZoomStep } from '../../app/sheetLayout';
import { byId } from '../dom';

interface ScoreActions {
  redraw: () => void;
  onBar: (bar: number) => void;
  onNote: (key: string, bar: number) => void;
  onPlayNote: (key: string, bar: number) => void;
}

interface PassageMarks {
  selectedNote: string | undefined;
  selectedBar: number;
  inPassage: (bar: number) => boolean;
}

const targetOf = (event: Event, selector: string) => event.target instanceof Element ? event.target.closest<SVGElement>(selector) : null;

function noteAt(event: Event) {
  const target = targetOf(event, '.note-target'), key = target?.dataset.key;
  return target && key !== undefined ? { key, bar: Number(target.dataset.bar) } : null;
}

function barAt(event: Event) {
  const target = targetOf(event, '.bar-target');
  return target ? Number(target.dataset.bar) : null;
}

export function scoreView({ redraw, onBar, onNote, onPlayNote }: ScoreActions) {
  const sheet = byId('sheet'), frame = sheet.parentElement;
  if (!frame) throw new Error('#sheet has no parent');
  let zoom = pref('zoom', 1), notation = pref('notation', matchMedia('(min-width:600px)').matches);
  let lit: Element[] = [], litKey: string | null = null;
  let line: Element | null = null, bar: number | null = null;

  const notesOf = (key: string | null) => key ? [...sheet.querySelectorAll(`[data-key="${key}"]`)] : [];
  const lineOf = (at: number | null) => at === null ? null : [...sheet.querySelectorAll<HTMLElement>('.system')].find(system => at >= Number(system.dataset.first) && at <= Number(system.dataset.last)) ?? null;
  const forgetLine = () => { line?.classList.remove('cur'); line = null; };

  const showNotation = () => {
    byId('notaBtn').classList.toggle('on', notation); byId('tabBtn').classList.toggle('on', !notation);
    byId('notaBtn').setAttribute('aria-pressed', String(notation)); byId('tabBtn').setAttribute('aria-pressed', String(!notation));
  };
  const setNotation = (on: boolean) => { notation = on; setPref('notation', on); showNotation(); redraw(); };
  const zoomBy = (step: ZoomStep) => { zoom = nextZoom(zoom, step); setPref('zoom', zoom); redraw(); };
  byId('notaBtn').onclick = () => setNotation(true);
  byId('tabBtn').onclick = () => setNotation(false);
  byId('zoomIn').onclick = () => zoomBy('in');
  byId('zoomOut').onclick = () => zoomBy('out');
  showNotation();

  let resizeTimer = 0, lastWidth = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastWidth) < 60) return; lastWidth = window.innerWidth; clearTimeout(resizeTimer); resizeTimer = window.setTimeout(redraw, 250); });

  sheet.addEventListener('click', e => {
    const note = noteAt(e);
    if (note) { onNote(note.key, note.bar); return; }
    const chosen = barAt(e);
    if (chosen !== null) onBar(chosen);
  });
  sheet.addEventListener('dblclick', e => {
    const note = noteAt(e);
    if (note) onPlayNote(note.key, note.bar);
  });
  sheet.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const note = noteAt(e), chosen = barAt(e);
    if (note || chosen !== null) {
      e.preventDefault(); e.stopPropagation();
      if (note) onNote(note.key, note.bar);
      else if (chosen !== null) onBar(chosen);
    }
  });

  return {
    draw(song: Song) {
      // measure the unzoomed parent: browsers disagree on whether a zoomed element reports its own width zoomed
      const box = getComputedStyle(frame);
      const width = frame.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight) - 12;
      sheet.style.setProperty('zoom', String(zoom));
      renderSong(sheet, song, { barsPerLine: barsPerLine(width, zoom, notation), showNotation: notation, width: width / zoom });
      lit = notesOf(litKey); lit.forEach(element => element.classList.add('on'));
      line = lineOf(bar); line?.classList.add('cur');
    },
    highlight(key: string | null) {
      if (key === litKey) return;
      lit.forEach(e => e.classList.remove('on'));
      lit = notesOf(key); lit.forEach(e => e.classList.add('on')); litKey = key;
    },
    showBar(at: number | null) {
      bar = at;
      const found = lineOf(at);
      if (!found || found === line) return false;
      line?.classList.remove('cur'); found.classList.add('cur'); line = found;
      return true;
    },
    followLine() {
      const found = lineOf(bar);
      if (found) { const r = found.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior: 'smooth' }); }
    },
    forgetLine,
    clear() { lit.forEach(e => e.classList.remove('on')); lit = []; litKey = null; forgetLine(); bar = null; },
    markPassage({ selectedNote, selectedBar, inPassage }: PassageMarks) {
      sheet.querySelectorAll<SVGElement>('.note-target').forEach(el => {
        const selected = el.dataset.key === selectedNote;
        el.classList.toggle('selected', selected);
        el.setAttribute('aria-pressed', String(selected));
      });
      sheet.querySelectorAll<SVGElement>('.bar-target').forEach(el => {
        const at = Number(el.dataset.bar);
        el.classList.toggle('in-range', inPassage(at));
        el.classList.toggle('selected', at === selectedBar);
        el.setAttribute('aria-pressed', String(at === selectedBar));
      });
    },
    focusFirstBar() {
      const first = sheet.querySelector<SVGElement>('.bar-target');
      first?.focus();
      return first !== null;
    },
  };
}
