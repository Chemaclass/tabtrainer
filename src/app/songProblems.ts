import type { Version } from '../core/model';
import type { IssueSpan, ParseIssue } from '../core/parseIssue';

export interface TextRange { start: number; end: number }
export interface TextPosition { line: number; col: number }

const lineStart = (lines: readonly string[], line: number) =>
  lines.slice(0, line - 1).reduce((start, text) => start + text.length + 1, 0);

/** The text offset of a 1-based line and column. */
export function offsetOf(text: string, { line, col }: TextPosition): number {
  return lineStart(text.split('\n'), line) + col - 1;
}

/** Where the span sits in the text, or its whole line when the span has no length. */
export function spanRange(text: string, { line, col, length }: IssueSpan): TextRange {
  const lines = text.split('\n');
  const from = lineStart(lines, line);
  return length ? { start: from + col - 1, end: from + col - 1 + length } : { start: from, end: from + (lines[line - 1]?.length ?? 0) };
}

export function positionAt(text: string, offset: number): TextPosition {
  const before = text.slice(0, offset);
  const lineFrom = before.lastIndexOf('\n') + 1;
  return { line: before.split('\n').length, col: offset - lineFrom + 1 };
}

const after = (a: TextPosition, b: TextPosition) => a.line > b.line || (a.line === b.line && a.col > b.col);

/** The problem after the caret, or before it going back, coming round at the ends. */
export function nextIssue<T extends ParseIssue>(issues: readonly T[], caret: TextPosition, back = false): T | null {
  const ordered = [...issues].sort((a, b) => a.line - b.line || a.col - b.col);
  if (back) return [...ordered].reverse().find(issue => after(caret, issue)) ?? ordered.at(-1) ?? null;
  return ordered.find(issue => after(issue, caret)) ?? ordered[0] ?? null;
}

interface SourceStart extends TextPosition { version: number; bar: number | null }

/** The bar of the shown version that a source position belongs to: the last bar starting at or before it, and none past a version's "==" line. */
export function barAt(versions: readonly Version[], shown: number, at: TextPosition): number | null {
  const starts: SourceStart[] = versions.flatMap((version, index) => [
    ...(version.line === undefined ? [] : [{ version: index, bar: null, line: version.line, col: 1 }]),
    ...version.bars.filter(bar => bar.line !== undefined).map(bar => ({ version: index, bar: bar.index, line: bar.line ?? 0, col: bar.col ?? 1 })),
  ]);
  const found = starts.reduce<SourceStart | null>((best, start) => !after(start, at) && (!best || !after(best, start)) ? start : best, null);
  return found && found.version === shown ? found.bar : null;
}

/** The first problem in each bar of the shown version, by bar number. */
export function problemBars<T extends ParseIssue>(versions: readonly Version[], shown: number, issues: readonly T[]): Map<number, T> {
  const bars = new Map<number, T>();
  for (const issue of issues) {
    const bar = barAt(versions, shown, issue);
    if (bar !== null && !bars.has(bar)) bars.set(bar, issue);
  }
  return bars;
}

export type BeatSegment = 'beat' | 'extra' | 'missing';
export interface BeatMeter { summary: string; segments: BeatSegment[] }

const beatCount = (beats: number) => `${beats} beat${beats === 1 ? '' : 's'}`;

/** How many beats a bar that is too long or too short holds against the beats it needs. */
export function beatMeter({ beats, expected }: Pick<ParseIssue, 'beats' | 'expected'>): BeatMeter | null {
  if (beats === undefined || expected === undefined || beats === expected) return null;
  const long = beats > expected;
  const segment = (at: number): BeatSegment => long ? (at + 1 > expected ? 'extra' : 'beat') : (at + 1 <= beats ? 'beat' : 'missing');
  const segments = Array.from({ length: Math.ceil(Math.max(beats, expected)) }, (_, at) => segment(at));
  return { summary: `This bar has ${beatCount(beats)}. It needs ${expected}.`, segments };
}
