import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGroove } from '../../src/core/groove';
import { buildGrooveTimeline } from '../../src/core/grooveTimeline';

const blues = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8')).groove;
const groove = (body: string, swing = 50) => parseGroove(`time: 4/4\nswing: ${swing}\nprogression: I7 IV7 V7 I7\n${body}`).groove;

describe('buildGrooveTimeline', () => {
  it('lasts bars times beats per bar', () => {
    expect(buildGrooveTimeline(blues).total).toBe(48);
    const waltz = parseGroove('time: 3/4\nprogression: I IV V\nkick: x.....\n').groove;
    expect(buildGrooveTimeline(waltz).total).toBe(9);
    expect(buildGrooveTimeline(waltz).drums.map(h => h.beat)).toEqual([0, 3, 6]);
  });
  it('lists each bar with its chord', () => {
    const t = buildGrooveTimeline(blues);
    expect(t.bars.map(b => b.chord.name)).toEqual(['A7', 'D7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7']);
    expect(t.bars[8]).toMatchObject({ bar: 8, start: 32, length: 4 });
  });
  it('lands off beat eighths at two thirds of the beat with swing 66, and at half with swing 50', () => {
    const hats = (swing: number) => buildGrooveTimeline(groove('hat: xxxxxxxx\n', swing)).drums.slice(0, 4).map(h => h.beat);
    const shuffle = hats(66);
    expect(shuffle[0]).toBe(0);
    expect(shuffle[1]).toBeCloseTo(2 / 3, 9);
    expect(shuffle[2]).toBe(1);
    expect(shuffle[3]).toBeCloseTo(5 / 3, 9);
    expect(hats(70)[1]).toBeCloseTo(0.7, 9);
    expect(hats(50)).toEqual([0, 0.5, 1, 1.5]);
  });
  it('keeps sixteenths inside the swung eighths when a part plays eighths', () => {
    const t = buildGrooveTimeline(groove('kick: .x......\nhat: xxxxxxxxxxxxxxxx\n', 66));
    const kick = t.drums.find(h => h.drum === 'kick')!;
    const hats = t.drums.filter(h => h.drum === 'hat').slice(0, 4).map(h => h.beat);
    expect(kick.beat).toBeCloseTo(2 / 3, 9);
    [0, 1 / 3, 2 / 3, 5 / 6].forEach((b, i) => expect(hats[i]).toBeCloseTo(b, 9));
  });
  it('does not swing compound meters', () => {
    const jig = parseGroove('time: 6/8\nswing: 66\nprogression: I\nhat: xxxxxx\n').groove;
    expect(buildGrooveTimeline(jig).drums.map(h => h.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });
  it('swings off beat sixteenths and leaves triplets alone', () => {
    const sixteenths = buildGrooveTimeline(groove('hat: xxxxxxxxxxxxxxxx\n', 60)).drums.slice(0, 4).map(h => h.beat);
    [0, 0.3, 0.5, 0.8].forEach((b, i) => expect(sixteenths[i]).toBeCloseTo(b, 9));
    const triplets = buildGrooveTimeline(groove('hat: xxxxxxxxxxxx\n', 66)).drums.slice(0, 3).map(h => h.beat);
    expect(triplets[1]).toBeCloseTo(1 / 3);
    expect(triplets[2]).toBeCloseTo(2 / 3);
  });
  it('repeats a short pattern every bar and maps steps to velocity', () => {
    const t = buildGrooveTimeline(groove('kick: X.o. x... | X... ....\n'));
    expect(t.drums.map(h => [h.bar, h.beat, h.velocity])).toEqual([[0, 0, 1], [0, 1, 0.45], [0, 2, 0.8], [1, 4, 1], [2, 8, 1], [2, 9, 0.45], [2, 10, 0.8], [3, 12, 1]]);
  });
  it('plays bass degrees of each chord and holds notes over "-"', () => {
    const t = buildGrooveTimeline(groove('bass: 1 3 5 b7 8 - . .\n'), 'A');
    expect(t.bass.slice(0, 5).map(h => [h.midi[0], h.length])).toEqual([[33, 0.5], [37, 0.5], [40, 0.5], [43, 0.5], [45, 1]]);
    expect(t.bass[5].midi).toEqual([38]);
  });
  it('stabs keys chords and holds them over "-"', () => {
    const t = buildGrooveTimeline(groove('keys: X--.x...\n'), 'A');
    expect(t.keys[0]).toEqual({ beat: 0, bar: 0, length: 1.5, midi: [57, 61, 64, 67], velocity: 1 });
    expect(t.keys[1]).toMatchObject({ beat: 2, length: 0.5, velocity: 0.8 });
    expect(t.keys[2].midi).toEqual([62, 66, 69, 72]);
  });
  it('ends a held swung note on the swung position of the next step', () => {
    const t = buildGrooveTimeline(groove('keys: X.......\nbass: 1 - . . . . . .\n', 66));
    expect(t.keys[0].length).toBeCloseTo(2 / 3, 9);
    expect(t.bass[0].length).toBe(1);
  });
  it('moves bass and keys up 3 semitones from A to C and leaves drums alone', () => {
    const full = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8') + 'bass: 1 3 5 b7 8 b7 5 3\n').groove;
    const a = buildGrooveTimeline(full, 'A'); const c = buildGrooveTimeline(full, 'C');
    expect(a.bass.length).toBeGreaterThan(0);
    expect(a.keys.length).toBeGreaterThan(0);
    for (const part of ['bass', 'keys'] as const) {
      expect(c[part].map(h => ({ ...h, midi: h.midi.map(m => m - 3) }))).toEqual(a[part]);
    }
    expect(c.drums).toEqual(a.drums);
    expect(c.bars.map(b => b.chord.name).slice(0, 3)).toEqual(['C7', 'F7', 'C7']);
  });
  it('uses the groove key by default and falls back to C for an unknown key', () => {
    expect(buildGrooveTimeline(blues).bars[0].chord.name).toBe('A7');
    expect(buildGrooveTimeline(blues, 'H').bars[0].chord.name).toBe('C7');
  });
});
