import { APPROACHES, type Approach, type Bar, type Note, type NoteEvent } from './model';

export const APPROACH_MARK: Record<Approach, string> = { hammer: 'h', pull: 'p' };

export const approachOf = (mark: string): Approach | undefined => APPROACHES.find(approach => APPROACH_MARK[approach] === mark);

/** The note a join starts from: on the same string in the event just before, and not dead. */
export const sourceOf = (before: NoteEvent | undefined, note: Pick<Note, 'string'>): Note | undefined =>
  before?.notes.find(n => n.string === note.string && !n.dead);

/** Every event of a version with the event played just before it, across bar lines. */
export function eventsInOrder(bars: Bar[]): { bar: Bar; event: NoteEvent; before?: NoteEvent }[] {
  const out: { bar: Bar; event: NoteEvent; before?: NoteEvent }[] = [];
  let before: NoteEvent | undefined;
  for (const bar of bars) for (const event of bar.events) { out.push({ bar, event, before }); before = event; }
  return out;
}
