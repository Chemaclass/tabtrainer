import { byId } from '../dom';
import { dismissHelpOnBackdrop } from './helpDialogs';
import type { FeedbackLink } from '../../app/feedback';

export function feedbackDialog(links: () => FeedbackLink[], practising: () => boolean, showShortcuts: () => void) {
  const dialog = byId('feedback', HTMLDialogElement), list = byId('feedbackLinks');
  dismissHelpOnBackdrop(dialog);
  function open() {
    // The dialog returns focus to what had it, so leave the File menu closed with its summary focused.
    const menu = document.activeElement?.closest('details');
    if (menu instanceof HTMLDetailsElement) { menu.open = false; menu.querySelector('summary')?.focus(); }
    list.replaceChildren(...links().map(({ lead, action, url }) => {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = action;
      item.append(`${lead} `, link);
      return item;
    }));
    byId('feedbackShortcuts').hidden = !practising();
    dialog.showModal();
  }
  byId('helpBtn').onclick = byId('feedbackMenuBtn').onclick = byId('feedbackTipBtn').onclick = open;
  byId('feedbackShortcutsBtn').onclick = () => { dialog.close(); showShortcuts(); };
}
