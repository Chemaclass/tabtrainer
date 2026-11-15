import type { Song } from '../../core/model';
import { renderSong } from '../../render/tab';
import { pref, setPref } from '../../app/storage';
import { barsPerLine, nextZoom, type ZoomStep } from '../../app/sheetLayout';
import { byId } from '../dom';

const phoneLayout = window.matchMedia('(max-width:599px)');
const TOUCH_SIZE = 44;

interface ScoreActions {
  redraw: () => void;
  onBar: (bar: number) => void;
  onBarNumber: (bar: number) => void;
  onNote: (key: string, bar: number) => void;
  onPlayNote: (key: string, bar: number) => void;
}

interface PassageMarks {
  selectedNote: string | undefined;
  selectedBar: number;
  inPassage: (bar: number) => boolean;
  isLoopEnd: (bar: number) => boolean;
  loopsSelection: boolean;
}

const targetOf = (event: Event, selector: string) => event.target instanceof Element ? event.target.closest<SVGElement>(selector) : null;

function noteAt(event: Event) {
  const target = targetOf(event, '.note-target'), key = target?.dataset.key;
  return target && key !== undefined ? { key, bar: Number(target.dataset.bar) } : null;
}

function barAt(event: Event, selector = '.bar-target') {
  const target = targetOf(event, selector);
  return target ? Number(target.dataset.bar) : null;
}

const barNumberAt = (event: Event) => barAt(event, '.bar-no-target');

export function scoreView({ redraw, onBar, onBarNumber, onNote, onPlayNote }: ScoreActions) {
  const sheet = byId('sheet'), frame = sheet.parentElement;
  if (!frame) throw new Error('#sheet has no parent');
  let zoom = pref('zoom', 1);
  let lit: Element[] = [], litKey: string | null = null;
  let line: Element | null = null, bar: number | null = null;
  let problems = new Set<number>(), edited: number | null = null;

  const notesOf = (key: string | null) => key ? [...sheet.querySelectorAll(`[data-key="${key}"]`)] : [];
  const systems = () => [...sheet.querySelectorAll<HTMLElement>('.system')];
  const lineOf = (at: number | null) => at === null ? null : systems().find(system => at >= Number(system.dataset.first) && at <= Number(system.dataset.last)) ?? null;
  const markPlayed = (current: Element | null) => {
    let played = current !== null;
    systems().forEach(system => { if (system === current) played = false; system.classList.toggle('played', played); });
  };
  const markEdits = () => sheet.querySelectorAll<SVGElement>('.bar-target').forEach(target => {
    const at = Number(target.dataset.bar);
    target.classList.toggle('problem', problems.has(at));
    target.classList.toggle('edited', at === edited);
  });
  const forgetLine = () => { line?.classList.remove('cur'); line = null; markPlayed(null); };

  const zoomBy = (step: ZoomStep) => { zoom = nextZoom(zoom, step); setPref('zoom', zoom); redraw(); };
  byId('zoomIn').onclick = () => zoomBy('in');
  byId('zoomOut').onclick = () => zoomBy('out');

  let resizeTimer = 0, lastWidth = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastWidth) < 60) return; lastWidth = window.innerWidth; clearTimeout(resizeTimer); resizeTimer = window.setTimeout(redraw, 250); });

  sheet.addEventListener('click', e => {
    const note = noteAt(e);
    if (note) { onNote(note.key, note.bar); return; }
    const number = barNumberAt(e);
    if (number !== null) { onBarNumber(number); return; }
    const chosen = barAt(e);
    if (chosen !== null) onBar(chosen);
  });
  sheet.addEventListener('dblclick', e => {
    const note = noteAt(e);
    if (note) onPlayNote(note.key, note.bar);
  });
  sheet.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const note = noteAt(e), number = barNumberAt(e), chosen = barAt(e);
    if (note || number !== null || chosen !== null) {
      e.preventDefault(); e.stopPropagation();
      if (note) onNote(note.key, note.bar);
      else if (number !== null) onBarNumber(number);
      else if (chosen !== null) onBar(chosen);
    }
  });

  return {
    draw(song: Song) {
      // measure the unzoomed parent: browsers disagree on whether a zoomed element reports its own width zoomed
      const box = getComputedStyle(frame);
      const width = frame.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight) - 12;
      sheet.style.setProperty('zoom', String(zoom));
      renderSong(sheet, song, { barsPerLine: barsPerLine(width, zoom, phoneLayout.matches), width: width / zoom, touchSize: TOUCH_SIZE / zoom });
      lit = notesOf(litKey); lit.forEach(element => element.classList.add('on'));
      line = lineOf(bar); line?.classList.add('cur'); markPlayed(line);
      markEdits();
    },
    /** Marks the bars that hold a problem in the song text. */
    showProblems(bars: Iterable<number>) { problems = new Set(bars); markEdits(); },
    /** Marks the bar the caret is on in the song text. */
    showEditedBar(at: number | null) { if (at === edited) return; edited = at; markEdits(); },
    highlight(key: string | null) {
      if (key === litKey) return;
      lit.forEach(e => e.classList.remove('on'));
      lit = notesOf(key); lit.forEach(e => e.classList.add('on')); litKey = key;
    },
    showBar(at: number | null) {
      bar = at;
      const found = lineOf(at);
      if (!found || found === line) return false;
      line?.classList.remove('cur'); found.classList.add('cur'); line = found; markPlayed(found);
      return true;
    },
    followLine(behavior: ScrollBehavior) {
      const found = lineOf(bar);
      if (found) { const r = found.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior }); }
    },
    forgetLine,
    clear() { lit.forEach(e => e.classList.remove('on')); lit = []; litKey = null; forgetLine(); bar = null; },
    markPassage({ selectedNote, selectedBar, inPassage, isLoopEnd, loopsSelection }: PassageMarks) {
      sheet.querySelectorAll<SVGElement>('.note-target').forEach(el => {
        const selected = el.dataset.key === selectedNote;
        el.classList.toggle('selected', selected);
        el.setAttribute('aria-pressed', String(selected));
      });
      sheet.querySelectorAll<SVGElement>('.bar-target').forEach(el => {
        const at = Number(el.dataset.bar);
        el.classList.toggle('in-range', inPassage(at));
        el.classList.toggle('selected', at === selectedBar);
        el.classList.toggle('loops-selection', loopsSelection && at === selectedBar);
        el.setAttribute('aria-pressed', String(at === selectedBar));
      });
      sheet.querySelectorAll<SVGElement>('.loop-mark, .bar-no').forEach(el => el.classList.toggle('in-loop', inPassage(Number(el.dataset.bar))));
      sheet.querySelectorAll<SVGElement>('.bar-no-target').forEach(el => {
        const at = Number(el.dataset.bar);
        el.setAttribute('aria-label', `Bar ${at}, ${isLoopEnd(at) ? 'clear' : 'set'} loop`);
      });
    },
    focusFirstBar() {
      const first = sheet.querySelector<SVGElement>('.bar-target');
      first?.focus();
      return first !== null;
    },
  };
}
