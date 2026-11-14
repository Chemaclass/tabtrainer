import { describe, expect, it } from 'vitest';
import { PitchTracker, analysisSize, detectPitch, frequencyOf, midiOf, nearestNote, nearestString, noteName } from '../../src/core/pitch';

const RATE = 48000;
const SIZE = analysisSize(RATE);
const centsBetween = (a: number, b: number) => 1200 * Math.log2(a / b);

function tone(frequency: number, harmonics: number[] = [1], options: { rate?: number; size?: number; phase?: number; amplitude?: number } = {}) {
  const { rate = RATE, size = SIZE, phase = 0.3, amplitude = 0.5 } = options;
  const out = new Float32Array(size);
  harmonics.forEach((weight, h) => {
    for (let i = 0; i < size; i++) out[i] += amplitude * weight * Math.sin(2 * Math.PI * frequency * (h + 1) * (i / rate) + phase * (h + 1));
  });
  return out;
}

function noise(size = SIZE, seed = 7) {
  let state = seed;
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) { state = (state * 1664525 + 1013904223) % 4294967296; out[i] = (state / 4294967296 - 0.5) * 0.6; }
  return out;
}

const BASS_AND_GUITAR = [
  ['low B on a 5-string bass', 30.87],
  ['low E on bass', 41.2],
  ['A on bass', 55],
  ['low E on guitar', 82.41],
  ['high E on guitar', 329.63],
] as const;

describe('analysis window', () => {
  it('holds at least two periods of the lowest note at common sample rates', () => {
    for (const rate of [44100, 48000, 96000]) {
      const size = analysisSize(rate);
      expect(Math.log2(size) % 1).toBe(0);
      expect(size).toBeGreaterThanOrEqual((2 * rate) / 27);
    }
    expect(analysisSize(48000)).toBe(4096);
  });
});

describe('detecting a pitch', () => {
  it.each(BASS_AND_GUITAR)('finds %s (%f Hz) in a sine within a cent', (_, frequency) => {
    const reading = detectPitch(tone(frequency), RATE);
    expect(reading).not.toBeNull();
    expect(Math.abs(centsBetween(reading!.frequency, frequency))).toBeLessThan(1);
    expect(reading!.clarity).toBeGreaterThan(0.9);
  });

  it.each(BASS_AND_GUITAR)('finds %s (%f Hz) in a tone rich in harmonics', (_, frequency) => {
    const reading = detectPitch(tone(frequency, [1, 0.8, 0.6, 0.5, 0.35, 0.25, 0.15]), RATE);
    expect(Math.abs(centsBetween(reading!.frequency, frequency))).toBeLessThan(1);
  });

  it.each(BASS_AND_GUITAR)('finds %s (%f Hz) when the fundamental is weaker than its overtones', (_, frequency) => {
    const reading = detectPitch(tone(frequency, [0.35, 1, 0.7, 0.4]), RATE);
    expect(Math.abs(centsBetween(reading!.frequency, frequency))).toBeLessThan(1);
  });

  it.each([-10, 10])('measures %i cents off low E and high E within a cent', offset => {
    for (const base of [41.2, 82.41, 329.63]) {
      const frequency = base * 2 ** (offset / 1200);
      const reading = detectPitch(tone(frequency, [1, 0.5, 0.25]), RATE);
      expect(Math.abs(centsBetween(reading!.frequency, base) - offset)).toBeLessThan(1);
    }
  });

  it('works at 44.1 kHz with the matching window', () => {
    const rate = 44100, size = analysisSize(rate);
    const reading = detectPitch(tone(30.87, [1, 0.6], { rate, size }), rate);
    expect(Math.abs(centsBetween(reading!.frequency, 30.87))).toBeLessThan(1);
  });

  it('stays within a cent whatever the starting phase', () => {
    for (const phase of [0, 1, 2, 3, 4, 5]) {
      const reading = detectPitch(tone(55, [1, 0.5], { phase }), RATE);
      expect(Math.abs(centsBetween(reading!.frequency, 55))).toBeLessThan(1);
    }
  });

  it('reads a quiet note but ignores a DC offset', () => {
    const quiet = tone(110, [1], { amplitude: 0.02 }).map(v => v + 0.3);
    expect(Math.abs(centsBetween(detectPitch(quiet, RATE)!.frequency, 110))).toBeLessThan(1);
  });

  it('gives no reading for silence', () => {
    expect(detectPitch(new Float32Array(SIZE), RATE)).toBeNull();
    expect(detectPitch(new Float32Array(SIZE).fill(0.4), RATE)).toBeNull();
  });

  it('gives no reading for noise', () => {
    for (const seed of [1, 7, 42, 99]) expect(detectPitch(noise(SIZE, seed), RATE)).toBeNull();
  });

  it('gives no reading for a hum too quiet to be a note', () => {
    expect(detectPitch(tone(60, [1], { amplitude: 0.001 }), RATE)).toBeNull();
  });

  it('gives no reading when the window is too short for the range', () => {
    expect(detectPitch(tone(110, [1], { size: 64 }), RATE)).toBeNull();
  });
});

describe('notes and cents', () => {
  it('converts between frequency and MIDI notes', () => {
    expect(midiOf(440)).toBe(69);
    expect(frequencyOf(28)).toBeCloseTo(41.2, 1);
    expect(frequencyOf(23)).toBeCloseTo(30.87, 2);
    expect(noteName(28)).toBe('E1');
    expect(noteName(61)).toBe('C#4');
  });

  it('finds the nearest note and the cents from it', () => {
    expect(nearestNote(440)).toEqual({ midi: 69, name: 'A', octave: 4, cents: 0 });
    const flat = nearestNote(41.2 * 2 ** (-12 / 1200));
    expect(flat.name).toBe('E'); expect(flat.octave).toBe(1); expect(flat.cents).toBeCloseTo(-12 + 1200 * Math.log2(41.2 / frequencyOf(28)), 6);
    expect(nearestNote(43).name).toBe('F');
    expect(nearestNote(43).cents).toBeCloseTo(-26.1, 0);
  });

  it('honours another concert pitch', () => {
    expect(nearestNote(432, 432)).toMatchObject({ name: 'A', cents: 0 });
  });

  it('finds the nearest string in a tuning', () => {
    const bass = [43, 38, 33, 28];
    expect(nearestString(41.2, bass)).toMatchObject({ index: 3 });
    expect(nearestString(43, bass)!.cents).toBeCloseTo(74, 0);
    expect(nearestString(56, bass)).toMatchObject({ index: 2 });
    expect(nearestString(98, bass)).toMatchObject({ index: 0 });
    expect(nearestString(100, [])).toBeNull();
  });
});

describe('steadying readings', () => {
  it('reports the median and ignores a stray reading', () => {
    const tracker = new PitchTracker(5);
    [41, 41.2, 41.1, 41.3].forEach(f => tracker.push(f));
    expect(tracker.push(41.25)).toBeCloseTo(41.2, 6);
  });

  it('restarts when the note changes', () => {
    const tracker = new PitchTracker(5);
    [41, 41.2, 41.1].forEach(f => tracker.push(f));
    expect(tracker.push(55)).toBe(55);
  });

  it('holds through a short gap and clears after a run of silence', () => {
    const tracker = new PitchTracker(5, 3);
    tracker.push(55);
    expect(tracker.push(null)).toBe(55);
    expect(tracker.push(null)).toBe(55);
    expect(tracker.push(null)).toBeNull();
  });

  it('can be reset', () => {
    const tracker = new PitchTracker();
    tracker.push(55); tracker.reset();
    expect(tracker.current).toBeNull();
  });
});
