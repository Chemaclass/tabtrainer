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

/** The bends a note can take: as written after "^", in whole steps, and as labelled next to the arrow, with a shorter label for a crowded bar. */
export const BENDS: readonly { written: string; steps: number; label: string; short: string }[] = [
  { written: '1/4', steps: 0.25, label: '1/4', short: '¼' },
  { written: '1/2', steps: 0.5, label: '1/2', short: '½' },
  { written: '1', steps: 1, label: 'full', short: '1' },
  { written: '3/2', steps: 1.5, label: '1 1/2', short: '1½' },
  { written: '2', steps: 2, label: '2', short: '2' },
];

/** The bend a string still holds after this note: a bend with no release, kept by ties. */
export function heldBend(held: number | undefined, note: Note): number | undefined {
  if (note.bend) return note.release ? undefined : note.bend;
  return note.tie ? held : undefined;
}

/** A tie with a release lets down the bend its string holds. */
export const letsDown = (note: Note, held: number | undefined) => note.tie === true && note.release === true && held !== undefined;

/** The notes of a version that let a held bend down. */
export function bendsLetDown(bars: Bar[]): Set<Note> {
  const held = new Map<number, number>(), out = new Set<Note>();
  for (const { event } of eventsInOrder(bars)) {
    for (const note of event.notes) if (letsDown(note, held.get(note.string))) out.add(note);
    holdBends(held, event.notes);
  }
  return out;
}

/** After an event, the bends its strings still hold: a string the event does not play, such as in a rest, lets its bend go. */
export function holdBends(held: Map<number, number>, notes: readonly Note[]) {
  const played = new Map(notes.map(note => [note.string, note]));
  for (const string of [...held.keys()]) if (!played.has(string)) held.delete(string);
  for (const [string, note] of played) {
    const bend = heldBend(held.get(string), note);
    if (bend) held.set(string, bend); else held.delete(string);
  }
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
 * How a note moves its pitch: a slide glides from its source, with the bend the source still holds, or from two frets away when it has none;
 * a bend rises after any glide, and may come back down; a tie keeps the bend the string still holds, or lets it down with a release.
 */
export function pitchPlan(note: Note, source: Note | undefined, held: number | undefined, writtenBeats: number): PitchPoint[] | undefined {
  const points: PitchPoint[] = [];
  let start = 0;
  if (isSlide(note.approach)) {
    const fromNowhere = note.approach === 'slide-up' ? -Math.min(SLIDE_IN_FRETS, note.fret) : SLIDE_IN_FRETS;
    start = Math.min(GLIDE.most, writtenBeats * GLIDE.share);
    points.push({ at: 0, cents: source ? (source.fret - note.fret) * 100 + (held ?? 0) * CENTS_PER_STEP : fromNowhere * 100 }, { at: start, cents: 0 });
  }
  if (held && letsDown(note, held)) {
    const cents = held * CENTS_PER_STEP;
    return [{ at: 0, cents }, { at: writtenBeats * RELEASE.hold, cents }, { at: writtenBeats * RELEASE.down, cents: 0 }];
  }
  if (!note.bend) return points.length ? points : held && note.tie ? [{ at: 0, cents: held * CENTS_PER_STEP }] : undefined;
  const cents = note.bend * CENTS_PER_STEP, rest = writtenBeats - start;
  if (!points.length) points.push({ at: 0, cents: 0 });
  if (!note.release) return [...points, { at: start + Math.min(RISE.most, rest * RISE.share), cents }];
  return [...points, { at: start + rest * RELEASE.up, cents }, { at: start + rest * RELEASE.hold, cents }, { at: start + rest * RELEASE.down, cents: 0 }];
}
