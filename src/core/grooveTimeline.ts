import type { Drum, Groove } from './groove';
import { chordAt, degreeInterval, keyTonic, type BassDegree, type Chord } from './harmony';
import { pitchClass, safeKey } from './theory';

export interface DrumHit { beat: number; bar: number; drum: Drum; velocity: number }
export interface PitchedHit { beat: number; bar: number; length: number; midi: number[]; velocity: number }
export interface GrooveBar { bar: number; start: number; length: number; chord: Chord }
export interface GrooveTimeline { bars: GrooveBar[]; drums: DrumHit[]; bass: PitchedHit[]; keys: PitchedHit[]; total: number }

const VELOCITY: Record<string, number> = { X: 1, x: 0.8, o: 0.45 };
const BASS_VELOCITY = 0.8;
const E1 = 28;
const E3 = 52;
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

function swingPair(groove: Groove): number {
  const barLength = (groove.time[0] * 4) / groove.time[1];
  const lengths = groove.grids.flatMap(g => g.bars.map(steps => barLength / steps.length));
  return !lengths.some(l => near(l, 0.5)) && lengths.some(l => near(l, 0.25)) ? 0.5 : 1;
}

export function buildGrooveTimeline(groove: Groove, key: string = groove.key): GrooveTimeline {
  key = safeKey(key);
  const tonic = keyTonic(key) ?? 0;
  const tonicAbove = (floor: number) => floor + pitchClass(tonic - 4);
  const barLength = (groove.time[0] * 4) / groove.time[1];
  const ratio = groove.time[1] >= 8 ? 0.5 : swingRatio(groove.swing);
  const pair = swingPair(groove);
  const timeline: GrooveTimeline = { bars: [], drums: [], bass: [], keys: [], total: groove.progression.length * barLength };

  groove.progression.forEach((_, bar) => {
    const start = bar * barLength;
    const chord = chordAt(groove.progression, key, bar);
    const rootAbove = (floor: number) => tonicAbove(floor) + pitchClass(chord.root - tonic);
    timeline.bars.push({ bar, start, length: barLength, chord });

    for (const grid of groove.grids) {
      const steps = grid.bars[bar % grid.bars.length];
      const stepLength = barLength / steps.length;
      const at = (i: number) => start + (i >= steps.length ? barLength : isBinary(stepLength) ? swung(i * stepLength, pair, ratio) : i * stepLength);
      steps.forEach((step, i) => {
        if (step === '.' || step === '-') return;
        if (grid.part !== 'bass' && grid.part !== 'keys') {
          timeline.drums.push({ beat: at(i), bar, drum: grid.part, velocity: VELOCITY[step] });
          return;
        }
        let end = i + 1;
        while (steps[end] === '-') end++;
        const hit = { beat: at(i), bar, length: at(end) - at(i) };
        if (grid.part === 'bass') timeline.bass.push({ ...hit, midi: [rootAbove(E1) + degreeInterval(chord, step as BassDegree)], velocity: BASS_VELOCITY });
        else timeline.keys.push({ ...hit, midi: chord.intervals.map(n => rootAbove(E3) + n), velocity: VELOCITY[step] });
      });
    }
  });

  for (const hits of [timeline.drums, timeline.bass, timeline.keys]) hits.sort((a, b) => a.beat - b.beat);
  return timeline;
}
