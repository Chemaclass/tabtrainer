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

/** The bends a note can take: as written after "^", in whole steps, and as labelled next to the arrow. */
export const BENDS: readonly { written: string; steps: number; label: string }[] = [
  { written: '1/4', steps: 0.25, label: '1/4' },
  { written: '1/2', steps: 0.5, label: '1/2' },
  { written: '1', steps: 1, label: 'full' },
  { written: '3/2', steps: 1.5, label: '1 1/2' },
  { written: '2', steps: 2, label: '2' },
];

/** The bend a string still holds after this note: a bend with no release, kept by ties. */
export function heldBend(held: number | undefined, note: Note): number | undefined {
  if (note.bend) return note.release ? undefined : note.bend;
  return note.tie ? held : undefined;
}

/** A pitch change against a note's fret, in cents, at a time in beats from the note's start. */
export interface PitchPoint { at: number; cents: number }

// In beats, so a slower speed slows a glide or a bend down. A glide takes a quarter of a beat and a bend half a beat, or half the note when it is shorter.
const GLIDE = { most: 0.25, share: 0.5 };
const RISE = { most: 0.5, share: 0.5 };
// A bend that comes back down reaches its pitch at a third of the note, holds to half, and is back at five sixths
const RELEASE = { up: 1 / 3, hold: 1 / 2, down: 5 / 6 };
export const SLIDE_IN_FRETS = 2;
const CENTS_PER_STEP = 200;

/**
 * How a note moves its pitch: a slide glides from its source, or from two frets away when it has none; a bend rises after any glide,
 * and may come back down; a tie keeps the bend the string still holds.
 */
export function pitchPlan(note: Note, source: Note | undefined, held: number | undefined, writtenBeats: number): PitchPoint[] | undefined {
  const points: PitchPoint[] = [];
  let start = 0;
  if (isSlide(note.approach)) {
    const fromNowhere = note.approach === 'slide-up' ? -Math.min(SLIDE_IN_FRETS, note.fret) : SLIDE_IN_FRETS;
    start = Math.min(GLIDE.most, writtenBeats * GLIDE.share);
    points.push({ at: 0, cents: (source ? source.fret - note.fret : fromNowhere) * 100 }, { at: start, cents: 0 });
  }
  if (!note.bend) return points.length ? points : held && note.tie ? [{ at: 0, cents: held * CENTS_PER_STEP }] : undefined;
  const cents = note.bend * CENTS_PER_STEP, rest = writtenBeats - start;
  if (!points.length) points.push({ at: 0, cents: 0 });
  if (!note.release) return [...points, { at: start + Math.min(RISE.most, rest * RISE.share), cents }];
  return [...points, { at: start + rest * RELEASE.up, cents }, { at: start + rest * RELEASE.hold, cents }, { at: start + rest * RELEASE.down, cents: 0 }];
}
