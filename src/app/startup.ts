import { findBySlug, normalizeSongReference } from './songLink';
import { bundledRef, isSavedRef } from './songRef';
import type { Songbook } from './songbook';
import type { DraftSnapshot } from './storage';

export interface StartupInput {
  search: string;
  historyPick: string | null;
  draft: DraftSnapshot | null;
  last: string | null;
  lastPick: string;
}
export type StartupPlan =
  | { kind: 'recover'; draft: DraftSnapshot; offer: string | null; followLink: boolean }
  | { kind: 'open'; ref: string }
  | { kind: 'last'; text: string; ref: string; base: string }
  | { kind: 'first' };

export function startupPlan(input: StartupInput, songbook: Pick<Songbook, 'paths' | 'text'>): StartupPlan {
  const resolve = (ref: string) => normalizeSongReference(ref, songbook.paths);
  const query = new URLSearchParams(input.search);
  const linked = findBySlug(songbook.paths, query.get('song') ?? '');
  const historyPick = input.historyPick === null ? null : resolve(input.historyPick);
  const savedReopened = query.get('view') === 'practice' && historyPick !== null && isSavedRef(historyPick) && songbook.text(historyPick) !== undefined;
  const requested = linked ? bundledRef(linked) : savedReopened ? historyPick : null;
  const draft = input.draft && { ...input.draft, picked: resolve(input.draft.picked) };
  // the only guard against losing unsaved edits on load
  if (draft && (draft.text !== draft.base || !requested || draft.picked === requested)) {
    const offer = requested && draft.picked !== requested ? requested : null;
    return { kind: 'recover', draft, offer, followLink: !offer && !!linked };
  }
  if (requested) return { kind: 'open', ref: requested };
  if (input.last) {
    const lastPick = resolve(input.lastPick), text = songbook.text(lastPick);
    return { kind: 'last', text: input.last, ref: text === undefined ? '' : lastPick, base: text ?? input.last };
  }
  return { kind: 'first' };
}
