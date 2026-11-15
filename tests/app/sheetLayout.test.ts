import { describe, expect, it } from 'vitest';
import { barsPerLine, nextZoom, timeSignatureDigitHeight } from '../../src/app/sheetLayout';

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
    expect(barsPerLine(358, 1)).toBe(2);
    expect(barsPerLine(346, 1)).toBe(2);
    expect(barsPerLine(300, 1)).toBe(2);
  });
  it('lets the text size override the phone sheet', () => {
    expect(barsPerLine(358, 0.6)).toBe(3);
    expect(barsPerLine(358, 1.4)).toBe(1);
  });
  it('keeps a bar for every 240 pixels from 480 pixels up', () => {
    expect(barsPerLine(480, 1)).toBe(2);
    expect(barsPerLine(524, 1)).toBe(2);
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
