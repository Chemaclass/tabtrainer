import { describe, expect, it } from 'vitest';
import { headerKeys, parseSong, parseDuration } from '../../src/core/parser';
import { serializeSong } from '../../src/core/serialize';
import { buildTimeline } from '../../src/core/timeline';
import { PPQ } from '../../src/core/model';
import type { ParseIssue, SongIssueCode } from '../../src/core/parseIssue';

const SRC = `title: Test
about: Root notes in quarters
listen: https://www.youtube.com/watch?v=abc
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
    expect(song.meta.about).toBe('Root notes in quarters');
    expect(song.meta.listen).toBe('https://www.youtube.com/watch?v=abc');
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
    expect(again.song.meta.about).toBe(song.meta.about);
    expect(again.song.meta.listen).toBe(song.meta.listen);
    expect(again.song.bars).toEqual(song.bars.map(b => ({ ...b, line: again.song.bars[b.index - 1].line, col: again.song.bars[b.index - 1].col })));
  });
  it('records where each bar and version starts in the source', () => {
    const { song } = parseSong('title: x\n"C" :q 3.4 3.4 3.4 3.4 | 5.4 5.4 5.4 5.4 |\n== Two\n:w 3.4 |');
    expect(song.versions[0].bars.map(b => [b.line, b.col])).toEqual([[2, 1], [2, 26]]);
    expect(song.versions[0].line).toBeUndefined();
    expect(song.versions[1].line).toBe(3);
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
  it('places notes in beats and replays ties softly', () => {
    const { song } = parseSong(SRC);
    const tl = buildTimeline(song);
    expect(tl.bars.map(b => b.length)).toEqual([4, 4, 2]);
    expect(tl.total).toBe(10);
    // the tied 7.3 in bar 3 sounds again at half volume
    const bar3 = tl.notes.filter(n => n.bar === 3);
    expect(bar3).toHaveLength(4);
    expect(bar3.filter(n => n.soft)).toMatchObject([{ fret: 7, string: 3 }]);
    expect(tl.notes[0]).toMatchObject({ beat: 0, midi: 40 + 3 - 12 });
  });
  it('rejects a listen: line that is not a web address', () => {
    for (const bad of ['youtube', 'javascript:alert(1)', 'https://youtube.com:99999']) {
      const { song, issues } = parseSong(`listen: ${bad}\n:q 0.4 0.4 0.4 0.4 |`);
      expect(song.meta.listen).toBeUndefined();
      expect(issues[0]).toMatchObject({ line: 1, severity: 'error' });
    }
  });
});

describe('lyrics', () => {
  const SRC = `title: Sing along
instrument: bass4
tempo: 90
key: C
time: 4/4

"C" <la la, don't stop> :q 3.3 3.3 <hey> 5.2 3.3 |
<ooh> :h r 3.3 |
`;
  const { song, issues } = parseSong(SRC);
  it('attaches <words> to the next note or rest', () => {
    expect(issues).toEqual([]);
    expect(song.bars[0].events.map(e => e.lyric)).toEqual(["la la, don't stop", undefined, 'hey', undefined]);
    expect(song.bars[0].events[0].chord).toBe('C');
    expect(song.bars[1].events[0]).toMatchObject({ notes: [], lyric: 'ooh' });
  });
  it('survives a round trip', () => {
    expect(parseSong(serializeSong(song)).song.bars).toEqual(song.bars.map(b => expect.objectContaining({ events: b.events })));
  });
});

describe('bar tempo changes', () => {
  it('preserves tempo marks through serialization and version changes', () => {
    const { song, issues } = parseSong('tempo: 78\n== First\n:q 0.4 0.4 0.4 0.4 |\n[tempo=130] :w 0.4 |\n== Second\n:w 0.4 |');
    expect(issues).toEqual([]);
    expect(song.versions[0].bars.map(b => b.tempo)).toEqual([undefined, 130]);
    expect(song.versions[1].bars[0].tempo).toBeUndefined();
    const again = parseSong(serializeSong(song));
    expect(again.issues).toEqual([]);
    expect(again.song.versions.map(v => v.bars.map(b => b.tempo))).toEqual([[undefined, 130], [undefined]]);
    expect(buildTimeline(song).bars[1].tempo).toBe(130);
  });
  it.each(['0', '19', '401', 'Infinity', 'NaN', '-1', '78bpm'])('rejects invalid tempo %s', tempo => {
    expect(parseSong(`[tempo=${tempo}] :w 0.4 |`).issues).toEqual([expect.objectContaining({ severity: 'error' })]);
  });
  it('rejects a tempo change after notes in the same bar', () => {
    const result = parseSong(':q 0.4 [tempo=130] 0.4 0.4 0.4 |');
    expect(result.issues).toEqual([expect.objectContaining({ message: 'Put tempo changes before the first note of a bar' })]);
  });
});

describe('header keys', () => {
  it('finds header keys in any case, skipping blank and comment lines', () => {
    expect(headerKeys('# my song\nTitle: A\n\nTEMPO: 80  # slow\nkey: C\n:q 3.3 |\n')).toEqual(new Set(['title', 'tempo', 'key']));
  });
  it('stops at the separator line and at the first body line', () => {
    expect(headerKeys('title: A\n---\nartist: B\n')).toEqual(new Set(['title']));
    expect(headerKeys('title: A\n@Verse\nartist: B\n')).toEqual(new Set(['title']));
  });
  it('ignores a level line under a version line', () => {
    expect(headerKeys('title: A\n:q 3.3 3.3 3.3 3.3 |\n== Hard\nlevel: hard\n:q 3.3 3.3 3.3 3.3 |\n').has('level')).toBe(false);
  });
  it('leaves out a line with no value', () => {
    expect(headerKeys('title: A\nabout:   # later\n')).toEqual(new Set(['title']));
  });
});

describe('dead notes', () => {
  const guitar = (body: string) => parseSong(`instrument: guitar6\n${body}`);
  it('reads x.3 and X.3 as a dead note on that string', () => {
    const { song, issues } = guitar(':q x.3 X.3 (x.4 x.3) 5.3 |');
    expect(issues).toEqual([]);
    expect(song.bars[0].events.map(e => e.notes)).toEqual([
      [{ string: 3, fret: 0, dead: true }],
      [{ string: 3, fret: 0, dead: true }],
      [{ string: 4, fret: 0, dead: true }, { string: 3, fret: 0, dead: true }],
      [{ string: 3, fret: 5 }],
    ]);
  });
  it('rejects a mark on a dead note and a missing string', () => {
    expect(guitar(':q hx.3 ~x.3 3.4 3.4 |').issues.map(i => i.code)).toEqual(['note-unreadable', 'note-unreadable', 'bar-short']);
    expect(parseSong('instrument: bass4\n:h x.9 x.4 x.4 |').issues.map(i => i.code)).toEqual(['string-missing']);
  });
  it('rejects a tie that would hold a dead note', () => {
    expect(guitar(':q x.3 ~5.3 5.3 ~5.3 |').issues.map(i => i.code)).toEqual(['tie-dead']);
    expect(guitar(':q x.3 5.2 ~5.2 x.3 |\n== Other\n:q ~5.3 5.3 5.3 5.3 |').issues.map(i => i.code)).toEqual([]);
  });
  it('writes a dead note back in lower case and survives a round trip', () => {
    const { song } = guitar(':8 X.6 0.6 (x.4 x.3 x.2 x.1) 3.1 :q x.5 x.5 | :h (3.6 x.5) x.4 |');
    const text = serializeSong(song);
    expect(text).toContain(':8 x.6 0.6 (x.4 x.3 x.2 x.1) 3.1 :q x.5 x.5 |');
    const again = parseSong(text);
    expect(again.issues).toEqual([]);
    expect(again.song.bars.map(b => b.events)).toEqual(song.bars.map(b => b.events));
  });
});

describe('palm mute', () => {
  const guitar = (body: string) => parseSong(`instrument: guitar6\n${body}`);
  it('marks a note or a chord, with or without its own length', () => {
    const { song, issues } = guitar(':q _0.6 _(0.6 2.5) _0.6:8 _x.5:8 0.6:q |');
    expect(issues).toEqual([]);
    const events = song.bars[0].events;
    expect(events.map(e => e.palmMute)).toEqual([true, true, true, true, undefined]);
    expect(events[1].notes).toEqual([{ string: 6, fret: 0 }, { string: 5, fret: 2 }]);
    expect(events[2].dur).toBe(PPQ / 2);
    expect(events[3].notes).toEqual([{ string: 5, fret: 0, dead: true }]);
  });
  it('keeps the chord and drops the mark when it is inside the brackets', () => {
    const { song, issues } = guitar(':q (0.6 _2.5) 0.6 0.6 0.6 |');
    expect(issues).toEqual([expect.objectContaining({ code: 'palm-mute-place', col: 9, length: 4, hint: 'e.g. _(0.6 2.5)' })]);
    expect(song.bars[0].events[0]).toMatchObject({ notes: [{ string: 6, fret: 0 }, { string: 5, fret: 2 }] });
    expect(song.bars[0].events[0].palmMute).toBeUndefined();
  });
  it('rejects a palm mute on a rest or on nothing', () => {
    const { song, issues } = guitar(':q _r _ 0.6 0.6 0.6 |');
    expect(issues.map(i => [i.code, i.col, i.length])).toEqual([['palm-mute-place', 4, 2], ['palm-mute-place', 7, 1]]);
    expect(song.bars[0].events[0]).toMatchObject({ notes: [] });
    expect(song.bars[0].events).toHaveLength(4);
  });
  it('points a problem in a muted note at the note', () => {
    expect(guitar(':q _3.9 0.6 0.6 0.6 0.6 |').issues).toEqual([expect.objectContaining({ code: 'string-missing', col: 5, length: 3 })]);
  });
  it('survives a round trip', () => {
    const { song } = guitar(':8 _0.6 _0.6 (3.6 5.5) _(3.6 5.5) _x.6 _0.6 :q _~0.6 | _(0.6 x.5) 0.6 _0.6:h |');
    const text = serializeSong(song);
    expect(text).toContain(':8 _0.6 _0.6 (3.6 5.5) _(3.6 5.5) _x.6 _0.6 :q _~0.6 | _(0.6 x.5) 0.6 :h _0.6 |');
    const again = parseSong(text);
    expect(again.issues).toEqual([]);
    expect(again.song.bars.map(b => b.events)).toEqual(song.bars.map(b => b.events));
  });
});

describe('issue codes', () => {
  const CASES: Record<SongIssueCode, [string, Partial<ParseIssue>]> = {
    'level-unknown': ['level: brutal\n:w 3.4 |', { line: 1, col: 8, length: 6 }],
    'listen-address': ['listen: youtube\n:w 3.4 |', { line: 1, col: 9, length: 7 }],
    'tempo-range': ['tempo:  5  # slow\n:w 3.4 |', { line: 1, col: 9, length: 1 }],
    'tempo-late': [':q 0.4 [tempo=130] 0.4 0.4 0.4 |', { line: 1, col: 8, length: 11 }],
    'instrument-unknown': ['instrument: banjo\n:w 3.4 |', { line: 1, col: 13, length: 5, hint: expect.stringMatching(/^Use one of: bass4/) }],
    'tuning-unreadable': ['title: T\ntuning: X9 Q\n:w 0.2 |', { line: 2, col: 9, length: 4 }],
    'time-signature': ['time: 4-4\n:w 3.4 |', { line: 1, col: 7, length: 3 }],
    'note-unreadable': [':q 3.4 3x4 3.4 3.4 3.4 |', { line: 1, col: 8, length: 3, hint: 'Notes are fret.string, e.g. 3.4 (fret 3 on string 4)' }],
    'string-missing': [':q 3.4 (3.4 3.9) 3.4 3.4 |', { line: 1, col: 13, length: 3 }],
    'fret-high': [':h 3.4 30.4 3.4 |', { line: 1, col: 8, length: 4 }],
    'string-twice': [':q (3.4 5.4):h r:h |', { line: 1, col: 4, length: 11 }],
    'tie-dead': [':q x.4 ~3.4 3.4 3.4 |', { line: 1, col: 8, length: 4 }],
    'duration-unknown': [':q 3.4:x 3.4 3.4 3.4 3.4 |', { line: 1, col: 7, length: 2 }],
    'palm-mute-place': [':q (_0.4 2.3) 3.4 3.4 3.4 |', { line: 1, col: 5, length: 4 }],
    'bar-short': ['title: x\n:q 3.4 5.4 3.3 |', { line: 2, col: 4, length: 11, beats: 3, expected: 4 }],
    'bar-long': [':q 3.4 3.4 3.4 3.4 3.4 |', { line: 1, col: 20, length: 3, beats: 5, expected: 4, hint: '(missing a "|"?)' }],
    'version-duplicate': ['== A\n:w 3.4 |\n== A\n:w 3.4 |', { line: 3, col: 1, length: 4 }],
    'version-empty': ['# x\n== A\n== B\n:w 3.4 |', { line: 2, col: 1, length: 4 }],
    'song-empty': ['title: x\n', { line: 1, col: 1, length: 0 }],
  };
  it.each(Object.entries(CASES))('points %s at its token', (code, [src, where]) => {
    expect(parseSong(src).issues).toEqual([expect.objectContaining({ code, ...where })]);
  });
  it('points a version level at its value', () => {
    expect(parseSong(':w 3.4 |\n== Hard\n  level: brutal\n:w 3.4 |').issues).toEqual([expect.objectContaining({ code: 'level-unknown', line: 3, col: 10, length: 6 })]);
  });
  it('ends each message with its hint', () => {
    const issues = Object.values(CASES).flatMap(([src]) => parseSong(src).issues);
    expect(issues.filter(issue => issue.hint).length).toBeGreaterThan(3);
    for (const issue of issues) if (issue.hint) expect(issue.message.endsWith(` ${issue.hint}`) || issue.message.endsWith(`, ${issue.hint}`)).toBe(true);
  });
});
