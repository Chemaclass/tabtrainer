import type { Backups } from '../../app/backup';
import type { DraftSession } from '../../app/draftSession';
import { closeOnChoice, closeOnOutside } from '../shell/disclosure';
import { byId, one } from '../dom';
import { downloadFile, downloadText } from './textFile';

type Announce = (message: string, failed?: boolean, offerDownload?: boolean) => void;

export function songFile(draftSession: DraftSession, backups: Backups, handlers: { onNew: () => void; onOpen: (text: string) => void; onSave: () => void; restored: () => void; shareLink: () => string | null; announce: Announce }) {
  const source = byId('src', HTMLTextAreaElement), input = byId('openFile', HTMLInputElement);
  const fileMenu = one('.file-menu', HTMLDetailsElement);
  const open = () => input.click();
  const download = () => downloadText(source.value);
  byId('openBtn').onclick = open;
  closeOnChoice(fileMenu); closeOnOutside(fileMenu);
  byId('newBtn').onclick = handlers.onNew;
  byId('saveBtn').onclick = handlers.onSave;
  byId('dlBtn').onclick = download;
  const backup = () => downloadFile(backups.text(), backups.fileName(Date.now()), 'application/json');
  byId('backupBtn').onclick = backup;
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    const generation = draftSession.beginNavigation(); input.value = '';
    try {
      const text = await file.text();
      const restored = backups.restore(text);
      if (restored === 'restored') { handlers.announce('Backup restored. Your saved songs and practice record are back.'); handlers.restored(); }
      else if (restored === 'songs-only') { handlers.announce('Restored your saved songs, but not the practice record.', true, false); handlers.restored(); }
      else if (restored === 'failed') handlers.announce('Could not restore that backup in this browser.', true, false);
      else if (draftSession.isCurrent(generation)) handlers.onOpen(text);
    } catch { handlers.announce('Could not open that file. Your current text is still here.', true); }
  };
  byId('shareBtn').onclick = async () => {
    const url = handlers.shareLink();
    if (url === null) return;
    try {
      if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      handlers.announce(`Link copied: ${url}`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) handlers.announce(`Could not copy the link: ${url}`, true, false);
    }
  };
  return { open, download, backup };
}
