import { titleOf, type DraftSession } from '../../app/draftSession';
import { closeOnChoice, closeOnOutside } from '../shell/disclosure';
import { byId, one } from '../dom';

type Announce = (message: string, failed?: boolean, offerDownload?: boolean) => void;

export function songFile(draftSession: DraftSession, handlers: { onNew: () => void; onOpen: (text: string) => void; onSave: () => void; shareLink: () => string | null; announce: Announce }) {
  const source = byId('src', HTMLTextAreaElement), input = byId('openFile', HTMLInputElement);
  const fileMenu = one('.file-menu', HTMLDetailsElement);
  const open = () => input.click();
  const download = () => {
    const blob = new Blob([source.value], { type: 'text/plain' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = titleOf(source.value).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  byId('openBtn').onclick = open;
  closeOnChoice(fileMenu); closeOnOutside(fileMenu);
  byId('newBtn').onclick = handlers.onNew;
  byId('saveBtn').onclick = handlers.onSave;
  byId('dlBtn').onclick = download;
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    const generation = draftSession.beginNavigation(); input.value = '';
    try {
      const text = await file.text();
      if (draftSession.isCurrent(generation)) handlers.onOpen(text);
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
  return { open, download };
}
