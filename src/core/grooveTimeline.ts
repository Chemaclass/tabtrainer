import { APPROACH, FILL_BEATS, HALF_STEP_BELOW, HOLD, REST, barLength, hasShortBeats, type Drum, type DrumKitName, type Groove, type GrooveGrid, type GroovePart, type KeysVoice } from './groove';
import { chordAt, degreeInterval, keyTonic, type BassDegree, type Chord } from './harmony';
import { HALF_STEP, OCTAVE, PERFECT_FIFTH, PERFECT_FOURTH, pitchClass, safeKey } from './theory';

export interface DrumHit { beat: number; bar: number; drum: Drum; velocity: number }
export interface PitchedHit { beat: number; bar: number; length: number; midi: number[]; velocity: number }
export interface GrooveBar { bar: number; start: number; length: number; chord: Chord }
export interface GrooveTimeline { bars: GrooveBar[]; drums: DrumHit[]; bass: PitchedHit[]; keys: PitchedHit[]; total: number; voice: KeysVoice; kit: DrumKitName }

const VELOCITY: Record<string, number> = { X: 1, x: 0.8, o: 0.45 };
const BASS_VELOCITY = 0.8;
export const BASS_RANGE = { low: 28, high: 55 } as const;
export const KEYS_RANGE = { low: 57, high: 68 } as const;
export const POWER_CHORD_RANGE = { low: 45, high: 68 } as const;
const EPSILON = 1e-9;
const QUARTER = 1;
const EIGHTH = 0.5;
const SIXTEENTH = 0.25;
const THIRTY_SECOND = 0.125;
const STRAIGHT = 0.5;
const TRIPLET_SHUFFLE = 66;
// A descending sixteenth note run over the last two beats of the progression
const FILL: readonly { drum: Drum; steps: string }[] = [
  { drum: 'snare', steps: 'Xx......' },
  { drum: 'hightom', steps: '..xx....' },
  { drum: 'midtom', steps: '....xx..' },
  { drum: 'lowtom', steps: '......XX' },
  { drum: 'kick', steps: 'X.....X.' },
];

// 66 is how drum machines name a triplet shuffle, so it lands on exactly two thirds
const swingRatio = (swing: number) => (swing === TRIPLET_SHUFFLE ? 2 / 3 : swing / 100);

const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const isBinary = (stepLength: number) => [QUARTER, EIGHTH, SIXTEENTH, THIRTY_SECOND].some(length => near(length, stepLength));

/** Moves an offset within its pair of steps so the first step takes ratio of the pair instead of half. */
function swung(offset: number, pair: number, ratio: number): number {
  const pairStart = Math.floor(offset / pair + EPSILON) * pair;
  const progress = (offset - pairStart) / pair;
  const inFirstHalf = progress <= 0.5;
  const swungProgress = inFirstHalf ? progress * 2 * ratio : ratio + (progress - 0.5) * 2 * (1 - ratio);
  return pairStart + pair * swungProgress;
}

interface MidiRange { low: number; high: number }

function octaveShift(notes: number[], { low, high }: MidiRange): number {
  let shift = 0;
  while (Math.max(...notes) + shift > high) shift -= OCTAVE;
  while (Math.min(...notes) + shift < low) shift += OCTAVE;
  return shift;
}

/** The lowest note at or above low with this pitch class. */
const noteFrom = (low: number, pc: number) => low + pitchClass(pc - low);

// A small cost for leaving the default octave, so it only breaks ties between equally smooth lines
const MOVED_OCTAVE_COST = 0.5;

const isPowerChord = (chord: Chord) => chord.intervals.length === 2 && chord.intervals[1] === PERFECT_FIFTH;

function powerChordVoicing(chord: Chord): number[] {
  const root = noteFrom(POWER_CHORD_RANGE.low, chord.root);
  return [root, root + PERFECT_FIFTH, root + OCTAVE];
}

function chordVoicing(chord: Chord): number[] {
  return chord.tones.map(pc => noteFrom(KEYS_RANGE.low, pc)).sort((a, b) => a - b);
}

const keysVoicing = (chord: Chord) => (isPowerChord(chord) ? powerChordVoicing(chord) : chordVoicing(chord));

const isRest = (step: string) => step === REST || step === HOLD;
const isApproach = (step: string) => step.startsWith(APPROACH);
const isNote = (note: number | null): note is number => note !== null;
const inBassRange = (midi: number) => midi >= BASS_RANGE.low && midi <= BASS_RANGE.high;

function closest(candidates: number[], target: number): number {
  return candidates.reduce((best, candidate) => (Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best));
}

interface BassBar { chord: Chord; steps: string[]; root: number; notes: (number | null)[]; moved: number }

/** The chord root placed from a fourth below the lowest tonic on the bass up to a tritone above it. */
function defaultBassRoot(chord: Chord, tonic: number): number {
  const tonicNote = noteFrom(BASS_RANGE.low, tonic);
  const aboveFourthBelow = pitchClass(chord.root - tonic + PERFECT_FOURTH);
  return tonicNote + aboveFourthBelow - PERFECT_FOURTH;
}

function chordNote(step: string, chord: Chord, root: number): number | null {
  if (isRest(step) || isApproach(step)) return null;
  return root + degreeInterval(chord, step as BassDegree);
}

// The bass range spans just over two octaves, so two octaves either way reach every root in it
const OCTAVES_AROUND = [-2, -1, 0, 1, 2];

function rootsInRange(root: number): number[] {
  return OCTAVES_AROUND.map(octaves => root + octaves * OCTAVE).filter(inBassRange);
}

function bassBarOptions(steps: string[], chord: Chord, tonic: number, walking: boolean): BassBar[] {
  const root = defaultBassRoot(chord, tonic);
  const notes = steps.map(step => chordNote(step, chord, root));
  const played = notes.filter(isNote);
  const inRange = played.length ? octaveShift(played, BASS_RANGE) : 0;
  const shifts = walking ? [inRange - OCTAVE, inRange, inRange + OCTAVE] : [inRange];
  const fitting = shifts.filter(shift => played.every(note => inBassRange(note + shift)));
  return fitting.map(shift => {
    const placed = notes.map(note => (isNote(note) ? note + shift : null));
    const firstNote = placed.find(isNote) ?? root + shift;
    const nearestRoot = closest(rootsInRange(root), firstNote);
    const moved = Math.abs(shift - inRange) / OCTAVE;
    return { chord, steps, root: nearestRoot, notes: placed, moved };
  });
}

function halfStepInto(root: number): number {
  const below = root - HALF_STEP;
  return inBassRange(below) ? below : root + HALF_STEP;
}

function approachNote(step: string, next: BassBar): number {
  const degree = step.slice(APPROACH.length);
  if (degree === HALF_STEP_BELOW) return halfStepInto(next.root);
  const above = next.root + pitchClass(degreeInterval(next.chord, degree as BassDegree));
  return closest([above - OCTAVE, above].filter(inBassRange), next.root);
}

const firstNote = (bar: BassBar) => bar.notes.find(isNote) ?? bar.root;
const lastNote = (bar: BassBar) => bar.notes.filter(isNote).at(-1) ?? bar.root;

function leapCost(from: BassBar, to: BassBar): number {
  const leap = firstNote(to) - lastNote(from);
  return leap * leap + MOVED_OCTAVE_COST * to.moved;
}

interface BassPath { bars: BassBar[]; cost: number }

function cheapestPathTo(paths: BassPath[], bar: BassBar): BassPath {
  const costs = paths.map(path => path.cost + leapCost(path.bars[path.bars.length - 1], bar));
  const best = costs.indexOf(Math.min(...costs));
  return { bars: [...paths[best].bars, bar], cost: costs[best] };
}

function closedLoopCost(path: BassPath): number {
  return path.cost + leapCost(path.bars[path.bars.length - 1], path.bars[0]);
}

function smoothestLine(options: BassBar[][]): BassBar[] {
  const loops = options[0].flatMap(start => {
    let paths: BassPath[] = [{ bars: [start], cost: 0 }];
    for (const choices of options.slice(1)) paths = choices.map(bar => cheapestPathTo(paths, bar));
    return paths;
  });
  const costs = loops.map(closedLoopCost);
  return loops[costs.indexOf(Math.min(...costs))].bars;
}

function placeBassBars(groove: Groove, grid: GrooveGrid, key: string, tonic: number): BassBar[] {
  // Only a walking line moves bars off their default octave, so grooves without approach steps keep their register
  const walking = grid.bars.some(steps => steps.some(isApproach));
  const options = groove.progression.map((_, index) => {
    const steps = grid.bars[index % grid.bars.length];
    return bassBarOptions(steps, chordAt(groove.progression, key, index), tonic, walking);
  });
  return smoothestLine(options);
}

function resolveApproaches(bar: BassBar, next: BassBar): (number | null)[] {
  return bar.steps.map((step, i) => (isApproach(step) ? approachNote(step, next) : bar.notes[i]));
}

function bassLine(groove: Groove, key: string, tonic: number): (number | null)[][] {
  const grid = groove.grids.find(g => g.part === 'bass');
  if (!grid) return [];
  const bars = placeBassBars(groove, grid, key, tonic);
  return bars.map((bar, index) => resolveApproaches(bar, bars[(index + 1) % bars.length]));
}

interface Placement { pair: number; ratio: number }

/** Swing moves the second eighth of each beat, or the second sixteenth when no grid plays eighths. */
function swingPair(groove: Groove): number {
  const bar = barLength(groove.time);
  const stepLengths = groove.grids.flatMap(grid => grid.bars.map(steps => bar / steps.length));
  const hasEighths = stepLengths.some(length => near(length, EIGHTH));
  const hasSixteenths = stepLengths.some(length => near(length, SIXTEENTH));
  return !hasEighths && hasSixteenths ? EIGHTH : QUARTER;
}

function swingPlacement(groove: Groove): Placement {
  return { pair: swingPair(groove), ratio: hasShortBeats(groove.time) ? STRAIGHT : swingRatio(groove.swing) };
}

function stepOffset(offset: number, stepLength: number, { pair, ratio }: Placement): number {
  return isBinary(stepLength) ? swung(offset, pair, ratio) : offset;
}

function fillHits(bar: GrooveBar, placement: Placement): DrumHit[] {
  const fillStart = bar.length - FILL_BEATS;
  const hits: DrumHit[] = [];
  for (const { drum, steps } of FILL) {
    const stepLength = FILL_BEATS / steps.length;
    [...steps].forEach((step, i) => {
      if (isRest(step)) return;
      const beat = bar.start + stepOffset(fillStart + i * stepLength, stepLength, placement);
      hits.push({ beat, bar: bar.bar, drum, velocity: VELOCITY[step] });
    });
  }
  return hits;
}

function withFill(drums: DrumHit[], bar: GrooveBar, placement: Placement): DrumHit[] {
  if (bar.length < FILL_BEATS) return drums;
  const fillStart = bar.start + bar.length - FILL_BEATS - EPSILON;
  const kept = drums.filter(hit => hit.bar !== bar.bar || hit.beat < fillStart);
  return [...kept, ...fillHits(bar, placement)];
}

const isDrumPart = (part: GroovePart): part is Drum => part !== 'bass' && part !== 'keys';

function holdEnd(steps: readonly string[], index: number): number {
  let end = index + 1;
  while (steps[end] === HOLD) end++;
  return end;
}

/** The beat a step starts on; the index after the last step is the end of the bar. */
function stepBeat(bar: GrooveBar, steps: readonly string[], index: number, placement: Placement): number {
  if (index >= steps.length) return bar.start + bar.length;
  const stepLength = bar.length / steps.length;
  return bar.start + stepOffset(index * stepLength, stepLength, placement);
}

interface BarNotes { bass: (number | null)[]; keys: number[] }

function addGridBar(timeline: GrooveTimeline, grid: GrooveGrid, bar: GrooveBar, notes: BarNotes, placement: Placement) {
  const steps = grid.bars[bar.bar % grid.bars.length];
  steps.forEach((step, index) => {
    if (isRest(step)) return;
    const beat = stepBeat(bar, steps, index, placement);
    if (isDrumPart(grid.part)) {
      timeline.drums.push({ beat, bar: bar.bar, drum: grid.part, velocity: VELOCITY[step] });
      return;
    }
    const length = stepBeat(bar, steps, holdEnd(steps, index), placement) - beat;
    const hit = { beat, bar: bar.bar, length };
    if (grid.part === 'bass') timeline.bass.push({ ...hit, midi: [notes.bass[index]!], velocity: BASS_VELOCITY });
    else timeline.keys.push({ ...hit, midi: [...notes.keys], velocity: VELOCITY[step] });
  });
}

export function buildGrooveTimeline(groove: Groove, key: string = groove.key): GrooveTimeline {
  key = safeKey(key);
  const tonic = keyTonic(key) ?? 0;
  const length = barLength(groove.time);
  const placement = swingPlacement(groove);
  const timeline: GrooveTimeline = { bars: [], drums: [], bass: [], keys: [], total: groove.progression.length * length, voice: groove.voice, kit: groove.kit };
  const bass = bassLine(groove, key, tonic);

  groove.progression.forEach((_, index) => {
    const bar: GrooveBar = { bar: index, start: index * length, length, chord: chordAt(groove.progression, key, index) };
    timeline.bars.push(bar);
    const notes: BarNotes = { bass: bass[index], keys: keysVoicing(bar.chord) };
    for (const grid of groove.grids) addGridBar(timeline, grid, bar, notes, placement);
  });

  const lastBar = timeline.bars.at(-1);
  if (groove.fill && lastBar) timeline.drums = withFill(timeline.drums, lastBar, placement);
  for (const hits of [timeline.drums, timeline.bass, timeline.keys]) hits.sort((a, b) => a.beat - b.beat);
  return timeline;
}
