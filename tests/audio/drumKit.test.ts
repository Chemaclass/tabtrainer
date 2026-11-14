import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrumKit } from '../../src/audio/drumKit';
import { Synth } from '../../src/audio/synth';
import { DRUMS, type Drum } from '../../src/core/groove';
import { fakeAudio, type FakeSource } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const setup = () => {
  const audio = fakeAudio();
  const synth = new Synth(); synth.ensure();
  return { ...audio, synth, kit: new DrumKit(synth), out: synth.output };
};
const added = (sources: FakeSource[], play: () => void) => { const n = sources.length; play(); return sources.slice(n); };

describe('DrumKit', () => {
  it('generates one noise buffer and reuses it for every hit', () => {
    const { kit, out, buffers, sources } = setup();
    for (let i = 0; i < 20; i++) for (const drum of DRUMS) kit.play(drum, i * 0.5, 0.8, out);
    expect(buffers).toHaveLength(1);
    const noise = sources.filter(s => s.kind === 'noise');
    expect(noise.length).toBeGreaterThan(0);
    expect(noise.every(s => s.buffer === buffers[0] && s.loop)).toBe(true);
  });
  it('builds the kick from a falling sine body and a short noise click', () => {
    const { kit, out, sources } = setup();
    const kick = added(sources, () => kit.play('kick', 1, 1, out));
    const body = kick.find(s => s.kind === 'oscillator')!;
    expect(body.type).toBe('sine');
    const first = body.frequency.setValueAtTime.mock.calls[0][0] as number;
    const ramps = body.frequency.exponentialRampToValueAtTime.mock.calls.map(c => c[0] as number);
    expect(ramps.length).toBeGreaterThan(0);
    expect(ramps.every(f => f < first)).toBe(true);
    const click = kick.filter(s => s.kind === 'noise');
    expect(click).toHaveLength(1);
    expect(click[0].stop.mock.calls[0][0] - 1).toBeLessThan(0.05);
  });
  it('gives each drum its own voice', () => {
    const { kit, out, sources } = setup();
    const shape = (drum: Drum) => added(sources, () => kit.play(drum, 1, 1, out)).map(s => `${s.kind}:${s.type}`).sort().join(',');
    const kick = shape('kick'), snare = shape('snare'), rim = shape('rim'), hat = shape('hat'), ride = shape('ride');
    expect(snare).toContain('oscillator:triangle');
    expect(rim).toContain('oscillator:triangle');
    expect(hat).toBe('noise:');
    expect(ride).toContain('oscillator:square');
    expect(new Set([kick, snare, rim, hat, ride]).size).toBe(5);
  });
  it('keeps the rim click short and without the snare wires', () => {
    const { kit, out, sources, filters } = setup();
    const before = filters.length;
    const rim = added(sources, () => kit.play('rim', 1, 1, out));
    expect(Math.max(...rim.map(s => (s.stop.mock.calls[0][0] as number) - 1))).toBeLessThan(0.2);
    expect(filters.slice(before).map(f => f.type)).not.toContain('highpass');
  });
  it('lets an open hat ring longer than a closed hat and chokes it at the next closed hat', () => {
    const { kit, out, sources, gains } = setup();
    const length = (drum: 'hat' | 'openhat', when: number) => (added(sources, () => kit.play(drum, when, 1, out))[0].stop.mock.calls[0][0] as number) - when;
    expect(length('openhat', 0)).toBeGreaterThan(length('hat', 2) * 4);
    kit.play('openhat', 4, 1, out);
    const open = gains[gains.length - 1];
    kit.play('hat', 4.25, 1, out);
    expect(open.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 4.25, expect.any(Number));
  });
  it('plays a soft hit quieter than an accent and skips a silent one', () => {
    const { kit, out, gains, sources } = setup();
    const peak = (velocity: number) => { const n = gains.length; kit.play('snare', 1, velocity, out); return gains[n].gain.setValueAtTime.mock.calls[0][0] as number; };
    expect(peak(0.45)).toBeLessThan(peak(1) / 2);
    expect(added(sources, () => kit.play('kick', 1, 0, out))).toHaveLength(0);
  });
  it('moves a hit by its offset but cancels it by its grid time', () => {
    const { kit, out, sources, synth } = setup();
    const hit = added(sources, () => kit.play('snare', 2, 1, out, -0.004));
    expect(hit.every(s => Math.abs((s.start.mock.calls[0][0] as number) - 1.996) < 1e-9)).toBe(true);
    synth.cancelFuture('backing', 1.999);
    expect(hit.every(s => s.stop.mock.calls.length === 2)).toBe(true);
  });
  it('tracks every hit as backing sound so it can be cancelled', () => {
    const { kit, out, sources, synth } = setup();
    for (const drum of DRUMS) kit.play(drum, 1, 0.8, out);
    synth.cancel('backing');
    expect(sources.every(s => s.stop.mock.calls.length === 2)).toBe(true);
  });
});
