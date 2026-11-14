import { fretboardPositions, type FretPosition } from './fretboard';
import { degreeInterval } from './harmony';
import { FLAT_FIFTH, HALF_STEP, OCTAVE, ROOT, SHARP_FIFTH, pitchClass } from './theory';

export type MoveId = 'root-fifth' | 'root-fifth-octave' | 'arpeggio' | 'root-fifth-below' | 'approach-below' | 'approach-above' | 'approach-scale';

type ChordMoveId = 'root-fifth' | 'root-fifth-octave' | 'arpeggio' | 'root-fifth-below';
type WalkId = Exclude<MoveId, ChordMoveId>;

export interface MoveChord { intervals: readonly number[] }

/** Where a walk goes: from the chord root to the next chord root, through the notes of the key. */
export interface Walk { from: number; to: number; scale: readonly number[] }

export interface MoveNote extends FretPosition { order: number }

const fifthOf = (chord: MoveChord) => degreeInterval(chord, '5');

export const hasFlatFifth = (chord: MoveChord) => fifthOf(chord) === FLAT_FIFTH;

export const hasSharpFifth = (chord: MoveChord) => fifthOf(chord) === SHARP_FIFTH;

/** Semitones above the root of each note, in playing order. */
const CHORD_MOVES: Record<ChordMoveId, (chord: MoveChord) => number[]> = {
  'root-fifth': chord => [ROOT, fifthOf(chord)],
  'root-fifth-octave': chord => [ROOT, fifthOf(chord), OCTAVE],
  arpeggio: chord => [...chord.intervals, OCTAVE],
  'root-fifth-below': chord => [ROOT, fifthOf(chord) - OCTAVE],
};

/** Semitones from the approach note to the next chord root it leads into. */
const WALK_APPROACHES: Record<WalkId, (walk: Walk) => number> = {
  'approach-below': () => -HALF_STEP,
  'approach-above': () => HALF_STEP,
  'approach-scale': scaleStepInto,
};

export const MOVE_IDS = [...Object.keys(CHORD_MOVES), ...Object.keys(WALK_APPROACHES)] as MoveId[];

export const isMoveId = (value: unknown): value is MoveId => MOVE_IDS.includes(value as MoveId);

export const isWalk = (id: MoveId): id is WalkId => id in WALK_APPROACHES;

/** The scale note next to the next root: above it, or below it when the note above is a half step away or is the current root. */
function scaleStepInto(walk: Walk): number {
  const others = walk.scale.filter(note => pitchClass(note) !== pitchClass(walk.to));
  const stepAbove = Math.min(...others.map(note => pitchClass(note - walk.to)));
  const stepBelow = Math.min(...others.map(note => pitchClass(walk.to - note)));
  const aboveIsCurrentRoot = pitchClass(walk.to + stepAbove) === pitchClass(walk.from);
  if (stepAbove === HALF_STEP || aboveIsCurrentRoot) return -stepBelow;
  return stepAbove;
}

function walkShape(target: number, approachOffset: number): number[] {
  const approach = target + approachOffset;
  if (approach === ROOT) return [ROOT, target];
  return [ROOT, approach, target];
}

/** The walk to the next root above and below, nearer one first. */
function walkShapes(walk: Walk, approachOffset: number): number[][] {
  const up = pitchClass(walk.to - walk.from);
  if (up === ROOT) return [];
  const down = up - OCTAVE;
  const targets = Math.abs(down) < Math.abs(up) ? [down, up] : [up, down];
  return targets.map(target => walkShape(target, approachOffset));
}

/** Semitones from the first note of the move to each note, in playing order; the first shape that fits wins. */
export function moveShapes(id: MoveId, chord: MoveChord, walk: Walk | null): number[][] {
  if (!isWalk(id)) return [CHORD_MOVES[id](chord)];
  if (!walk) return [];
  return walkShapes(walk, WALK_APPROACHES[id](walk));
}

interface Compactness { span: number; rootMidi: number; fretTravel: number; stringTravel: number }

/** Smaller wins, in this order: a narrower hand span, a lower root, less sliding, fewer string changes. */
const COMPACTNESS_ORDER: readonly (keyof Compactness)[] = ['span', 'rootMidi', 'fretTravel', 'stringTravel'];

function compactness(notes: readonly FretPosition[]): Compactness {
  const frets = notes.map(note => note.fret);
  let fretTravel = 0;
  let stringTravel = 0;
  for (let i = 1; i < notes.length; i++) {
    fretTravel += Math.abs(notes[i].fret - notes[i - 1].fret);
    stringTravel += Math.abs(notes[i].stringIndex - notes[i - 1].stringIndex);
  }
  return { span: Math.max(...frets) - Math.min(...frets), rootMidi: notes[0].midi, fretTravel, stringTravel };
}

function moreCompact(a: Compactness, b: Compactness): boolean {
  const deciding = COMPACTNESS_ORDER.find(key => a[key] !== b[key]);
  return deciding !== undefined && a[deciding] < b[deciding];
}

/** Every way to play the shape from each root, one position per note. */
function placements(shape: readonly number[], roots: readonly FretPosition[], positions: readonly FretPosition[]): FretPosition[][] {
  const found: FretPosition[][] = [];
  const extend = (notes: FretPosition[]) => {
    if (notes.length === shape.length) {
      found.push(notes);
      return;
    }
    const midi = notes[0].midi + shape[notes.length];
    for (const position of positions.filter(p => p.midi === midi)) extend([...notes, position]);
  };
  roots.forEach(root => extend([root]));
  return found;
}

function mostCompact(candidates: readonly FretPosition[][]): FretPosition[] {
  return candidates.reduce((best, candidate) => (moreCompact(compactness(candidate), compactness(best)) ? candidate : best));
}

const ALL_PITCH_CLASSES = Array.from({ length: OCTAVE }, (_, pc) => pc);

/** The most compact frets from firstFret to lastFret that play one of the shapes from a root of rootPitchClass, or null. */
export function placeMove(tuning: readonly number[], rootPitchClass: number, shapes: readonly number[][], firstFret: number, lastFret: number): MoveNote[] | null {
  const positions = fretboardPositions(tuning, ALL_PITCH_CLASSES, firstFret, lastFret);
  const roots = positions.filter(position => position.pitchClass === pitchClass(rootPitchClass));
  for (const shape of shapes) {
    const candidates = placements(shape, roots, positions);
    if (!candidates.length) continue;
    return mostCompact(candidates).map((position, index) => ({ ...position, order: index + 1 }));
  }
  return null;
}
