import { guessGroup, proposeSong, type Proposal, type ProposalCheckResult, type ProposalGroup, type ProposalProblem } from '../../app/songProposal';
import type { Saved } from '../../app/storage';
import { dismissHelpOnBackdrop } from '../shell/helpDialogs';
import { setSelectValue } from '../shell/dropdown';
import { byId } from '../dom';
import { downloadText } from './textFile';

const COPIED = 'Song copied. Paste it into the empty box on GitHub.';
const COPY_FAILED = 'We could not copy the song. Download it, open the file and paste its text on GitHub.';
const TICK_REASON = 'Tick the box above.';

export interface ProposeActions {
  /** Shows the line in the editor; title names the saved song when the dialog was opened from the library. */
  goToLine(line: number, title: string | null): void;
}

function blockedReason(problems: number, ticked: boolean): string {
  if (problems === 0) return ticked ? '' : TICK_REASON;
  const fix = `Fix ${problems} ${problems === 1 ? 'problem' : 'problems'} in your song`;
  return ticked ? `${fix} first.` : `${fix}, then tick the box above.`;
}

export function proposeSongDialog(paths: readonly string[], editorText: () => string, saved: () => Saved[], actions: ProposeActions) {
  const dialog = byId('proposeDialog', HTMLDialogElement), link = byId('proposeLink', HTMLAnchorElement);
  const pick = byId('proposePick', HTMLSelectElement), rights = byId('proposeRights', HTMLInputElement);
  const status = byId('proposeStatus'), download = byId('proposeDownload');
  const form = byId('proposeForm'), sent = byId('proposeSent');
  const groups = [...dialog.querySelectorAll<HTMLInputElement>('input[name=proposeGroup]')];
  let text = '', songs: Saved[] = [], proposal: Proposal | null = null, picked: string | null = null;
  const chosenGroup = () => (groups.find(input => input.checked)?.value ?? 'exercises') as ProposalGroup;
  function chooseGroup(group: ProposalGroup) { for (const input of groups) input.checked = input.value === group; }
  function goTo(line: number) { dialog.close(); actions.goToLine(line, picked); }
  function problemItem(problem: ProposalProblem) {
    const item = document.createElement('li');
    item.append(problem.message);
    if (problem.line !== null) {
      const button = document.createElement('button'), line = problem.line;
      button.type = 'button'; button.className = 'propose-goto';
      button.textContent = `Go to line ${line}`;
      button.addEventListener('click', () => goTo(line));
      item.append(' ', button);
    }
    return item;
  }
  function checkItem({ label, problems }: ProposalCheckResult) {
    const item = document.createElement('li'), mark = document.createElement('span'), name = document.createElement('span');
    const done = problems.length === 0;
    item.className = done ? 'propose-check done' : 'propose-check todo';
    mark.className = 'propose-mark'; mark.textContent = done ? '✓' : '✕';
    mark.setAttribute('role', 'img'); mark.setAttribute('aria-label', done ? 'Done' : 'To fix');
    name.className = 'propose-check-name'; name.textContent = label;
    item.append(mark, name);
    if (!done) {
      const list = document.createElement('ul');
      list.className = 'propose-problems';
      list.append(...problems.map(problemItem));
      item.append(list);
    }
    return item;
  }
  function showForm(on: boolean) { form.hidden = !on; sent.hidden = on; }
  function show() {
    proposal = proposeSong(text, chosenGroup(), paths);
    byId('proposeName').textContent = proposal.title;
    byId('proposeFile').textContent = `${proposal.folder}/${proposal.fileName || '...'}`;
    byId('proposeChecks').replaceChildren(...proposal.checks.map(checkItem));
    const reason = blockedReason(proposal.problems.length, rights.checked);
    if (reason) link.removeAttribute('href'); else link.href = proposal.url;
    link.setAttribute('aria-disabled', String(reason !== ''));
    byId('proposeReason').textContent = reason;
    byId('proposeLong').hidden = proposal.carriesText;
    status.textContent = ''; download.hidden = true;
    showForm(true);
  }
  function showSong(songText: string) {
    text = songText; chooseGroup(guessGroup(text)); show();
  }
  for (const input of groups) input.addEventListener('change', show);
  rights.addEventListener('change', show);
  pick.addEventListener('change', () => {
    rights.checked = false; picked = songs[pick.selectedIndex]?.title ?? null;
    showSong(songs[pick.selectedIndex]?.text ?? '');
  });
  link.addEventListener('click', event => {
    if (!link.hasAttribute('href')) { event.preventDefault(); return; }
    showForm(false); byId('proposeBack').focus();
    if (!proposal || proposal.carriesText) return;
    const copyFailed = () => { status.textContent = COPY_FAILED; download.hidden = false; };
    try {
      navigator.clipboard.writeText(proposal.text).then(() => { status.textContent = COPIED; }, copyFailed);
    } catch { copyFailed(); }
  });
  download.onclick = () => { if (proposal) downloadText(proposal.text); };
  byId('proposeBack').onclick = () => { showForm(true); link.focus(); };
  dismissHelpOnBackdrop(dialog);
  function open(songText?: string, savedTitle?: string) {
    rights.checked = false;
    const fromLibrary = songText === undefined;
    byId('proposePickRow').hidden = !fromLibrary;
    byId('proposeName').hidden = fromLibrary;
    let chosen: Saved | undefined;
    if (fromLibrary) {
      songs = saved();
      chosen = songs.find(song => song.title === savedTitle) ?? songs[0];
      pick.replaceChildren(...songs.map(song => new Option(song.title)));
      setSelectValue(pick, chosen?.title ?? '');
    }
    picked = chosen?.title ?? null;
    showSong(songText ?? chosen?.text ?? '');
    dialog.showModal();
  }
  function firstToFix() {
    const checks = byId('proposeChecks');
    const todo = checks.querySelector<HTMLElement>('.propose-check.todo');
    if (todo) todo.tabIndex = -1;
    return checks.querySelector<HTMLElement>('.propose-goto') ?? todo;
  }
  const openWithEditorText = () => open(editorText());
  byId('proposeBtn').onclick = openWithEditorText;
  return {
    open: () => open(),
    openEditorSong: openWithEditorText,
    openSaved(title: string, onChecklist = false) {
      open(undefined, title);
      if (onChecklist) firstToFix()?.focus();
    },
  };
}
