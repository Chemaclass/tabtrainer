import { guessGroup, proposeSong, type Proposal, type ProposalGroup } from '../../app/songProposal';
import type { Saved } from '../../app/storage';
import { dismissHelpOnBackdrop } from '../shell/helpDialogs';
import { setSelectValue } from '../shell/dropdown';
import { byId } from '../dom';
import { downloadText } from './textFile';

const COPIED = 'Song copied. Paste it into the empty box on GitHub.';
const COPY_FAILED = 'We could not copy the song. Download it, open the file and paste its text on GitHub.';

export function proposeSongDialog(paths: readonly string[], editorText: () => string, saved: () => Saved[]) {
  const dialog = byId('proposeDialog', HTMLDialogElement), link = byId('proposeLink', HTMLAnchorElement);
  const pick = byId('proposePick', HTMLSelectElement), rights = byId('proposeRights', HTMLInputElement);
  const status = byId('proposeStatus'), download = byId('proposeDownload');
  const groups = [...dialog.querySelectorAll<HTMLInputElement>('input[name=proposeGroup]')];
  let text = '', songs: Saved[] = [], proposal: Proposal | null = null;
  const chosenGroup = () => (groups.find(input => input.checked)?.value ?? 'exercises') as ProposalGroup;
  function chooseGroup(group: ProposalGroup) { for (const input of groups) input.checked = input.value === group; }
  function show() {
    proposal = proposeSong(text, chosenGroup(), paths);
    byId('proposeFile').textContent = `${proposal.folder}/${proposal.fileName || '...'}`;
    byId('proposeProblems').hidden = proposal.problems.length === 0;
    byId('proposeProblemList').replaceChildren(...proposal.problems.map(problem => { const item = document.createElement('li'); item.textContent = problem; return item; }));
    const ready = proposal.problems.length === 0 && rights.checked;
    if (ready) link.href = proposal.url; else link.removeAttribute('href');
    link.setAttribute('aria-disabled', String(!ready));
    byId('proposeLong').hidden = proposal.carriesText;
    status.textContent = ''; download.hidden = true;
  }
  function showSong(songText: string) {
    text = songText; chooseGroup(guessGroup(text)); show();
  }
  for (const input of groups) input.addEventListener('change', show);
  rights.addEventListener('change', show);
  pick.addEventListener('change', () => { rights.checked = false; showSong(songs[pick.selectedIndex]?.text ?? ''); });
  link.addEventListener('click', event => {
    if (!link.hasAttribute('href')) { event.preventDefault(); return; }
    if (!proposal || proposal.carriesText) return;
    const copyFailed = () => { status.textContent = COPY_FAILED; download.hidden = false; };
    try {
      navigator.clipboard.writeText(proposal.text).then(() => { status.textContent = COPIED; }, copyFailed);
    } catch { copyFailed(); }
  });
  download.onclick = () => { if (proposal) downloadText(proposal.text); };
  dismissHelpOnBackdrop(dialog);
  function open(songText?: string) {
    rights.checked = false;
    byId('proposePickRow').hidden = songText !== undefined;
    if (songText === undefined) {
      songs = saved();
      pick.replaceChildren(...songs.map(song => new Option(song.title)));
      setSelectValue(pick, songs[0]?.title ?? '');
    }
    showSong(songText ?? songs[0]?.text ?? '');
    dialog.showModal();
  }
  byId('proposeBtn').onclick = () => open(editorText());
  return { open };
}
