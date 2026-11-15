import { savedSongs, setPref, type DraftSnapshot, type SavedTexts } from './storage';

export const titleOf = (text: string) => /^\s*title\s*:\s*(.+)$/im.exec(text)?.[1].trim() ?? 'Untitled';

export function withTitle(text: string, title: string): string {
  const line = /^([ \t]*title[ \t]*:[ \t]*).+$/im;
  if (!line.test(text)) return `title: ${title}\n${text}`;
  return text.replace(line, (_, label: string) => `${label}${title}`);
}

export function freeTitle(title: string, taken: (title: string) => boolean): string {
  let number = 2;
  while (taken(`${title} ${number}`)) number++;
  return `${title} ${number}`;
}

export type SaveChoice = 'replace' | 'keep-both' | 'cancel';
export interface SaveConflict { title: string; copyTitle: string }
type SaveResult = { status: 'saved'; title: string; text: string } | { status: 'cancelled' } | { status: 'failed' };

export class DraftSession {
  private baseline = '';
  private generation = 0;
  private pending: { action: () => void; cancel: (() => void) | null } | null = null;
  private asking = false;
  stored = true;

  constructor(private text: () => string, private store: SavedTexts = savedSongs) {}

  hasChanges() { return this.text() !== this.baseline; }
  accept(text = this.text()) { this.baseline = text; }
  recover(draft: DraftSnapshot) { this.baseline = draft.base; }
  persist(picked: string) {
    this.stored = setPref('draft', { text: this.text(), base: this.baseline, picked });
    setPref('last', this.text());
  }
  async save(choose: (conflict: SaveConflict) => SaveChoice | Promise<SaveChoice>): Promise<SaveResult> {
    if (this.asking) return { status: 'cancelled' };
    const text = this.text(), title = titleOf(text);
    if (!this.store.has(title)) return this.keep(title, text);
    const copyTitle = freeTitle(title, taken => this.store.has(taken));
    this.asking = true;
    try {
      const choice = await choose({ title, copyTitle });
      if (choice === 'replace') return this.keep(title, text);
      if (choice === 'keep-both') return this.keep(copyTitle, withTitle(text, copyTitle));
      return { status: 'cancelled' };
    } finally {
      this.asking = false;
    }
  }
  private keep(title: string, text: string): SaveResult {
    if (!this.store.save(title, text)) return { status: 'failed' };
    this.accept(text);
    return { status: 'saved', title, text };
  }
  beginNavigation() { return ++this.generation; }
  isCurrent(generation: number) { return generation === this.generation; }
  replace(action: () => void, cancel: (() => void) | null, ask: () => void) {
    this.beginNavigation();
    if (!this.hasChanges()) { action(); return; }
    const alreadyPending = this.pending !== null;
    this.pending = { action, cancel };
    if (!alreadyPending) ask();
  }
  async resolve(choice: string, save: () => Promise<boolean>, fallback: () => void) {
    const proceed = this.pending !== null && (choice === 'discard' || (choice === 'save' && await save()));
    const pending = this.pending; this.pending = null;
    if (pending && proceed) pending.action();
    else if (pending?.cancel) pending.cancel();
    else fallback();
  }
}
