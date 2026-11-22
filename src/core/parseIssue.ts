export type SongIssueCode =
  | 'level-unknown' | 'listen-address' | 'tempo-range' | 'tempo-late' | 'instrument-unknown' | 'tuning-unreadable' | 'time-signature'
  | 'note-unreadable' | 'string-missing' | 'fret-high' | 'string-twice' | 'tie-dead' | 'duration-unknown'
  | 'bar-short' | 'bar-long' | 'version-duplicate' | 'version-empty' | 'song-empty';

export type GrooveIssueCode =
  | 'line-unreadable' | 'line-unknown' | 'tempo-range' | 'key-unknown' | 'time-signature' | 'swing-range'
  | 'progression-duplicate' | 'progression-missing' | 'numeral-unknown' | 'voice-unknown' | 'kit-unknown' | 'fill-switch' | 'fill-short'
  | 'grid-duplicate' | 'grid-empty' | 'grid-long' | 'bar-empty' | 'bar-steps' | 'step-unknown' | 'hold-empty';

export type IssueCode = SongIssueCode | GrooveIssueCode;

/** Where a problem sits: a length of 0 means it has no token to point at. */
export interface IssueSpan { line: number; col: number; length: number }

export interface ParseIssue extends IssueSpan {
  code: IssueCode;
  message: string;
  /** The advice that ends the message, such as "e.g. [tempo=130]". */
  hint?: string;
  severity: 'error' | 'warning';
  /** On bar-short and bar-long: the beats the bar holds, and the beats its time signature needs. */
  beats?: number;
  expected?: number;
}

export const NO_TOKEN: IssueSpan = { line: 1, col: 1, length: 0 };

export const hinted = (problem: string, hint: string, joiner = ' ') => ({ message: `${problem}${joiner}${hint}`, hint });

export const spanOf = (token: { text: string; line: number; col: number }): IssueSpan => ({ line: token.line, col: token.col, length: token.text.length });

/** The value of a "key: value" line, or the key when the value is empty. */
export function valueSpan(text: string, line: number, value: string, firstCol = 1): IssueSpan {
  const colon = text.indexOf(':');
  const start = colon + 1 + (/^\s*/.exec(text.slice(colon + 1))?.[0].length ?? 0);
  if (value) return { line, col: firstCol + start, length: value.length };
  const key = text.search(/\S/);
  return { line, col: firstCol + key, length: colon + 1 - key };
}
