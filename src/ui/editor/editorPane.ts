import { setPref } from '../../app/storage';
import { nextIssue, positionAt, type TextPosition } from '../../app/songProblems';
import { byId, one } from '../dom';
import type { Song } from '../../core/model';
import type { IssueSpan, ParseIssue } from '../../core/parseIssue';
import { editorResize } from './editorResize';
import { editorTabs } from './editorTabs';
import { sourceGutter } from './gutter';
import { selectLine, selectSpan, settledInput, songIssueList } from './sourceText';

const problemCount = (count: number) => `${count} problem${count === 1 ? '' : 's'}`;

export function editorPane(redraw: () => void) {
  const source = byId('src', HTMLTextAreaElement);
  const gutter = sourceGutter(source);
  const showIssueList = songIssueList(byId('issues'), source);
  const open = () => !one('.layout').classList.contains('noedit');
  const tabs = editorTabs(source, open, redraw);
  let settling = { cancel() {} };
  let issues: readonly ParseIssue[] = [];
  const show = (on: boolean) => {
    one('.layout').classList.toggle('noedit', !on); byId('editBtn').classList.toggle('on', on); byId('editBtn').setAttribute('aria-pressed', String(on));
    if (on) tabs.opened(); else tabs.closed();
    setPref('editor', on); setTimeout(redraw, 50);
  };
  editorResize(byId('editorPane'), byId('editorResize'), redraw);
  byId('hideEditorBtn').onclick = () => { show(false); byId('editBtn').focus(); };
  byId('editBtn').onclick = () => show(!open());
  byId('editorPane').addEventListener('keydown', event => {
    if (event.key !== 'F8' || !issues.length) return;
    event.preventDefault();
    const found = nextIssue(issues, positionAt(source.value, source.selectionStart), event.shiftKey);
    if (found) selectSpan(source, found);
  });
  return {
    show,
    open,
    text: () => source.value,
    setText(text: string) { settling.cancel(); source.value = text; tabs.reset(); gutter.refresh(); },
    focus: () => source.focus(),
    goToLine(line: number) { show(true); selectLine(source, line); },
    goTo(span: IssueSpan) { if (!tabs.scoreShown()) selectSpan(source, span); },
    onEdit(immediately: () => void, settled: () => void) {
      settling = settledInput(source, settled, immediately);
    },
    onCaret(moved: (at: TextPosition) => void) {
      const follow = () => moved(positionAt(source.value, source.selectionStart));
      ['keyup', 'pointerup', 'input', 'focus', 'select'].forEach(type => source.addEventListener(type, follow));
    },
    showIssues(found: ParseIssue[], song: Song) {
      issues = found;
      gutter.show(found);
      showIssueList(found);
      const errors = found.some(issue => issue.severity === 'error');
      const status = byId('status');
      status.textContent = found.length ? problemCount(found.length) : `${song.bars.length} bar${song.bars.length === 1 ? '' : 's'} · ${song.meta.instrument.name}`;
      status.classList.toggle('bad', errors); status.classList.toggle('warn', found.length > 0 && !errors); status.title = status.textContent ?? '';
      byId('nextProblemHint').hidden = !found.length;
      tabs.showProblems(found.length ? problemCount(found.length) : '', errors);
    },
    select(range: { start: number; end: number }) { source.focus(); source.setSelectionRange(range.start, range.end); source.scrollTop = 0; },
  };
}
