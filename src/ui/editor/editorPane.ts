import { setPref } from '../../app/storage';
import { byId, one } from '../dom';
import type { Song } from '../../core/model';
import type { ParseIssue } from '../../core/parser';
import { editorResize } from './editorResize';

export function editorPane(redraw: () => void) {
  const source = byId('src', HTMLTextAreaElement);
  let pending = 0;
  const jumpToLine = (line: number) => {
    const lines = source.value.split('\n'); let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    source.focus(); source.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
  };
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
    setText(text: string) { clearTimeout(pending); source.value = text; },
    focus: () => source.focus(),
    onEdit(immediately: () => void, settled: () => void) {
      source.addEventListener('input', () => { immediately(); clearTimeout(pending); pending = window.setTimeout(settled, 300); });
    },
    showIssues(issues: ParseIssue[], song: Song) {
      const list = byId('issues'); list.innerHTML = '';
      issues.forEach(i => {
        const li = document.createElement('li'); li.className = i.severity; li.textContent = `Line ${i.line}: ${i.message}`;
        li.onclick = () => jumpToLine(i.line); list.appendChild(li);
      });
      const errs = issues.filter(i => i.severity === 'error').length;
      const status = byId('status');
      status.textContent = errs ? `${errs} error${errs > 1 ? 's' : ''}` : `${song.bars.length} bar${song.bars.length === 1 ? '' : 's'} · ${song.meta.instrument.name}`;
      status.classList.toggle('bad', errs > 0); status.title = status.textContent ?? '';
    },
  };
}
