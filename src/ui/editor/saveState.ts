import type { DraftSession } from '../../app/draftSession';
import type { Workspace } from '../../app/workspace';
import { bundledPath } from '../../app/songRef';
import { byId, one } from '../dom';

export function saveState(draftSession: DraftSession, workspace: Workspace, onDownload: () => void, onReturn: () => void) {
  const feedback = byId('saveFeedback'), recover = byId('recoverDownload');
  const hasChanges = () => draftSession.hasChanges();
  // The link opens the bundled song, so it would drop unsaved edits.
  function showShare() { byId('shareBtn').hidden = bundledPath(workspace.picked) === null || draftSession.hasChanges(); }
  function show() {
    byId('returnDraftBtn').hidden = workspace.screen !== 'library' || !hasChanges();
    one('.save-state').hidden = !hasChanges() && !feedback.textContent;
    showShare();
    byId('dirtyState').textContent = hasChanges() ? `Unsaved changes${draftSession.stored ? '' : ' (draft recovery unavailable)'}` : 'No unsaved changes';
  }
  function announce(message: string, failed = false, offerDownload = failed) {
    feedback.textContent = message;
    feedback.classList.toggle('bad', failed);
    recover.hidden = !offerDownload; show();
  }
  recover.onclick = onDownload;
  byId('returnDraftBtn').onclick = onReturn;
  return { show, showShare, announce };
}
