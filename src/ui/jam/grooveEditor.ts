import { DraftSession, titleOf } from '../../app/draftSession';
import { NEW_GROOVE_TEXT, playableGroove, type Jam } from '../../app/jam';
import { mineGrooveSlug, mineGrooveTitle } from '../../app/jamLink';
import { savedGrooves } from '../../app/storage';
import type { ParseIssue } from '../../core/parser';
import { byId } from '../dom';
import { downloadText } from '../editor/textFile';
import { settledInput, showIssueList } from '../editor/sourceText';

interface GrooveEditorHandlers {
  played: () => void;
  saved: (slug: string) => void;
  deleted: () => void;
}

function problemCount(count: number): string {
  if (count === 1) return '1 problem';
  return `${count} problems`;
}

function statusText(issues: readonly ParseIssue[]): string {
  if (!issues.length) return 'Plays as you type';
  return `${problemCount(issues.length)} · the last working version keeps playing`;
}

export function grooveEditor(jam: Jam, { played, saved, deleted }: GrooveEditorHandlers) {
  const pane = byId('grooveEditor');
  const source = byId('grooveSource', HTMLTextAreaElement);
  const status = byId('grooveStatus');
  const issues = byId('grooveIssues');
  const feedback = byId('grooveFeedback');
  const editButton = byId('grooveEdit', HTMLButtonElement);
  const deleteButton = byId('grooveDelete', HTMLButtonElement);
  const fileInput = byId('grooveOpenFile', HTMLInputElement);
  const draft = new DraftSession(() => source.value, savedGrooves);
  const settling = settledInput(source, check);
  let fromEntry = false;

  editButton.addEventListener('click', toggle);
  byId('grooveEditorHide').addEventListener('click', hide);
  byId('grooveNew').addEventListener('click', startNew);
  byId('grooveOpen').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', openChosenFile);
  byId('grooveSave').addEventListener('click', save);
  byId('grooveDownload').addEventListener('click', () => downloadText(source.value));
  deleteButton.addEventListener('click', remove);

  function isOpen(): boolean {
    return !pane.hidden;
  }

  function announce(message: string, failed = false) {
    feedback.textContent = message;
    feedback.classList.toggle('bad', failed);
  }

  function mayDiscard(): boolean {
    if (!isOpen() || !draft.hasChanges()) return true;
    return window.confirm(`Discard your changes to "${titleOf(source.value)}"?`);
  }

  function isSavedGrooveOpen(): boolean {
    return fromEntry && jam.entry.mine;
  }

  function showDelete() {
    deleteButton.hidden = !isSavedGrooveOpen();
  }

  function showStatus(text: string, bad: boolean) {
    // The status is a live region, so it changes only when its words do
    if (status.textContent === text) return;
    status.textContent = text;
    status.title = text;
    status.classList.toggle('bad', bad);
  }

  function showIssues(found: readonly ParseIssue[]) {
    showIssueList(issues, found, source);
    showStatus(statusText(found), found.length > 0);
  }

  function check() {
    const { playable, issues: found } = playableGroove(source.value);
    showIssues(found);
    if (!playable) return;
    jam.preview(playable);
    played();
  }

  function load(text: string, loadedFromEntry: boolean) {
    settling.cancel();
    source.value = text;
    fromEntry = loadedFromEntry;
    draft.accept(text);
    showDelete();
    check();
  }

  function open() {
    pane.hidden = false;
    editButton.setAttribute('aria-pressed', 'true');
    source.focus();
  }

  function close() {
    settling.cancel();
    pane.hidden = true;
    editButton.setAttribute('aria-pressed', 'false');
    announce('');
    stopPreview();
  }

  /** Keeps the setup played while the text was unchanged, and drops it with discarded changes. */
  function stopPreview() {
    const unchanged = fromEntry && !draft.hasChanges();
    if (unchanged) jam.keepDraftAs(jam.slug);
    else jam.endPreview();
    played();
  }

  function toggle() {
    if (isOpen()) {
      hide();
      return;
    }
    load(jam.entry.text, true);
    open();
  }

  function hide() {
    if (!mayDiscard()) return;
    close();
    editButton.focus();
  }

  function startWith(text: string) {
    if (!mayDiscard()) return;
    announce('');
    load(text, false);
    open();
  }

  function startNew() {
    startWith(NEW_GROOVE_TEXT);
  }

  async function openChosenFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      startWith(await file.text());
    } catch {
      announce('Could not open that file.', true);
    }
  }

  function isEditing(title: string): boolean {
    return isSavedGrooveOpen() && mineGrooveTitle(jam.slug) === title;
  }

  function mayReplace(title: string): boolean {
    if (isEditing(title)) return true;
    return window.confirm(`Replace "${title}" in your grooves?`);
  }

  function hasProblems(): boolean {
    return playableGroove(source.value).issues.length > 0;
  }

  function save() {
    if (hasProblems()) {
      announce('Fix the problems listed above before saving. Download keeps a copy as it is.', true);
      return;
    }
    const result = draft.save(mayReplace);
    if (result.status === 'cancelled') return;
    if (result.status === 'failed') {
      announce('Could not save in this browser. Download a copy to keep it.', true);
      return;
    }
    saved(mineGrooveSlug(result.title));
    announce(`Saved "${result.title}" in this browser`);
  }

  function remove() {
    const title = mineGrooveTitle(jam.slug);
    if (!window.confirm(`Delete "${title}" from this browser? This cannot be undone.`)) return;
    if (!savedGrooves.remove(title)) {
      announce('Could not delete it from this browser.', true);
      return;
    }
    deleted();
    source.focus();
    announce(`Deleted "${title}"`);
  }

  /** Shows the chosen groove's text after the player picks another groove while editing. */
  function follow() {
    if (isOpen()) load(jam.entry.text, true);
  }

  function mayChoose(slug: string): boolean {
    return slug === jam.slug || mayDiscard();
  }

  return { follow, mayChoose };
}
