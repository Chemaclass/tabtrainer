import { APPROACHES, type Approach, type Bar, type Note, type NoteEvent } from './model';

export const APPROACH_MARK: Record<Approach, string> = { hammer: 'h', pull: 'p', 'slide-up': '/', 'slide-down': '\\' };
/** The approach that moves the other way, such as a pull-off for a hammer-on. */
export const OPPOSITE: Record<Approach, Approach> = { hammer: 'pull', pull: 'hammer', 'slide-up': 'slide-down', 'slide-down': 'slide-up' };
export const RISES: Record<Approach, boolean> = { hammer: true, pull: false, 'slide-up': true, 'slide-down': false };
export const isSlide = (approach: Approach | undefined) => approach === 'slide-up' || approach === 'slide-down';

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

/** A pitch change against a note's fret, in cents, at a time in beats from the note's start. */
export interface PitchPoint { at: number; cents: number }

// A glide takes a quarter of a beat, or half the note when it is shorter. In beats, so a slower speed slows it down.
const GLIDE = { most: 0.25, share: 0.5 };
const SLIDE_IN_FRETS = 2;

/** How a slide moves the pitch: from its source, or from two frets away when it has none, to the written fret. */
export function pitchPlan(note: Note, source: Note | undefined, writtenBeats: number): PitchPoint[] | undefined {
  if (!isSlide(note.approach)) return undefined;
  const fromNowhere = note.approach === 'slide-up' ? -Math.min(SLIDE_IN_FRETS, note.fret) : SLIDE_IN_FRETS;
  const frets = source ? source.fret - note.fret : fromNowhere;
  return [{ at: 0, cents: frets * 100 }, { at: Math.min(GLIDE.most, writtenBeats * GLIDE.share), cents: 0 }];
}
