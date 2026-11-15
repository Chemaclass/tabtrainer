import type { IssueSpan, ParseIssue } from '../../core/parseIssue';

const SETTLE_MS = 300;
const nothing = () => undefined;

const LINE_BREAK_LENGTH = 1;

function lineStart(lines: readonly string[], line: number): number {
  const before = lines.slice(0, line - 1);
  return before.reduce((start, text) => start + text.length + LINE_BREAK_LENGTH, 0);
}

/** Selects the span, or its whole line when the span has no length. */
function selectSpan(source: HTMLTextAreaElement, { line, col, length: spanLength }: IssueSpan) {
  const lines = source.value.split('\n');
  const lineFrom = lineStart(lines, line);
  const [start, length] = spanLength ? [lineFrom + col - 1, spanLength] : [lineFrom, lines[line - 1]?.length ?? 0];
  source.focus();
  source.setSelectionRange(start, start + length);
  // Chrome keeps the old scroll position when the selection moves; wrapped lines make this approximate.
  const lineHeight = parseFloat(getComputedStyle(source).lineHeight) || 0;
  source.scrollTop = Math.max(0, (line - 1) * lineHeight - source.clientHeight / 3);
}

export const selectLine = (source: HTMLTextAreaElement, line: number) => selectSpan(source, { line, col: 1, length: 0 });

function issueItem(issue: ParseIssue, source: HTMLTextAreaElement): HTMLLIElement {
  const item = document.createElement('li');
  const button = document.createElement('button');
  item.className = issue.severity;
  button.type = 'button';
  button.className = 'issue-link';
  button.textContent = `Line ${issue.line}: ${issue.message}`;
  button.addEventListener('click', () => selectSpan(source, issue));
  item.append(button);
  return item;
}

/** Lists the issues, each one a button that selects its line in the source. */
export function showIssueList(list: HTMLElement, issues: readonly ParseIssue[], source: HTMLTextAreaElement) {
  list.replaceChildren(...issues.map(issue => issueItem(issue, source)));
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
