import type { FretMark } from '../../core/fretboard';

export interface FretboardDrawing {
  openNames: readonly string[];
  firstFret: number;
  lastFret: number;
  marks: readonly FretMark[];
  label: string;
}

const SVG = 'http://www.w3.org/2000/svg';
const NAME_WIDTH = 22, OPEN_WIDTH = 36, FRET_WIDTH = 54, STRING_GAP = 36, TOP = 20, NUMBERS = 30, MARK = 13;
const SINGLE_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21]), DOUBLE_DOTS = new Set([12, 24]);

function el<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draws strings like tab: string 1 on top, the lowest string at the bottom, open notes left of the nut. */
export function fretboardSvg({ openNames, firstFret, lastFret, marks, label }: FretboardDrawing): SVGSVGElement {
  const strings = openNames.length, withOpen = firstFret === 0, start = Math.max(1, firstFret);
  const left = NAME_WIDTH + (withOpen ? OPEN_WIDTH : 0), frets = lastFret - start + 1;
  const right = left + frets * FRET_WIDTH, bottom = TOP + (strings - 1) * STRING_GAP;
  const width = right + 8, height = bottom + NUMBERS;
  const y = (stringIndex: number) => TOP + stringIndex * STRING_GAP;
  const x = (fret: number) => (fret === 0 ? NAME_WIDTH + OPEN_WIDTH / 2 : left + (fret - start + 0.5) * FRET_WIDTH);
  const dotRow = (index: number) => TOP + (index + 0.5) * STRING_GAP;

  const svg = el('svg', { class: 'fretboard-svg', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': label });
  const board = el('g', { 'aria-hidden': 'true' });
  for (let fret = start; fret <= lastFret; fret++) {
    const cx = x(fret);
    if (SINGLE_DOTS.has(fret)) board.append(el('circle', { class: 'fb-inlay', cx, cy: dotRow(Math.max(0, Math.ceil(strings / 2) - 1)), r: 5 }));
    if (DOUBLE_DOTS.has(fret)) board.append(el('circle', { class: 'fb-inlay', cx, cy: dotRow(0), r: 5 }), el('circle', { class: 'fb-inlay', cx, cy: dotRow(Math.max(0, strings - 2)), r: 5 }));
    board.append(el('line', { class: 'fb-fret', x1: left + (fret - start + 1) * FRET_WIDTH, x2: left + (fret - start + 1) * FRET_WIDTH, y1: TOP, y2: bottom }));
    board.append(el('text', { class: 'fb-fret-number', x: cx, y: bottom + 24 }, String(fret)));
  }
  board.append(el('line', { class: withOpen ? 'fb-nut' : 'fb-fret', x1: left, x2: left, y1: TOP - 1, y2: bottom + 1 }));
  openNames.forEach((name, stringIndex) => {
    board.append(el('line', { class: 'fb-string', x1: withOpen ? NAME_WIDTH + 6 : left, x2: right, y1: y(stringIndex), y2: y(stringIndex), 'stroke-width': 1 + (strings > 1 ? stringIndex / (strings - 1) : 0) * 1.5 }));
    board.append(el('text', { class: 'fb-string-name', x: NAME_WIDTH / 2 - 2, y: y(stringIndex) + 4 }, name));
  });
  for (const mark of marks) {
    if (mark.fret < firstFret || mark.fret > lastFret || mark.stringIndex >= strings) continue;
    const cx = x(mark.fret), cy = y(mark.stringIndex);
    const group = el('g', { class: 'fb-mark', 'data-role': mark.role });
    group.append(mark.role === 'root'
      ? el('rect', { x: cx - MARK, y: cy - MARK, width: MARK * 2, height: MARK * 2, rx: 3 })
      : el('circle', { cx, cy, r: MARK }));
    group.append(el('text', { x: cx, y: cy + 4 }, mark.label));
    board.append(group);
  }
  svg.append(board);
  return svg;
}
