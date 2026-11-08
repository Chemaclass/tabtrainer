import { describe, expect, it } from 'vitest';
import { parseSong, parseDuration } from '../src/core/parser';
import { serializeSong } from '../src/core/serialize';
import { buildTimeline } from '../src/core/timeline';
import { PPQ } from '../src/core/model';

const SRC = `title: Test
instrument: bass4
tempo: 100
key: G
time: 4/4

@Intro
"G" :q 3.4 5.4 :8 2.3 3.3 :q 5.3 |
(3.4 5.3):h r:h |
[2/4] :8t 3.3 5.3 7.3 :q ~7.3 |
`;

describe('parseDuration', () => {
  it('handles dots and triplets', () => {
    expect(parseDuration('q')!.ticks).toBe(PPQ);
    expect(parseDuration('q.')!.ticks).toBe(PPQ * 1.5);
    expect(parseDuration('8t')!.ticks).toBe(PPQ / 3);
    expect(parseDuration('h..')!.ticks).toBe(PPQ * 3.5);
    expect(parseDuration('x')).toBeNull();
  });
});

describe('parseSong', () => {
  const { song, issues } = parseSong(SRC);
  it('reads header and bars', () => {
    expect(issues).toEqual([]);
    expect(song.meta.title).toBe('Test');
    expect(song.meta.tempo).toBe(100);
    expect(song.bars).toHaveLength(3);
    expect(song.bars[0].section).toBe('Intro');
    expect(song.bars[0].events[0].chord).toBe('G');
    expect(song.bars[1].events[0].notes).toHaveLength(2);
    expect(song.bars[2].beats).toBe(2);
    expect(song.bars[2].events[3].notes[0].tie).toBe(true);
  });
  it('ignores comments after header values, like in the body', () => {
    const r = parseSong('title: X\ninstrument: bass5   # five strings\nkey: F#m\n\n:w 3.3 |\n');
    expect(r.issues).toEqual([]);
    expect(r.song.meta.instrument.id).toBe('bass5');
    expect(r.song.meta.key).toBe('F#m');
  });
  it('round-trips through the serializer', () => {
    const again = parseSong(serializeSong(song));
    expect(again.issues).toEqual([]);
    expect(again.song.bars).toEqual(song.bars.map(b => ({ ...b, line: again.song.bars[b.index - 1].line })));
  });
  it('reports errors with line numbers', () => {
    const r = parseSong('title: x\n:q 3.9 |\n:q 3.4 3.4 3.4 3.4 3.4 |');
    const errs = r.issues.filter(i => i.severity === 'error');
    expect(errs[0]).toMatchObject({ line: 2 });
    expect(errs[0].message).toMatch(/String 9/);
    expect(errs.some(e => e.line === 3 && /too long/.test(e.message))).toBe(true);
  });
  it('fills short bars with a warning', () => {
    const r = parseSong(':q 3.4 |');
    expect(r.issues[0].severity).toBe('warning');
    expect(r.song.bars[0].events.at(-1)!.notes).toEqual([]);
  });
  it('supports custom tunings', () => {
    const r = parseSong('tuning: D2 A2 D3 G3\n:w 0.4 |');
    expect(r.song.meta.instrument.tuning).toHaveLength(4);
    expect(buildTimeline(r.song).notes[0].midi).toBe(38 - 12);
  });
});

describe('timeline', () => {
  it('places notes in beats and lets ties extend', () => {
    const { song } = parseSong(SRC);
    const tl = buildTimeline(song);
    expect(tl.bars.map(b => b.length)).toEqual([4, 4, 2]);
    expect(tl.total).toBe(10);
    // the tied 7.3 in bar 3 is not re-struck
    expect(tl.notes.filter(n => n.bar === 3)).toHaveLength(3);
    expect(tl.notes[0]).toMatchObject({ beat: 0, midi: 40 + 3 - 12 });
  });
});
