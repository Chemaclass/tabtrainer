import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_HUMANIZE, humanize, LoopEngine, type LoopState } from '../../src/audio/loopEngine';
import { Synth } from '../../src/audio/synth';
import { parseGroove } from '../../src/core/groove';
import { buildGrooveTimeline } from '../../src/core/grooveTimeline';
import { fakeAudio } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const blues = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8')).groove;
const inA = buildGrooveTimeline(blues, 'A');
const START = 0.08;
const close = (a: number, b: number, within = 1e-3) => Math.abs(a - b) < within;

function setup(timeline = inA, tempo = 80) {
  const audio = fakeAudio();
  const synth = new Synth();
  const kit = { play: vi.fn() };
  const keys = vi.spyOn(synth, 'keys');
  const cancelFuture = vi.spyOn(synth, 'cancelFuture');
  const engine = new LoopEngine({ synth, kit });
  const states: LoopState[] = [];
  engine.on(s => states.push(s));
  engine.setTimeline(timeline); engine.setTempo(tempo);
  const drumTimes = (from = 0) => kit.play.mock.calls.slice(from).map(c => c[1] as number);
  return { ...audio, synth, kit, keys, cancelFuture, engine, states, drumTimes };
}

describe('LoopEngine timing', () => {
  it('schedules every hit of three loops at start plus beat times seconds per beat', () => {
    const { engine, drumTimes, keys, advance } = setup();
    engine.play(); advance(START + 3 * 36 - 0.3);
    const spb = 0.75;
    const expected = [0, 1, 2].flatMap(loop => inA.drums.map(h => START + (loop * inA.total + h.beat) * spb));
    const got = drumTimes();
    expect(got).toHaveLength(expected.length);
    got.forEach((t, i) => expect(close(t, expected[i])).toBe(true));
    const expectedKeys = [0, 1, 2].flatMap(loop => inA.keys.map(h => START + (loop * inA.total + h.beat) * spb));
    expect(keys.mock.calls.map(c => c[0])).toHaveLength(expectedKeys.length);
    keys.mock.calls.forEach((c, i) => expect(close(c[0], expectedKeys[i])).toBe(true));
  });
  it('schedules no hit twice and skips none across the loop boundary', () => {
    const { engine, drumTimes, advance } = setup();
    engine.play(); advance(START + 36 + 1);
    const boundary = START + 36;
    const inWindow = (t: number) => t > boundary - 1.2 && t < boundary + 0.7;
    const near = drumTimes().filter(inWindow);
    const expected = [0, 1].flatMap(loop => inA.drums.map(h => START + (loop * inA.total + h.beat) * 0.75)).filter(inWindow);
    expect(expected.length).toBeGreaterThan(6);
    expect(near).toHaveLength(expected.length);
    near.forEach((t, i) => expect(close(t, expected[i], 1e-9)).toBe(true));
  });
  it('reports the beat and bar being heard', () => {
    const { engine, states, advance } = setup();
    engine.play(); advance(START + 5 * 0.75);
    expect(states.at(-1)).toMatchObject({ playing: true, bar: 1, loop: 0 });
    expect(states.at(-1)!.beat).toBeCloseTo(5, 1);
    advance(START + 36 + 0.75);
    expect(states.at(-1)).toMatchObject({ bar: 0, loop: 1 });
  });
});

describe('LoopEngine changes while playing', () => {
  it('applies a new tempo from the next bar line and keeps the bar position', () => {
    const { engine, kit, drumTimes, cancelFuture, states, advance } = setup();
    engine.play(); advance(5.95);
    const before = kit.play.mock.calls.length;
    engine.setTempo(120);
    const barLine = START + 8 * 0.75;
    expect(cancelFuture).toHaveBeenLastCalledWith('backing', barLine - 1e-6);
    advance(barLine + 1);
    expect(states.at(-1)!.beat).toBeCloseTo(10, 1);
    expect(states.at(-1)!.bar).toBe(2);
    advance(barLine + 4);
    const kept = drumTimes().slice(0, before).filter(t => t < barLine - 1e-6);
    const effective = [...kept, ...drumTimes(before)].filter(t => t < barLine + 4);
    const expected = inA.drums.filter(h => h.beat < 8).map(h => START + h.beat * 0.75)
      .concat(inA.drums.filter(h => h.beat >= 8 && h.beat < 16).map(h => barLine + (h.beat - 8) * 0.5));
    expect(effective).toHaveLength(expected.length);
    effective.forEach((t, i) => expect(close(t, expected[i])).toBe(true));
  });
  it('switches timeline from the next bar line without a restart', () => {
    const { engine, keys, advance, cancelFuture } = setup();
    engine.play(); advance(5);
    const before = keys.mock.calls.length;
    engine.setTimeline(buildGrooveTimeline(blues, 'C'));
    const barLine = START + 8 * 0.75;
    expect(cancelFuture).toHaveBeenLastCalledWith('backing', barLine - 1e-6);
    advance(barLine + 3);
    const calls = keys.mock.calls.slice(before);
    const inC = buildGrooveTimeline(blues, 'C');
    const chordAt = (when: number) => (when < barLine - 1e-6 ? inA : inC).keys.find(h => close(START + h.beat * 0.75, when, 1e-6))?.midi;
    expect(calls.some(([when]) => when < barLine)).toBe(true);
    expect(calls.some(([when]) => when > barLine)).toBe(true);
    calls.forEach(([when, midi]) => expect(midi).toEqual(chordAt(when)));
    expect(engine.playing).toBe(true);
  });
  it('rebuilds the loop when a change arrives before the first beat', () => {
    const { engine, drumTimes, advance, cancelFuture } = setup();
    engine.play(); engine.setTempo(120);
    expect(cancelFuture).toHaveBeenLastCalledWith('backing', 0);
    advance(START + 2);
    const expected = inA.drums.filter(h => START + h.beat * 0.5 < START + 2).map(h => START + h.beat * 0.5);
    const got = drumTimes().filter(t => t < START + 2);
    expect(got).toHaveLength(expected.length);
    got.forEach((t, i) => expect(close(t, expected[i])).toBe(true));
  });
});

describe('LoopEngine stop and parts', () => {
  it('stop silences backing sound and cancels future hits', () => {
    const audio = fakeAudio();
    const synth = new Synth();
    const engine = new LoopEngine({ synth });
    engine.setTimeline(inA); engine.setTempo(80);
    engine.play(); audio.advance(2);
    const made = audio.sources.length;
    expect(made).toBeGreaterThan(0);
    engine.stop();
    expect(audio.sources.every(s => (s.stop.mock.calls.at(-1)![0] as number) <= 2.1)).toBe(true);
    audio.advance(4);
    expect(audio.sources).toHaveLength(made);
    expect(engine.playing).toBe(false);
  });
  it('schedules further ahead as soon as the page is hidden', () => {
    const page = { hidden: false, onChange: () => {}, addEventListener(_: string, fn: () => void) { page.onChange = fn; }, removeEventListener: vi.fn() };
    vi.stubGlobal('document', page);
    const { engine, drumTimes, advance } = setup();
    engine.play(); advance(1);
    expect(Math.max(...drumTimes())).toBeLessThan(1.25);
    page.hidden = true; page.onChange();
    expect(Math.max(...drumTimes())).toBeGreaterThan(2);
    engine.stop();
    expect(page.removeEventListener).toHaveBeenCalledWith('visibilitychange', page.onChange);
  });
  it('ignores a timeline with no bars', () => {
    const { engine, kit, advance } = setup();
    engine.play(); advance(1);
    engine.setTimeline(buildGrooveTimeline(parseGroove('kick: x...\n').groove));
    expect(() => engine.setTempo(100)).not.toThrow();
    advance(3);
    expect(kit.play.mock.calls.length).toBeGreaterThan(3);
  });
  it('schedules no drum hit with the drums at zero and leaves keys playing', () => {
    const { engine, kit, keys, advance } = setup();
    engine.setPartGain('drums', 0);
    engine.play(); advance(10);
    expect(kit.play).not.toHaveBeenCalled();
    expect(keys).toHaveBeenCalled();
  });
});

describe('humanize', () => {
  it('repeats the same offsets for the same seed and stays within the limits', () => {
    const a = Array.from({ length: 500 }, (_, i) => humanize(DEFAULT_HUMANIZE, i % 3, i));
    const b = Array.from({ length: 500 }, (_, i) => humanize(DEFAULT_HUMANIZE, i % 3, i));
    expect(a).toEqual(b);
    expect(a.every(o => Math.abs(o.time) <= DEFAULT_HUMANIZE.time && Math.abs(o.velocity) <= DEFAULT_HUMANIZE.velocity)).toBe(true);
    expect(new Set(a.map(o => o.time)).size).toBeGreaterThan(400);
    expect(humanize({ ...DEFAULT_HUMANIZE, seed: 2 }, 0, 0)).not.toEqual(a[0]);
  });
  it('never moves the kick on beat one', () => {
    const { engine, kit, advance } = setup();
    engine.play(); advance(20);
    const offsets = kit.play.mock.calls.map(c => ({ drum: c[0], when: c[1] as number, offset: c[4] as number }));
    const downbeats = offsets.filter(o => o.drum === 'kick' && close(((o.when - START) / 0.75) % 4, 0, 1e-6));
    expect(downbeats.length).toBeGreaterThan(0);
    expect(downbeats.every(o => o.offset === 0)).toBe(true);
    expect(offsets.some(o => o.offset !== 0)).toBe(true);
  });
});
