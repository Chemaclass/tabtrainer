import type { DraftSession } from '../../app/draftSession';
import type { Workspace } from '../../app/workspace';
import { bundledPath } from '../../app/songRef';
import { shareLabel, type ShareState } from '../../app/songProposal';
import { pref, setPref } from '../../app/storage';
import { byId, one } from '../dom';

export interface SongSharing {
  state: () => ShareState;
  propose: () => void;
}

export function saveState(draftSession: DraftSession, workspace: Workspace, onDownload: () => void, onReturn: () => void, sharing: SongSharing) {
  const feedback = byId('saveFeedback'), recover = byId('recoverDownload');
  const shareStatus = byId('shareStatus'), notice = byId('shareNotice');
  const hasChanges = () => draftSession.hasChanges();
  function showBar() { one('.save-state').hidden = workspace.screen === 'jam' || (!hasChanges() && !feedback.textContent && notice.hidden); }
  // The link opens the bundled song, so it would drop unsaved edits.
  function showShare() {
    const bundled = bundledPath(workspace.picked) !== null;
    byId('shareBtn').hidden = !bundled || draftSession.hasChanges();
    byId('proposeBtn').hidden = bundled;
    byId('headProposeBtn').hidden = bundled;
    const state = bundled || workspace.screen !== 'practice' ? null : sharing.state();
    const shown = state?.longEnough ? state : null;
    shareStatus.hidden = !shown;
    shareStatus.textContent = shown ? shareLabel(shown) : '';
    shareStatus.classList.toggle('ready', !!shown?.ready);
    notice.hidden = !shown?.ready || pref('shareNoticeDismissed', false);
    showBar();
  }
  function show() {
    byId('returnDraftBtn').hidden = workspace.screen === 'practice' || !hasChanges();
    byId('dirtyState').textContent = hasChanges() ? `Unsaved changes${draftSession.stored ? '' : ' (draft recovery unavailable)'}` : 'No unsaved changes';
    showShare();
  }
  function announce(message: string, failed = false, offerDownload = failed) {
    feedback.textContent = message;
    feedback.classList.toggle('bad', failed);
    recover.hidden = !offerDownload; show();
  }
  recover.onclick = onDownload;
  byId('returnDraftBtn').onclick = onReturn;
  byId('headProposeBtn').onclick = sharing.propose;
  byId('shareNoticeBtn').onclick = sharing.propose;
  byId('shareNoticeClose').onclick = () => { setPref('shareNoticeDismissed', true); showShare(); byId('headProposeBtn').focus(); };
  return { show, showShare, announce };
}
