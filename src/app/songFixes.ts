import type { IssueSpan, ParseIssue } from '../core/parseIssue';
import { offsetOf } from './songProblems';

/** Replaces `length` characters from line and column with text; a length of 0 inserts. */
export interface TextEdit extends IssueSpan { text: string }
export interface SongFix { label: string; edit: TextEdit }

const DEFAULT_TEMPO = 90;
const MIN_TEMPO = 20;
const MAX_TEMPO = 400;

const tokenOf = (text: string, { line, col, length }: IssueSpan) => text.split('\n')[line - 1]?.slice(col - 1, col - 1 + length) ?? '';

function tempoFix(text: string, issue: IssueSpan): SongFix {
  const token = tokenOf(text, issue);
  const inline = token.startsWith('[');
  const written = parseFloat(inline ? token.slice('[tempo='.length) : token);
  const tempo = Number.isFinite(written) ? Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(written))) : DEFAULT_TEMPO;
  const label = `Set to ${tempo}`;
  if (inline) return { label, edit: { ...issue, text: `[tempo=${tempo}]` } };
  if (token.endsWith(':')) return { label, edit: { ...issue, col: issue.col + issue.length, length: 0, text: ` ${tempo}` } };
  return { label, edit: { ...issue, text: String(tempo) } };
}

function removeToken(text: string, issue: IssueSpan): TextEdit {
  const line = text.split('\n')[issue.line - 1] ?? '';
  const end = issue.col - 1 + issue.length;
  const trailing = /^ +/.exec(line.slice(end))?.[0].length ?? 0;
  const leading = trailing ? 0 : / +$/.exec(line.slice(0, issue.col - 1))?.[0].length ?? 0;
  return { line: issue.line, col: issue.col - leading, length: issue.length + leading + trailing, text: '' };
}

const SWAPPED_JOIN: Record<string, string> = { h: 'p', p: 'h', '/': '\\', '\\': '/' };

function legatoFix(text: string, issue: IssueSpan): SongFix[] {
  const token = tokenOf(text, issue);
  const swapped = SWAPPED_JOIN[token[0]];
  if (!swapped) return [];
  const fixedToken = swapped + token.slice(1);
  return [{ label: `Change to ${fixedToken}`, edit: { ...issue, length: 1, text: swapped } }];
}

/** The mechanical fixes for a problem, each one a text edit the player can apply with one click. */
export function songFixes(text: string, issue: ParseIssue): SongFix[] {
  if (!issue.length) return [];
  if (issue.code === 'tempo-range') return [tempoFix(text, issue)];
  // A hammer-on or pull-off that stays on its fret has no swap to offer: its hint says to tie instead
  if (issue.code === 'legato-direction' && !issue.hint?.startsWith('Use ~')) return legatoFix(text, issue);
  if (issue.code === 'bar-long') return [
    { label: 'Add |', edit: { line: issue.line, col: issue.col, length: 0, text: '| ' } },
    { label: 'Remove this note', edit: removeToken(text, issue) },
  ];
  return [];
}

export function applyEdit(text: string, edit: TextEdit): string {
  const start = offsetOf(text, edit);
  return text.slice(0, start) + edit.text + text.slice(start + edit.length);
}
