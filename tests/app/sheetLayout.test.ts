import { describe, expect, it } from 'vitest';
import { barsPerLine, nextZoom } from '../../src/app/sheetLayout';

describe('bars per line', () => {
  it('fits wider bars when notation is shown', () => {
    expect(barsPerLine(1200, 1, true)).toBe(4);
    expect(barsPerLine(1200, 1, false)).toBe(5);
  });
  it('fits fewer bars as the score zooms in', () => {
    expect(barsPerLine(1200, 2, true)).toBe(2);
    expect(barsPerLine(1200, 0.6, true)).toBe(7);
  });
  it('keeps between one and eight bars on a line', () => {
    expect(barsPerLine(100, 1, true)).toBe(1);
    expect(barsPerLine(0, 1, false)).toBe(1);
    expect(barsPerLine(4000, 1, false)).toBe(8);
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
