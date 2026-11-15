import type { DraftSession } from '../../app/draftSession';
import { savedRef } from '../../app/songRef';
import type { Workspace } from '../../app/workspace';
import { askChoice, askSaveConflict } from '../shell/askDialog';
import type { saveState } from './saveState';

interface DraftFlowHandlers {
  saved: () => void;
  stayed: () => void;
  retitled: (text: string) => void;
}

export function draftFlow(draftSession: DraftSession, workspace: Workspace, saveView: ReturnType<typeof saveState>, on: DraftFlowHandlers) {
  function persist() {
    draftSession.persist(workspace.picked);
    saveView.show();
    if (!draftSession.stored && draftSession.hasChanges()) saveView.announce('Could not keep this draft in the browser. Download a copy.', true);
  }
  async function askToKeep() {
    const choice = await askChoice({
      title: 'Keep your changes?',
      message: 'Save this song in this browser before opening another, or discard your changes.',
      choices: [{ value: 'cancel', label: 'Cancel' }, { value: 'discard', label: 'Discard' }, { value: 'save', label: 'Save', main: true }],
      safe: 'cancel',
    });
    await draftSession.resolve(choice, save, on.stayed);
  }
  function replace(action: () => void, cancel: (() => void) | null = null) {
    draftSession.replace(action, cancel, () => { void askToKeep(); });
  }
  async function save(): Promise<boolean> {
    const result = await draftSession.save(conflict => askSaveConflict(conflict, 'your library'));
    if (result.status === 'cancelled') return false;
    if (result.status === 'failed') { saveView.announce('Could not save in this browser. Your text is still here. Download a copy.', true); return false; }
    const { title, text } = result;
    workspace.pick(savedRef(title), 'mine');
    if (draftSession.hasChanges()) on.retitled(text);
    persist(); on.saved();
    saveView.announce(`Saved "${title}" in this browser`); return true;
  }
  return { persist, replace, save };
}
