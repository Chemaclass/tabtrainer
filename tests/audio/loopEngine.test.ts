import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_HUMANIZE, humanize, LoopEngine, type LoopState } from '../../src/audio/loopEngine';
import { Synth } from '../../src/audio/synth';
import { parseGroove } from '../../src/core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../../src/core/grooveTimeline';
import { countingAudio, fakeAudio, type FakeGain } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const blues = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8')).groove;
const inA = buildGrooveTimeline(blues, 'A');
const START = 0.08;
const close = (a: number, b: number, within = 1e-3) => Math.abs(a - b) < within;

function setup(timeline = inA, tempo = 80) {
  const audio = fakeAudio();
  const synth = new Synth();
  const kit = { play: vi.fn(), reset: vi.fn() };
  const keys = vi.spyOn(synth, 'keys');
  const bass = vi.spyOn(synth, 'voice');
  const cancelFuture = vi.spyOn(synth, 'cancelFuture');
  const engine = new LoopEngine({ synth, kit });
  const states: LoopState[] = [];
  engine.on(s => states.push(s));
  engine.setTimeline(timeline); engine.setTempo(tempo);
  const drumTimes = (from = 0) => kit.play.mock.calls.slice(from).map(c => c[1] as number);
  return { ...audio, synth, kit, keys, bass, cancelFuture, engine, states, drumTimes };
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

describe('LoopEngine count-in', () => {
  it('clicks one bar at the groove tempo and starts the loop on the next beat', () => {
    const { engine, synth, drumTimes, states, advance } = setup();
    const click = vi.spyOn(synth, 'click');
    engine.setCountIn(true); engine.setClickVolume(0.7);
    engine.play(); advance(1);
    expect(click.mock.calls.map(c => [c[0], c[1], c[2], c[3]])).toEqual([0, 1, 2, 3].map(i => [START + i * 0.75, i === 0, 'count-in', 0.7]));
    expect(drumTimes()).toHaveLength(0);
    expect(states.at(-1)).toMatchObject({ playing: true, countingIn: true, bar: null });
    advance(START + 4 * 0.75 + 0.1);
    expect(close(Math.min(...drumTimes()), START + 4 * 0.75, 1e-9)).toBe(true);
    expect(states.at(-1)).toMatchObject({ playing: true, countingIn: false, bar: 0 });
  });
  it('keeps the count-in in time with a tempo change and starts the loop after the last click', () => {
    const { engine, synth, drumTimes, advance } = setup();
    const click = vi.spyOn(synth, 'click');
    engine.setCountIn(true);
    engine.play(); advance(START + 0.75 + 0.1);
    engine.setTempo(120);
    advance(START + 1.5 + 2 * 0.5 + 0.1);
    const kept = click.mock.calls.slice(-2).map(c => c[0]);
    expect(click).toHaveBeenCalledTimes(6);
    expect(close(kept[0], START + 1.5, 1e-9) && close(kept[1], START + 1.5 + 0.5, 1e-9)).toBe(true);
    expect(close(Math.min(...drumTimes()), START + 1.5 + 2 * 0.5, 1e-9)).toBe(true);
  });
  it('cancels the count-in on stop', () => {
    const { engine, synth, drumTimes, advance } = setup();
    const cancel = vi.spyOn(synth, 'cancel');
    engine.setCountIn(true);
    engine.play(); advance(1);
    engine.stop();
    expect(cancel).toHaveBeenCalledWith('count-in');
    advance(5);
    expect(drumTimes()).toHaveLength(0);
  });
  it('starts at once with the count-in off', () => {
    const { engine, synth, drumTimes, advance } = setup();
    const click = vi.spyOn(synth, 'click');
    engine.play(); advance(0.3);
    expect(click).not.toHaveBeenCalled();
    expect(close(Math.min(...drumTimes()), START, 1e-9)).toBe(true);
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
  it('starts a part set to zero on a silent bus and keeps its hits scheduled, so it comes back at once', () => {
    const { engine, kit, keys, advance } = setup();
    engine.setPartGain('drums', 0);
    engine.play(); advance(10);
    const drumBus = kit.play.mock.calls[0][3] as { gain: { value: number } };
    expect(drumBus.gain.value).toBe(0);
    expect(keys).toHaveBeenCalled();
    expect((keys.mock.calls[0][4] as unknown as { gain: { value: number } }).gain.value).toBeGreaterThan(0);
  });
});

describe('LoopEngine bass and mixer', () => {
  it('plays each bass note of the timeline through the bass bus as backing sound', () => {
    const { engine, bass, advance, gains } = setup();
    engine.play(); advance(START + 36 - 0.3);
    expect(bass.mock.calls).toHaveLength(inA.bass.length);
    bass.mock.calls.forEach(([when, midi, dur, , out, kind], i) => {
      expect(close(when, START + inA.bass[i].beat * 0.75)).toBe(true);
      expect(midi).toBe(inA.bass[i].midi[0]);
      expect(close(dur, inA.bass[i].length * 0.75)).toBe(true);
      expect(kind).toBe('backing');
      expect(gains).toContain(out);
    });
    const buses = new Set(bass.mock.calls.map(c => c[4]));
    expect(buses.size).toBe(1);
  });
  it('mutes and unmutes only the bass bus at once, without dropping scheduled notes', () => {
    const { engine, bass, keys, kit, advance, clock } = setup();
    engine.play(); advance(4);
    const bus = bass.mock.calls[0][4] as unknown as { gain: { setTargetAtTime: ReturnType<typeof vi.fn> } };
    engine.setPartGain('bass', 0);
    expect(bus.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, clock.now, 0.01);
    expect(kit.play.mock.calls[0][3]).not.toBe(bus);
    expect(keys.mock.calls[0][4]).not.toBe(bus);
    const before = bass.mock.calls.length;
    advance(10);
    expect(bass.mock.calls.length).toBeGreaterThan(before);
    engine.setPartGain('bass', 0.5);
    expect(bus.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, clock.now, 0.01);
  });
});

describe('LoopEngine voices and limiter', () => {
  it('plays the keys part on the voice the groove names', () => {
    const metal = buildGrooveTimeline(parseGroove(readFileSync('src/grooves/07-metal-gallop.txt', 'utf8')).groove);
    const { engine, keys, synth, advance } = setup(metal, 170);
    const drive = vi.spyOn(synth, 'drive');
    engine.play(); advance(2);
    expect(keys).not.toHaveBeenCalled();
    expect(drive).toHaveBeenCalled();
    expect(drive.mock.calls[0][1]).toEqual(metal.keys[0].midi);
  });
  it('sends every part through one limiter before the master', () => {
    const { engine, synth, compressors, gains, kit, bass, keys, advance } = setup();
    engine.play(); advance(4);
    expect(compressors).toHaveLength(1);
    const [limiter] = compressors;
    expect(limiter.outputs).toEqual([synth.output]);
    expect(limiter.ratio.value).toBeGreaterThanOrEqual(12);
    expect(limiter.threshold.value).toBeLessThan(0);
    const out = gains.find(g => g.outputs.includes(limiter))!;
    for (const bus of [bass.mock.calls[0][4], keys.mock.calls[0][4]]) expect((bus as unknown as { outputs: unknown[] }).outputs).toEqual([out]);
    const drums = kit.play.mock.calls[0][3] as unknown as { outputs: unknown[] };
    expect(drums.outputs[0]).toBe(out);
  });
});

describe('LoopEngine drum room', () => {
  it('sends the drums alone through a room built from a generated impulse, mixed into the backing', () => {
    const { engine, convolvers, kit, bass, advance } = setup();
    engine.play(); advance(1);
    expect(convolvers).toHaveLength(1);
    const [room] = convolvers;
    expect(room.buffer).toBeTruthy();
    const drums = kit.play.mock.calls[0][3] as unknown as { outputs: unknown[] };
    expect(drums.outputs).toContain(room);
    expect((bass.mock.calls[0][4] as unknown as { outputs: unknown[] }).outputs).not.toContain(room);
    const wet = room.outputs[0] as FakeGain;
    expect(wet.outputs).toEqual([drums.outputs[0]]);
    expect(wet.gain.value).toBeGreaterThan(0);
    expect(wet.gain.value).toBeLessThan(0.5);
  });
  it('unplugs the drums from the room when it is off and plugs them back in', () => {
    const { engine, convolvers, kit, advance } = setup();
    engine.setRoom(false);
    engine.play(); advance(1);
    const drums = kit.play.mock.calls[0][3] as unknown as FakeGain;
    const [room] = convolvers;
    expect(drums.outputs).not.toContain(room);
    engine.setRoom(true);
    expect(drums.outputs).toContain(room);
    engine.setRoom(false);
    expect(drums.outputs).not.toContain(room);
  });
  it('forgets ringing drums on stop', () => {
    const { engine, kit, advance } = setup();
    engine.play(); advance(1);
    engine.stop();
    expect(kit.reset).toHaveBeenCalled();
  });
});

describe('LoopEngine drummer feel', () => {
  const groove = (header: string) => buildGrooveTimeline(parseGroove(`${header}\nprogression: I IV\nhat: xxxxxxxx\nsnare: ..x...x.\nkick: x...x...\n`).groove);
  const offsets = (header: string, drum: string) => {
    const { engine, kit, advance } = setup(groove(header), 120);
    engine.play(); advance(20);
    return kit.play.mock.calls.filter(c => c[0] === drum).map(c => c[4] as number);
  };
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

  it('passes the groove kit to the drums', () => {
    const { engine, kit, advance } = setup(groove('kit: jazz'), 120);
    engine.play(); advance(2);
    expect(kit.play.mock.calls.every(c => c[5] === 'jazz')).toBe(true);
  });
  it('keeps a funk or metal drummer tighter to the grid than a reggae or blues drummer, and a drum machine exact', () => {
    const snare = (kit: string) => spread(offsets(`kit: ${kit}`, 'snare'));
    expect(snare('funk')).toBeLessThan(snare('reggae'));
    expect(snare('metal')).toBeLessThan(snare('blues'));
    expect(offsets('kit: electronic', 'snare').every(o => o === 0)).toBe(true);
  });
  it('lays the reggae hats behind the beat', () => {
    const hats = offsets('kit: reggae', 'hat');
    expect(hats.reduce((sum, o) => sum + o, 0) / hats.length).toBeGreaterThan(0.008);
    const rock = offsets('kit: rock', 'hat');
    expect(Math.abs(rock.reduce((sum, o) => sum + o, 0) / rock.length)).toBeLessThan(0.003);
  });
});

describe('LoopEngine with the synthesized kit', () => {
  const funk = buildGrooveTimeline(parseGroove(readFileSync('src/grooves/04-funk-sixteenths.txt', 'utf8')).groove);

  function liveSoundsEachSecond(timeline: GrooveTimeline, minutes: number) {
    const audio = countingAudio();
    const engine = new LoopEngine({ synth: new Synth() });
    engine.setTimeline(timeline); engine.setTempo(220);
    engine.play();
    const live: number[] = [];
    for (let second = 1; second <= minutes * 60; second++) {
      audio.advance(second);
      live.push(audio.liveAt(second));
    }
    return { live, started: audio.started() };
  }

  it('plays the funk groove at 220 bpm for five minutes without growing the number of live sounds', () => {
    const { live, started } = liveSoundsEachSecond(funk, 5);
    expect(started).toBeGreaterThan(10000);
    expect(Math.max(...live.slice(-60))).toBeLessThanOrEqual(Math.max(...live.slice(0, 60)));
  });
  it('keeps the funk drums at 220 bpm under 40 live sources', () => {
    const { live } = liveSoundsEachSecond({ ...funk, bass: [], keys: [] }, 1);
    expect(Math.max(...live)).toBeLessThan(40);
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
