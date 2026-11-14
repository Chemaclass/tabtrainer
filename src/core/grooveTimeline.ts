import { APPROACH, HALF_STEP_BELOW, type Drum, type Groove, type GrooveGrid, type KeysVoice } from './groove';
import { chordAt, degreeInterval, keyTonic, type BassDegree, type Chord } from './harmony';
import { pitchClass, safeKey } from './theory';

export interface DrumHit { beat: number; bar: number; drum: Drum; velocity: number }
export interface PitchedHit { beat: number; bar: number; length: number; midi: number[]; velocity: number }
export interface GrooveBar { bar: number; start: number; length: number; chord: Chord }
export interface GrooveTimeline { bars: GrooveBar[]; drums: DrumHit[]; bass: PitchedHit[]; keys: PitchedHit[]; total: number; voice: KeysVoice }

const VELOCITY: Record<string, number> = { X: 1, x: 0.8, o: 0.45 };
const BASS_VELOCITY = 0.8;
export const BASS_RANGE = { low: 28, high: 55 } as const;
export const KEYS_RANGE = { low: 57, high: 68 } as const;
export const POWER_CHORD_RANGE = { low: 45, high: 68 } as const;
const EPSILON = 1e-9;

// 66 is how drum machines name a triplet shuffle, so it lands on exactly two thirds
const swingRatio = (swing: number) => (swing === 66 ? 2 / 3 : swing / 100);

const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const isBinary = (stepLength: number) => [1, 0.5, 0.25, 0.125].some(l => near(l, stepLength));

function swung(offset: number, pair: number, ratio: number): number {
  const start = Math.floor(offset / pair + EPSILON) * pair;
  const f = (offset - start) / pair;
  return start + pair * (f <= 0.5 ? f * 2 * ratio : ratio + (f - 0.5) * 2 * (1 - ratio));
}

function octaveShift(notes: number[], { low, high }: { low: number; high: number }): number {
  let shift = 0;
  while (Math.max(...notes) + shift > high) shift -= 12;
  while (Math.min(...notes) + shift < low) shift += 12;
  return shift;
}

const OCTAVE = 12;
const PERFECT_FIFTH = 7;
const HALF_STEP = 1;
// A small cost for leaving the default octave, so it only breaks ties between equally smooth lines
const MOVED_OCTAVE_COST = 0.5;

const isPowerChord = (chord: Chord) => chord.intervals.length === 2 && chord.intervals[1] === PERFECT_FIFTH;

function powerChordVoicing(chord: Chord): number[] {
  const root = POWER_CHORD_RANGE.low + pitchClass(chord.root - POWER_CHORD_RANGE.low);
  return [root, root + PERFECT_FIFTH, root + OCTAVE];
}

function chordVoicing(chord: Chord): number[] {
  return chord.tones.map(pc => KEYS_RANGE.low + pitchClass(pc - KEYS_RANGE.low)).sort((a, b) => a - b);
}

const keysVoicing = (chord: Chord) => (isPowerChord(chord) ? powerChordVoicing(chord) : chordVoicing(chord));

const isRest = (step: string) => step === '.' || step === '-';
const isApproach = (step: string) => step.startsWith(APPROACH);
const isNote = (note: number | null): note is number => note !== null;
const inBassRange = (midi: number) => midi >= BASS_RANGE.low && midi <= BASS_RANGE.high;

function closest(candidates: number[], target: number): number {
  return candidates.reduce((best, candidate) => (Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best));
}

interface BassBar { chord: Chord; steps: string[]; root: number; notes: (number | null)[]; moved: number }

function defaultBassRoot(chord: Chord, tonic: number): number {
  const tonicNote = BASS_RANGE.low + pitchClass(tonic - BASS_RANGE.low);
  return tonicNote + pitchClass(chord.root - tonic + 5) - 5;
}

function chordNote(step: string, chord: Chord, root: number): number | null {
  if (isRest(step) || isApproach(step)) return null;
  return root + degreeInterval(chord, step as BassDegree);
}

function rootsInRange(root: number): number[] {
  return [-2, -1, 0, 1, 2].map(octaves => root + octaves * OCTAVE).filter(inBassRange);
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
    return { chord, steps, root: closest(rootsInRange(root), firstNote), notes: placed, moved: Math.abs(shift - inRange) / OCTAVE };
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

function swingPair(groove: Groove): number {
  const barLength = (groove.time[0] * 4) / groove.time[1];
  const lengths = groove.grids.flatMap(g => g.bars.map(steps => barLength / steps.length));
  return !lengths.some(l => near(l, 0.5)) && lengths.some(l => near(l, 0.25)) ? 0.5 : 1;
}

export function buildGrooveTimeline(groove: Groove, key: string = groove.key): GrooveTimeline {
  key = safeKey(key);
  const tonic = keyTonic(key) ?? 0;
  const barLength = (groove.time[0] * 4) / groove.time[1];
  const ratio = groove.time[1] >= 8 ? 0.5 : swingRatio(groove.swing);
  const pair = swingPair(groove);
  const timeline: GrooveTimeline = { bars: [], drums: [], bass: [], keys: [], total: groove.progression.length * barLength, voice: groove.voice };
  const bass = bassLine(groove, key, tonic);

  groove.progression.forEach((_, bar) => {
    const start = bar * barLength;
    const chord = chordAt(groove.progression, key, bar);
    const keys = keysVoicing(chord);
    timeline.bars.push({ bar, start, length: barLength, chord });

    for (const grid of groove.grids) {
      const steps = grid.bars[bar % grid.bars.length];
      const stepLength = barLength / steps.length;
      const at = (i: number) => start + (i >= steps.length ? barLength : isBinary(stepLength) ? swung(i * stepLength, pair, ratio) : i * stepLength);
      steps.forEach((step, i) => {
        if (isRest(step)) return;
        if (grid.part !== 'bass' && grid.part !== 'keys') {
          timeline.drums.push({ beat: at(i), bar, drum: grid.part, velocity: VELOCITY[step] });
          return;
        }
        let end = i + 1;
        while (steps[end] === '-') end++;
        const hit = { beat: at(i), bar, length: at(end) - at(i) };
        if (grid.part === 'bass') timeline.bass.push({ ...hit, midi: [bass[bar][i]!], velocity: BASS_VELOCITY });
        else timeline.keys.push({ ...hit, midi: [...keys], velocity: VELOCITY[step] });
      });
    }
  });

  for (const hits of [timeline.drums, timeline.bass, timeline.keys]) hits.sort((a, b) => a.beat - b.beat);
  return timeline;
}
