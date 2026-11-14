import { setPref } from '../../app/storage';
import { byId, one } from '../dom';
import { editorResize } from './editorResize';

export function editorPane(redraw: () => void) {
  const show = (on: boolean) => {
    one('.layout').classList.toggle('noedit', !on); byId('editBtn').classList.toggle('on', on); byId('editBtn').setAttribute('aria-pressed', String(on));
    setPref('editor', on); setTimeout(redraw, 50);
  };
  editorResize(byId('editorPane'), byId('editorResize'), redraw);
  byId('hideEditorBtn').onclick = () => { show(false); byId('editBtn').focus(); };
  byId('editBtn').onclick = () => show(one('.layout').classList.contains('noedit'));
  return { show };
}
