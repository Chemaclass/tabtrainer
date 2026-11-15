import { setPref } from '../../app/storage';
import { byId, one } from '../dom';
import type { Song } from '../../core/model';
import type { ParseIssue } from '../../core/parser';
import { editorResize } from './editorResize';
import { selectLine, settledInput, showIssueList } from './sourceText';

export function editorPane(redraw: () => void) {
  const source = byId('src', HTMLTextAreaElement);
  let settling = { cancel() {} };
  const show = (on: boolean) => {
    one('.layout').classList.toggle('noedit', !on); byId('editBtn').classList.toggle('on', on); byId('editBtn').setAttribute('aria-pressed', String(on));
    setPref('editor', on); setTimeout(redraw, 50);
  };
  editorResize(byId('editorPane'), byId('editorResize'), redraw);
  byId('hideEditorBtn').onclick = () => { show(false); byId('editBtn').focus(); };
  byId('editBtn').onclick = () => show(one('.layout').classList.contains('noedit'));
  return {
    show,
    text: () => source.value,
    setText(text: string) { settling.cancel(); source.value = text; },
    focus: () => source.focus(),
    goToLine(line: number) { show(true); selectLine(source, line); },
    onEdit(immediately: () => void, settled: () => void) {
      settling = settledInput(source, settled, immediately);
    },
    showIssues(issues: ParseIssue[], song: Song) {
      showIssueList(byId('issues'), issues, source);
      const errs = issues.filter(i => i.severity === 'error').length;
      const status = byId('status');
      status.textContent = errs ? `${errs} error${errs > 1 ? 's' : ''}` : `${song.bars.length} bar${song.bars.length === 1 ? '' : 's'} · ${song.meta.instrument.name}`;
      status.classList.toggle('bad', errs > 0); status.title = status.textContent ?? '';
    },
  };
}
