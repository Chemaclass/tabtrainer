import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrumKit } from '../../src/audio/drumKit';
import { Synth } from '../../src/audio/synth';
import { DRUMS, type Drum } from '../../src/core/groove';
import { fakeAudio, type FakeGain, type FakeSource } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

type FakeFilter = ReturnType<typeof fakeAudio>['filters'][number] & { frequency: { value: number } };

const setup = () => {
  const audio = fakeAudio();
  const synth = new Synth(); synth.ensure();
  return { ...audio, synth, kit: new DrumKit(synth), out: synth.output };
};

function recorder(audio: ReturnType<typeof setup>) {
  return (play: () => void) => {
    const sources = audio.sources.length, gains = audio.gains.length, filters = audio.filters.length;
    play();
    return {
      sources: audio.sources.slice(sources),
      gains: audio.gains.slice(gains),
      filters: audio.filters.slice(filters) as FakeFilter[],
    };
  };
}

const stopAt = (s: FakeSource) => s.stop.mock.calls.at(-1)![0] as number;
const firstStop = (s: FakeSource) => s.stop.mock.calls[0][0] as number;
const peakOf = (g: FakeGain) => g.gain.exponentialRampToValueAtTime.mock.calls[0][0] as number;
const cutoffs = (filters: FakeFilter[], type: string) => filters.filter(f => f.type === type).map(f => f.frequency.value);

describe('DrumKit', () => {
  it('generates one noise buffer and reuses it for every hit', () => {
    const { kit, out, buffers, sources } = setup();
    for (let i = 0; i < 20; i++) for (const drum of DRUMS) kit.play(drum, i * 0.5, 0.8, out);
    expect(buffers).toHaveLength(1);
    const noise = sources.filter(s => s.kind === 'noise');
    expect(noise.length).toBeGreaterThan(0);
    expect(noise.every(s => s.buffer === buffers[0] && s.loop)).toBe(true);
  });
  it('builds the kick from a sine body that falls in pitch and a short noise click', () => {
    const audio = setup();
    const kick = recorder(audio)(() => audio.kit.play('kick', 1, 1, audio.out));
    const body = kick.sources.find(s => s.kind === 'oscillator')!;
    expect(body.type).toBe('sine');
    const [start] = body.frequency.setValueAtTime.mock.calls[0] as number[];
    const [end] = body.frequency.exponentialRampToValueAtTime.mock.calls[0] as number[];
    expect(end).toBeLessThan(start / 2);
    const click = kick.sources.filter(s => s.kind === 'noise');
    expect(click).toHaveLength(1);
    expect(firstStop(click[0]) - 1).toBeLessThan(0.05);
  });
  it('builds the snare from two tuned body modes and one noise source split into a short snap and a longer wire tail', () => {
    const audio = setup();
    const snare = recorder(audio)(() => audio.kit.play('snare', 1, 1, audio.out));
    const modes = snare.sources.filter(s => s.kind === 'oscillator');
    expect(modes.map(m => m.type)).toEqual(['triangle', 'triangle']);
    expect(modes[1].frequency.value / modes[0].frequency.value).toBeGreaterThan(1.5);
    expect(snare.sources.filter(s => s.kind === 'noise')).toHaveLength(1);
    expect(cutoffs(snare.filters, 'bandpass')).toHaveLength(2);
    const decays = snare.gains.map(g => g.gain.setTargetAtTime.mock.calls[0][2] as number);
    const [, snap, wires] = decays;
    expect(wires).toBeGreaterThan(snap * 3);
  });
  it('builds the hi-hat from six detuned square waves through a band pass and a high pass', () => {
    const audio = setup();
    const hat = recorder(audio)(() => audio.kit.play('hat', 1, 1, audio.out));
    expect(hat.sources).toHaveLength(6);
    expect(hat.sources.every(s => s.kind === 'oscillator' && s.type === 'square')).toBe(true);
    const lowest = hat.sources[0].frequency.value;
    expect(hat.sources.map(s => +((s.frequency.value / lowest) * 2).toFixed(2))).toEqual([2, 3, 4.16, 5.43, 6.79, 8.21]);
    expect(new Set(hat.sources.map(s => s.detune.value)).size).toBe(6);
    expect(hat.filters.map(f => f.type)).toEqual(['bandpass', 'highpass']);
  });
  it('gives each drum its own voice', () => {
    const audio = setup();
    const record = recorder(audio);
    const shape = (drum: Drum) => record(() => audio.kit.play(drum, 1, 1, audio.out)).sources.map(s => `${s.kind}:${s.type}:${Math.round(s.frequency.value)}`).sort().join(',');
    const shapes = DRUMS.filter(drum => !drum.endsWith('hat') || drum === 'hat').map(shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
  it('rings the closed, pedal, half open and open hi-hat for longer and longer', () => {
    const audio = setup();
    const record = recorder(audio);
    const length = (drum: Drum, when: number) => firstStop(record(() => audio.kit.play(drum, when, 1, audio.out)).sources[0]) - when;
    const [pedal, closed, half, open] = [length('pedalhat', 0), length('hat', 2), length('halfhat', 4), length('openhat', 6)];
    expect(pedal).toBeLessThan(closed);
    expect(half).toBeGreaterThan(closed * 2);
    expect(open).toBeGreaterThan(half * 2);
  });
  for (const choke of ['hat', 'pedalhat'] as const) {
    it(`chokes a ringing open hi-hat at the next ${choke}`, () => {
      const audio = setup();
      const open = recorder(audio)(() => audio.kit.play('openhat', 4, 1, audio.out));
      audio.kit.play(choke, 4.25, 1, audio.out);
      expect(open.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 4.25, expect.any(Number));
      expect(open.sources.every(s => stopAt(s) < 4.35)).toBe(true);
    });
  }
  it('cuts the ring of a drum short when the same drum is struck again, and leaves other drums ringing', () => {
    const audio = setup();
    const record = recorder(audio);
    const first = record(() => audio.kit.play('snare', 1, 1, audio.out));
    const kick = record(() => audio.kit.play('kick', 1.05, 1, audio.out));
    record(() => audio.kit.play('snare', 1.1, 1, audio.out));
    expect(first.sources.every(s => stopAt(s) < 1.25)).toBe(true);
    expect(first.gains.every(g => g.gain.setTargetAtTime.mock.calls.at(-1)![1] === 1.1)).toBe(true);
    expect(kick.sources.every(s => s.stop.mock.calls.length === 1)).toBe(true);
  });
  it('cuts the ride tail short when the ride or its bell is struck again', () => {
    const audio = setup();
    const record = recorder(audio);
    const first = record(() => audio.kit.play('ride', 1, 1, audio.out));
    const natural = stopAt(first.sources[0]);
    const bell = record(() => audio.kit.play('bell', 1.3, 1, audio.out));
    expect(natural).toBeGreaterThan(3);
    expect(first.sources.every(s => stopAt(s) < 1.7)).toBe(true);
    expect(bell.filters.find(f => f.type === 'bandpass')!.frequency.value).toBeLessThan(first.filters.find(f => f.type === 'bandpass')!.frequency.value);
  });
  it('plays a soft hit quieter and darker than an accent of the same drum, and skips a silent one', () => {
    const audio = setup();
    const record = recorder(audio);
    for (const drum of ['snare', 'hat', 'ride', 'kick'] as const) {
      const soft = record(() => audio.kit.play(drum, 1, 0.45, audio.out));
      const accent = record(() => audio.kit.play(drum, 1, 1, audio.out));
      expect(peakOf(soft.gains[0]), drum).toBeLessThan(peakOf(accent.gains[0]) / 2);
      expect(cutoffs(soft.filters, 'bandpass')[0], drum).toBeLessThan(cutoffs(accent.filters, 'bandpass')[0]);
    }
    expect(record(() => audio.kit.play('kick', 1, 0, audio.out)).sources).toHaveLength(0);
  });
  it('tunes the toms from high to low', () => {
    const audio = setup();
    const record = recorder(audio);
    const pitch = (drum: Drum) => record(() => audio.kit.play(drum, 1, 1, audio.out)).sources.find(s => s.kind === 'oscillator')!.frequency.value;
    expect(pitch('hightom')).toBeGreaterThan(pitch('midtom'));
    expect(pitch('midtom')).toBeGreaterThan(pitch('lowtom'));
  });
  it('sounds different with the jazz kit than with the rock kit', () => {
    const audio = setup();
    const record = recorder(audio);
    const sound = (drum: Drum, kit: 'rock' | 'jazz') => {
      const hit = record(() => audio.kit.play(drum, 1, 1, audio.out, 0, kit));
      return hit.sources.map(s => s.frequency.value).concat(hit.gains.map(g => g.gain.setTargetAtTime.mock.calls[0][2] as number));
    };
    for (const drum of ['kick', 'snare', 'hat', 'ride'] as const) expect(sound(drum, 'jazz'), drum).not.toEqual(sound(drum, 'rock'));
  });
  it('moves a hit by its offset but cancels it by its grid time', () => {
    const audio = setup();
    const hit = recorder(audio)(() => audio.kit.play('snare', 2, 1, audio.out, -0.004));
    expect(hit.sources.every(s => Math.abs((s.start.mock.calls[0][0] as number) - 1.996) < 1e-9)).toBe(true);
    audio.synth.cancelFuture('backing', 1.999);
    expect(hit.sources.every(s => s.stop.mock.calls.length === 2)).toBe(true);
  });
  it('tracks every hit as backing sound so it can be cancelled', () => {
    const { kit, out, sources, synth } = setup();
    DRUMS.forEach((drum, i) => kit.play(drum, 1 + i * 0.01, 0.8, out));
    synth.cancel('backing');
    expect(sources.every(s => s.stop.mock.calls.length >= 2)).toBe(true);
  });
});
