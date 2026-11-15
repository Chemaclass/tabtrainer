import type { IssueSpan, ParseIssue } from '../../core/parseIssue';
import { beatMeter, offsetOf, spanRange } from '../../app/songProblems';
import { songFixes, type SongFix } from '../../app/songFixes';
import { textSpan } from '../dom';

const SETTLE_MS = 300;
const nothing = () => undefined;

/** Selects the span, or its whole line when the span has no length. */
export function selectSpan(source: HTMLTextAreaElement, span: IssueSpan) {
  const { start, end } = spanRange(source.value, span);
  source.focus();
  source.setSelectionRange(start, end);
  // Chrome keeps the old scroll position when the selection moves. Lines never wrap, so a line is one row.
  const lineHeight = parseFloat(getComputedStyle(source).lineHeight) || 0;
  source.scrollTop = Math.max(0, (span.line - 1) * lineHeight - source.clientHeight / 3);
  const column = (span.col - 1) * characterWidth(source);
  source.scrollLeft = column < source.clientWidth * 0.6 ? 0 : column - source.clientWidth / 3;
}

function characterWidth(source: HTMLTextAreaElement): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = getComputedStyle(source).font;
  return context.measureText('0').width;
}

export const selectLine = (source: HTMLTextAreaElement, line: number) => selectSpan(source, { line, col: 1, length: 0 });

/** Replaces text the way typing would, so undo takes the fix back and the editor hears an input event. */
function applyFix(source: HTMLTextAreaElement, { edit }: SongFix, madeFrom: string) {
  // The fix points into the text it was made from; after more typing it waits for the next parse.
  if (source.value !== madeFrom) return;
  const start = offsetOf(source.value, edit);
  source.focus();
  source.setSelectionRange(start, start + edit.length);
  // execCommand keeps the browser's undo history; setRangeText is the fallback where it is gone.
  if (!document.execCommand(edit.text ? 'insertText' : 'delete', false, edit.text)) {
    source.setRangeText(edit.text, start, start + edit.length, 'end');
    source.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function meterOf(issue: ParseIssue): HTMLElement | null {
  const meter = beatMeter(issue);
  if (!meter) return null;
  const row = document.createElement('span'), segments = document.createElement('span');
  row.className = 'beat-meter';
  segments.className = 'beat-segments';
  segments.setAttribute('aria-hidden', 'true');
  segments.append(...meter.segments.map(segment => textSpan(segment, '')));
  row.append(textSpan('beat-summary', meter.summary), segments);
  return row;
}

function issueItem(issue: ParseIssue, source: HTMLTextAreaElement, fixes: readonly SongFix[], madeFrom: () => string = () => source.value): HTMLLIElement {
  const item = document.createElement('li');
  const body = document.createElement('div');
  const button = document.createElement('button');
  item.className = issue.severity;
  body.className = 'issue-body';
  button.type = 'button';
  button.className = 'issue-link';
  button.textContent = `Line ${issue.line}: ${issue.message}`;
  button.addEventListener('click', () => selectSpan(source, issue));
  body.append(button);
  const meter = meterOf(issue);
  if (meter) body.append(meter);
  item.append(body);
  if (!fixes.length) return item;
  const actions = document.createElement('div');
  actions.className = 'issue-fixes';
  body.append(actions);
  for (const fix of fixes) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'issue-fix';
    action.textContent = fix.label;
    action.setAttribute('aria-label', `${fix.label} on line ${issue.line}`);
    action.addEventListener('click', () => applyFix(source, fix, madeFrom()));
    actions.append(action);
  }
  return item;
}

/** Lists the issues, each one a button that selects its span in the source. */
export function showIssueList(list: HTMLElement, issues: readonly ParseIssue[], source: HTMLTextAreaElement) {
  list.replaceChildren(...issues.map(issue => issueItem(issue, source, [])));
}

/** Lists a song's issues with their quick fixes, and leaves the list alone when nothing changed so screen readers hear only news. */
export function songIssueList(list: HTMLElement, source: HTMLTextAreaElement) {
  let shown = '', parsedText = '';
  const madeFrom = () => parsedText;
  return (issues: readonly ParseIssue[]) => {
    parsedText = source.value;
    const fixes = issues.map(issue => songFixes(parsedText, issue));
    const key = JSON.stringify([issues, fixes]);
    if (key === shown) return;
    shown = key;
    list.replaceChildren(...issues.map((issue, at) => issueItem(issue, source, fixes[at], madeFrom)));
  };
}

/** Runs settled once typing pauses, and immediately on every keystroke. */
export function settledInput(source: HTMLTextAreaElement, settled: () => void, immediately: () => void = nothing) {
  let pending = 0;
  source.addEventListener('input', () => {
    immediately();
    clearTimeout(pending);
    pending = window.setTimeout(settled, SETTLE_MS);
  });
  return { cancel: () => clearTimeout(pending) };
}
