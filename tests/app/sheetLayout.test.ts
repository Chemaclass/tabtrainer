import { describe, expect, it } from 'vitest';
import { barWidths, barsPerLine, labelRows, lineBreaks, markRoom, nextZoom, timeSignatureDigitHeight } from '../../src/app/sheetLayout';

describe('bars per line', () => {
  it('fits a bar for every 240 pixels', () => {
    expect(barsPerLine(1200, 1)).toBe(5);
    expect(barsPerLine(1000, 1)).toBe(4);
  });
  it('fits fewer bars as the score zooms in', () => {
    expect(barsPerLine(1200, 2)).toBe(3);
    expect(barsPerLine(1200, 0.6)).toBe(8);
  });
  it('fits two bars on a phone sheet', () => {
    expect(barsPerLine(358, 1, true)).toBe(2);
    expect(barsPerLine(346, 1, true)).toBe(2);
    expect(barsPerLine(300, 1, true)).toBe(2);
  });
  it('keeps two bars on the widest phone sheets', () => {
    expect(barsPerLine(448, 1, true)).toBe(2);
    expect(barsPerLine(479, 1, true)).toBe(2);
    expect(barsPerLine(555, 1, true)).toBe(2);
  });
  it('never fits fewer bars on a wider phone sheet', () => {
    for (const zoom of [0.6, 1, 1.4]) {
      const counts = Array.from({ length: 300 }, (_, i) => barsPerLine(260 + i, zoom, true));
      counts.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(counts[i]));
    }
  });
  it('lets the text size override the phone sheet', () => {
    expect(barsPerLine(358, 0.6, true)).toBe(3);
    expect(barsPerLine(358, 1.4, true)).toBe(1);
  });
  it('keeps a bar for every 240 pixels on narrow sheets outside a phone', () => {
    expect(barsPerLine(358, 1)).toBe(1);
    expect(barsPerLine(479, 1)).toBe(2);
    expect(barsPerLine(700, 1)).toBe(3);
  });
  it('keeps between one and eight bars on a line', () => {
    expect(barsPerLine(100, 1)).toBe(1);
    expect(barsPerLine(0, 1)).toBe(1);
    expect(barsPerLine(4000, 1)).toBe(8);
  });
});

describe('next zoom', () => {
  it('steps by a tenth without rounding drift', () => {
    expect(nextZoom(1, 'in')).toBe(1.1);
    expect(nextZoom(1, 'out')).toBe(0.9);
    expect(nextZoom(0.7, 'in')).toBe(0.8);
  });
  it('stops at 0.6 and 1.8', () => {
    expect(nextZoom(1.8, 'in')).toBe(1.8);
    expect(nextZoom(0.6, 'out')).toBe(0.6);
  });
  it('brings a zoom outside the range back only from the side it steps toward', () => {
    expect(nextZoom(0.4, 'in')).toBe(0.5);
    expect(nextZoom(0.4, 'out')).toBe(0.6);
    expect(nextZoom(2, 'in')).toBe(1.8);
    expect(nextZoom(2, 'out')).toBe(1.9);
  });
});

describe('time signature digit height', () => {
  it('fills half the staff', () => {
    expect(timeSignatureDigitHeight(4, 13)).toBe(19.5);
    expect(timeSignatureDigitHeight(5, 13)).toBe(26);
  });
  it('stops at 2.2 string spaces on taller staffs', () => {
    expect(timeSignatureDigitHeight(6, 13)).toBeCloseTo(28.6);
    expect(timeSignatureDigitHeight(6, 10)).toBeCloseTo(22);
  });
});

describe('bar widths', () => {
  it('shares the line by weight when every bar fits', () => {
    expect(barWidths(400, [1, 3], [50, 50])).toEqual([100, 300]);
  });
  it('gives a dense bar the width its notes need', () => {
    expect(barWidths(400, [1, 1, 2], [50, 200, 50])).toEqual([200 / 3, 200, 400 / 3]);
  });
  it('scales the needed widths down when the line is too short', () => {
    expect(barWidths(300, [1, 1], [200, 400])).toEqual([100, 200]);
  });
});

describe('label rows', () => {
  it('keeps labels that fit on the first row', () => {
    expect(labelRows([{ left: 0, width: 40 }, { left: 50, width: 40 }], 6)).toEqual([0, 0]);
  });
  it('lifts a label that would touch the one before it', () => {
    expect(labelRows([{ left: 0, width: 80 }, { left: 50, width: 40 }, { left: 100, width: 40 }], 6)).toEqual([0, 1, 0]);
  });
});

describe('line breaks', () => {
  it('fills each line up to the bar limit', () => {
    expect(lineBreaks([10, 10, 10, 10, 10], 100, 2)).toEqual([2, 2, 1]);
  });
  it('starts a new line before a bar that would not fit', () => {
    expect(lineBreaks([30, 30, 80, 20], 100, 4)).toEqual([2, 2]);
  });
  it('keeps a bar wider than the line on a line of its own', () => {
    expect(lineBreaks([150, 20], 100, 4)).toEqual([1, 1]);
  });
});

describe('mark room', () => {
  it('makes room above the tab only for a system with a mark', () => {
    expect(markRoom({ letters: false }, 13)).toBe(0);
    expect(markRoom({ letters: true }, 13)).toBe(19.5);
  });
});
