import type { DraftSession } from '../../app/draftSession';
import { savedRef } from '../../app/songRef';
import type { Workspace } from '../../app/workspace';
import { byId } from '../dom';
import type { saveState } from './saveState';

export function draftFlow(draftSession: DraftSession, workspace: Workspace, saveView: ReturnType<typeof saveState>, on: { saved: () => void; stayed: () => void }) {
  const dialog = byId('replaceDialog', HTMLDialogElement);
  function persist() {
    draftSession.persist(workspace.picked);
    saveView.show();
    if (!draftSession.stored && draftSession.hasChanges()) saveView.announce('Could not keep this draft in the browser. Download a copy.', true);
  }
  function replace(action: () => void, cancel: (() => void) | null = null) {
    draftSession.replace(action, cancel, () => { dialog.returnValue = 'cancel'; dialog.showModal(); });
  }
  function save(): boolean {
    const result = draftSession.save(title => window.confirm(`Replace "${title}" in your library?`));
    if (result.status === 'cancelled') return false;
    if (result.status === 'failed') { saveView.announce('Could not save in this browser. Your text is still here. Download a copy.', true); return false; }
    const { title } = result;
    workspace.pick(savedRef(title), 'mine'); persist(); on.saved();
    saveView.announce(`Saved "${title}" in this browser`); return true;
  }
  dialog.addEventListener('close', () => draftSession.resolve(dialog.returnValue, save, on.stayed));
  return { persist, replace, save };
}
