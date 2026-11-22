import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGroove } from '../../src/core/groove';
import { BASS_RANGE, KEYS_RANGE, POWER_CHORD_RANGE, buildGrooveTimeline } from '../../src/core/grooveTimeline';
import { pitchClass } from '../../src/core/theory';

const blues = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8')).groove;
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
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
    expect(t.keys[2].midi).toEqual([57, 60, 62, 66]);
  });
  it('ends a held swung note on the swung position of the next step', () => {
    const t = buildGrooveTimeline(groove('keys: X.......\nbass: 1 - . . . . . .\n', 66));
    expect(t.keys[0].length).toBeCloseTo(2 / 3, 9);
    expect(t.bass[0].length).toBe(1);
  });
  it('moves bass and keys with the chords when the key changes and leaves drums alone', () => {
    const a = buildGrooveTimeline(blues, 'A'); const c = buildGrooveTimeline(blues, 'C');
    expect(a.bass.length).toBeGreaterThan(0);
    expect(a.keys.length).toBeGreaterThan(0);
    for (const part of ['bass', 'keys'] as const) {
      expect(c[part].map(h => ({ ...h, midi: h.midi.map(m => pitchClass(m - 3)).sort() }))).toEqual(a[part].map(h => ({ ...h, midi: h.midi.map(pitchClass).sort() })));
    }
    expect(c.drums).toEqual(a.drums);
    expect(c.bars.map(b => b.chord.name).slice(0, 3)).toEqual(['C7', 'F7', 'C7']);
  });
  it('plays a blues bass of chord tones and passing sixths, from the root on each chord change, in every key', () => {
    for (const key of MAJOR_KEYS) {
      const t = buildGrooveTimeline(blues, key);
      t.bars.forEach(({ bar, chord }) => {
        const notes = t.bass.filter(h => h.bar === bar).map(h => pitchClass(h.midi[0] - chord.root));
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.every(n => chord.intervals.includes(n) || n === 9)).toBe(true);
        if (bar === 0 || t.bars[bar - 1].chord.root !== chord.root) expect(notes[0]).toBe(0);
      });
    }
  });
  it('folds bass into E1 to G3 and keys into A3 to G#4 in every key, keeping the shape of each bar', () => {
    const wide = groove('bass: 1 3 5 6 b7 8 . .\nkeys: x.......\n');
    for (const key of [...MAJOR_KEYS, ...MINOR_KEYS]) {
      for (const t of [buildGrooveTimeline(blues, key), buildGrooveTimeline(wide, key)]) {
        expect(t.bass.every(h => h.midi[0] >= BASS_RANGE.low && h.midi[0] <= BASS_RANGE.high)).toBe(true);
        expect(t.keys.every(h => h.midi.every(m => m >= KEYS_RANGE.low && m <= KEYS_RANGE.high))).toBe(true);
      }
      const bar = buildGrooveTimeline(wide, key).bass.slice(0, 6).map(h => h.midi[0]);
      expect(bar.map(m => m - bar[0])).toEqual([0, 4, 7, 9, 10, 12]);
    }
  });
  it('plays an approach step from the next chord: ">b1" a half step below its root, a degree in the octave nearest that root', () => {
    const t = buildGrooveTimeline(groove('bass: 1 - 3 - >5 - >b1 - | 1 - 3 - >3 - >2 -\n'), 'A');
    const bar = (n: number) => t.bass.filter(h => h.bar === n).map(h => h.midi[0]);
    expect(bar(0)).toEqual([33, 37, 33, 37]);
    expect(bar(1)).toEqual([38, 42, 44, 42]);
    expect(t.bass[3].length).toBe(1);
  });
  it('approaches the first chord from the last bar, and a low E from a half step above', () => {
    const t = buildGrooveTimeline(groove('bass: 1 - 3 - 5 - >b1 -\n'), 'E');
    expect(t.bass.at(-1)!.midi[0]).toBe(29);
    expect(t.bass[3].midi[0]).toBe(32);
  });
  it('voices a power chord as root, fifth and octave between A2 and G#4, and passes the keys voice on', () => {
    const power = parseGroove('progression: I5 bVI5\nvoice: drive\nkeys: x.......\n').groove;
    for (const key of MAJOR_KEYS) {
      const t = buildGrooveTimeline(power, key);
      for (const hit of t.keys) {
        expect(hit.midi.map(m => m - hit.midi[0])).toEqual([0, 7, 12]);
        expect(hit.midi[0] >= POWER_CHORD_RANGE.low && hit.midi[2] <= POWER_CHORD_RANGE.high).toBe(true);
      }
      expect(t.voice).toBe('drive');
    }
    expect(buildGrooveTimeline(blues).voice).toBe('keys');
    const full = parseGroove('progression: I vi\nvoice: drive\nkeys: x.......\n').groove;
    expect(buildGrooveTimeline(full, 'A').keys.map(hit => hit.midi.map(m => m - hit.midi[0]))).toEqual([[0, 7, 12], [0, 7, 12]]);
  });
  it('passes the drum kit on', () => {
    expect(buildGrooveTimeline(blues).kit).toBe('blues');
    expect(buildGrooveTimeline(parseGroove('progression: I\nkick: x...\n').groove).kit).toBe('rock');
  });
  it('plays a tom fill over the last two beats of the progression only when the groove turns fills on', () => {
    const src = 'progression: I IV V I\nhat: xxxxxxxx\nsnare: ..x...x.\nkick: x...x...\n';
    const plain = buildGrooveTimeline(parseGroove(src).groove);
    const filled = buildGrooveTimeline(parseGroove(`fill: on\n${src}`).groove);
    const toms = (t: typeof filled) => t.drums.filter(h => h.drum.endsWith('tom'));
    expect(toms(plain)).toEqual([]);
    expect(filled.drums.filter(h => h.bar < 3)).toEqual(plain.drums.filter(h => h.bar < 3));
    expect(toms(filled).length).toBeGreaterThan(0);
    expect(toms(filled).every(h => h.bar === 3 && h.beat >= 14)).toBe(true);
    const fillBeats = filled.drums.filter(h => h.beat >= 14);
    expect(fillBeats.some(h => h.drum === 'hat')).toBe(false);
    expect(fillBeats.map(h => h.drum)).toEqual(['snare', 'kick', 'snare', 'hightom', 'hightom', 'midtom', 'midtom', 'lowtom', 'kick', 'lowtom']);
    expect(filled.drums.filter(h => h.bar === 3 && h.beat < 14)).toEqual(plain.drums.filter(h => h.bar === 3 && h.beat < 14));
  });
  it('swings the fill with the groove', () => {
    const t = buildGrooveTimeline(parseGroove('swing: 66\nfill: on\nprogression: I\nhat: xxxxxxxx\n').groove);
    expect(t.drums.find(h => h.drum === 'midtom')!.beat).toBeCloseTo(3, 9);
    expect(t.drums.filter(h => h.drum === 'snare').map(h => h.beat)).toEqual([2, expect.closeTo(2 + 1 / 3, 9)]);
  });
  it('uses the groove key by default and falls back to C for an unknown key', () => {
    expect(buildGrooveTimeline(blues).bars[0].chord.name).toBe('A7');
    expect(buildGrooveTimeline(blues, 'H').bars[0].chord.name).toBe('C7');
  });
});
