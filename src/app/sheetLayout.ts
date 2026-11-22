export type ZoomStep = 'in' | 'out';

const barWidth = 240, phoneBarWidth = 179, phoneBars = 2;

export function barsPerLine(width: number, zoom: number, phone = false) {
  const fitted = Math.round((width / zoom) / (phone ? phoneBarWidth : barWidth));
  const bars = phone ? Math.min(fitted, Math.round(phoneBars / zoom)) : fitted;
  return Math.max(1, Math.min(8, bars));
}

export function nextZoom(zoom: number, step: ZoomStep) {
  return step === 'in' ? Math.min(1.8, +(zoom + 0.1).toFixed(2)) : Math.max(0.6, +(zoom - 0.1).toFixed(2));
}

export function timeSignatureDigitHeight(strings: number, stringSpace: number) {
  return Math.min(((strings - 1) * stringSpace) / 2, 2.2 * stringSpace);
}

/** Height of the band above the tab lines that holds technique marks such as "P.M.". */
export const markRoom = (marks: { letters: boolean }, stringSpace: number) => marks.letters ? Math.round(1.5 * stringSpace) : 0;

export function barWidths(avail: number, weights: number[], mins: number[]): number[] {
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum >= avail) return mins.map(m => (avail * m) / minSum);
  const fixed = new Set<number>();
  for (;;) {
    const free = avail - [...fixed].reduce((a, i) => a + mins[i], 0);
    const weight = weights.reduce((a, w, i) => fixed.has(i) ? a : a + w, 0);
    const squeezed = weights.findIndex((w, i) => !fixed.has(i) && (free * w) / weight < mins[i]);
    if (squeezed < 0) return weights.map((w, i) => fixed.has(i) ? mins[i] : (free * w) / weight);
    fixed.add(squeezed);
  }
}

export function labelRows(spans: { left: number; width: number }[], gap: number): number[] {
  const ends: number[] = [];
  return spans.map(({ left, width }) => {
    let row = ends.findIndex(end => end + gap <= left);
    if (row < 0) row = ends.length;
    ends[row] = left + width;
    return row;
  });
}

export function lineBreaks(mins: number[], avail: number, most: number): number[] {
  const lines: number[] = [];
  let count = 0, used = 0;
  mins.forEach(min => {
    if (count && (count === most || used + min > avail)) { lines.push(count); count = 0; used = 0; }
    count++; used += min;
  });
  if (count) lines.push(count);
  return lines;
}
