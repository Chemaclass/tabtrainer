import type { ParseIssue } from '../../core/parseIssue';

const element = (className: string) => {
  const made = document.createElement('div');
  made.className = className;
  return made;
};

function lineCount(text: string): number {
  let count = 1;
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) count++;
  return count;
}

const severityOf = (issues: readonly ParseIssue[]) => issues.some(issue => issue.severity === 'error') ? 'error' : 'warning';

function underlined(text: string, issues: readonly ParseIssue[]): Node[] {
  const nodes: Node[] = [];
  let shown = 0;
  for (const issue of [...issues].filter(found => found.length).sort((a, b) => a.col - b.col)) {
    const start = issue.col - 1;
    if (start < shown) continue;
    const mark = document.createElement('span');
    mark.className = `squiggle ${issue.severity}`;
    mark.textContent = text.slice(start, start + issue.length);
    nodes.push(document.createTextNode(text.slice(shown, start)), mark);
    shown = start + issue.length;
  }
  return nodes;
}

/**
 * Wraps a textarea with line numbers and draws problem marks in a layer behind it.
 * Lines never wrap, so a source line is always one row of the gutter and of the marks.
 */
export function sourceGutter(source: HTMLTextAreaElement) {
  const frame = element('source-frame'), gutter = element('gutter'), numbers = element('gutter-lines');
  const body = element('source-body'), marks = element('source-marks'), gutterMarks = element('gutter-marks');
  gutter.setAttribute('aria-hidden', 'true'); marks.setAttribute('aria-hidden', 'true');
  source.setAttribute('wrap', 'off');
  source.before(frame);
  gutter.append(numbers, gutterMarks);
  body.append(marks, source);
  frame.append(gutter, body);

  let shownLines = 0;
  const showNumbers = () => {
    const count = lineCount(source.value);
    if (count === shownLines) return;
    shownLines = count;
    numbers.textContent = Array.from({ length: count }, (_, at) => at + 1).join('\n');
    frame.style.setProperty('--gutter-digits', String(String(count).length));
  };
  const follow = () => {
    frame.style.setProperty('--scroll-y', `${-source.scrollTop}px`);
    frame.style.setProperty('--scroll-x', `${-source.scrollLeft}px`);
  };
  source.addEventListener('input', showNumbers);
  source.addEventListener('scroll', follow, { passive: true });

  return {
    /** Call after the text is set from code: the input event does not fire then. */
    refresh() { showNumbers(); follow(); },
    show(issues: readonly ParseIssue[]) {
      const lines = source.value.split('\n');
      const byLine = new Map<number, ParseIssue[]>();
      for (const issue of issues) if (issue.line <= lines.length) byLine.set(issue.line, [...byLine.get(issue.line) ?? [], issue]);
      const rows = [...byLine].map(([line, found]) => {
        const row = element(`mark-line ${severityOf(found)}`), text = element('mark-text');
        row.style.setProperty('--line', String(line));
        text.append(...underlined(lines[line - 1], found));
        row.append(text);
        return row;
      });
      const numbered = [...byLine].map(([line, found]) => {
        const row = element(`gutter-mark ${severityOf(found)}`);
        row.style.setProperty('--line', String(line));
        row.textContent = String(line);
        return row;
      });
      marks.replaceChildren(...rows);
      gutterMarks.replaceChildren(...numbered);
      showNumbers();
    },
  };
}
