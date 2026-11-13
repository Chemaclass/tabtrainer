import { library, saveSong, setPref, type DraftSnapshot } from './storage';

export const titleOf = (text: string) => /^\s*title\s*:\s*(.+)$/im.exec(text)?.[1].trim() ?? 'Untitled';
type SaveResult = { status: 'saved'; title: string } | { status: 'cancelled' | 'failed' };

export class DraftSession {
  private baseline = '';
  private generation = 0;
  private pending: { action: () => void; cancel: (() => void) | null } | null = null;
  stored = true;

  constructor(private text: () => string) {}

  hasChanges() { return this.text() !== this.baseline; }
  accept(text = this.text()) { this.baseline = text; }
  recover(draft: DraftSnapshot) { this.baseline = draft.base; }
  persist(picked: string) {
    this.stored = setPref('draft', { text: this.text(), base: this.baseline, picked });
    setPref('last', this.text());
  }
  save(confirm: (title: string) => boolean): SaveResult {
    const title = titleOf(this.text());
    if (library().some(song => song.title === title) && !confirm(title)) return { status: 'cancelled' };
    if (!saveSong(title, this.text())) return { status: 'failed' };
    this.accept();
    return { status: 'saved', title };
  }
  beginNavigation() { return ++this.generation; }
  isCurrent(generation: number) { return generation === this.generation; }
  replace(action: () => void, cancel: (() => void) | null, confirm: () => void) {
    this.beginNavigation();
    if (!this.hasChanges()) { action(); return; }
    const alreadyPending = this.pending !== null;
    this.pending = { action, cancel };
    if (!alreadyPending) confirm();
  }
  resolve(choice: string, save: () => boolean, fallback: () => void) {
    const pending = this.pending; this.pending = null;
    if (pending && (choice === 'discard' || (choice === 'save' && save()))) pending.action();
    else if (pending?.cancel) pending.cancel();
    else fallback();
  }
}
