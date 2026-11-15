import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import type { ParseIssue } from '../../src/core/parseIssue';
import { barAtLine, beatMeter, nextIssue, offsetOf, positionAt, problemBars, spanRange } from '../../src/app/songProblems';

const issue = (line: number, col: number, length = 1): ParseIssue => ({ line, col, length, code: 'note-unreadable', message: 'x', severity: 'error' });

describe('song problems', () => {
  const text = 'title: A\ntempo: fast\n:q 3.3 9.x |';

  it('finds a span in the text, or its whole line when it has no length', () => {
    expect(spanRange(text, { line: 2, col: 8, length: 4 })).toEqual({ start: 16, end: 20 });
    expect(text.slice(16, 20)).toBe('fast');
    expect(spanRange(text, { line: 3, col: 1, length: 0 })).toEqual({ start: 21, end: 33 });
  });

  it('turns offsets into lines and columns and back', () => {
    expect(positionAt(text, 0)).toEqual({ line: 1, col: 1 });
    expect(positionAt(text, 16)).toEqual({ line: 2, col: 8 });
    expect(offsetOf(text, { line: 2, col: 8 })).toBe(16);
  });

  it('finds the next problem after the caret and comes round at the end', () => {
    const issues = [issue(5, 3), issue(2, 4), issue(5, 9)];
    expect(nextIssue(issues, { line: 1, col: 1 })).toBe(issues[1]);
    expect(nextIssue(issues, { line: 5, col: 3 })).toBe(issues[2]);
    expect(nextIssue(issues, { line: 6, col: 1 })).toBe(issues[1]);
  });

  it('finds the problem before the caret going back', () => {
    const issues = [issue(2, 4), issue(5, 3)];
    expect(nextIssue(issues, { line: 5, col: 3 }, true)).toBe(issues[0]);
    expect(nextIssue(issues, { line: 1, col: 1 }, true)).toBe(issues[1]);
    expect(nextIssue([], { line: 1, col: 1 })).toBeNull();
  });

  const song = parseSong('title: A\n:q 3.3 3.3 3.3 3.3 |\n# comment\n:q 5.3 5.3\n5.3 5.3 |\n== Two\n:q 7.3 7.3 7.3 7.3 |').song;

  it('finds the bar a line belongs to in the shown version', () => {
    expect(barAtLine(song.versions, 0, 1)).toBeNull();
    expect(barAtLine(song.versions, 0, 2)).toBe(1);
    expect(barAtLine(song.versions, 0, 3)).toBe(1);
    expect(barAtLine(song.versions, 0, 5)).toBe(2);
    expect(barAtLine(song.versions, 0, 7)).toBeNull();
    expect(barAtLine(song.versions, 1, 7)).toBe(1);
  });

  it('keeps the first problem of each bar', () => {
    const first = issue(4, 1), second = issue(5, 1), header = issue(1, 1);
    expect([...problemBars(song.versions, 0, [header, first, second])]).toEqual([[2, first]]);
  });

  it('measures a bar that is too long or too short', () => {
    expect(beatMeter({ beats: 5, expected: 4 })).toEqual({ summary: 'This bar has 5 beats. It needs 4.', segments: ['beat', 'beat', 'beat', 'beat', 'extra'] });
    expect(beatMeter({ beats: 2.5, expected: 4 })).toEqual({ summary: 'This bar has 2.5 beats. It needs 4.', segments: ['beat', 'beat', 'missing', 'missing'] });
    expect(beatMeter({ beats: 1, expected: 3 })?.summary).toBe('This bar has 1 beat. It needs 3.');
    expect(beatMeter({})).toBeNull();
  });
});
