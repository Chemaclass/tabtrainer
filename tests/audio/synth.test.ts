import { afterEach, describe, expect, it, vi } from 'vitest';
import { Synth } from '../../src/audio/synth';
import { fakeAudio } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Synth', () => {
  it('creates one master gain however often it is started', () => {
    const { gains } = fakeAudio();
    const synth = new Synth();
    for (let i = 0; i < 10; i++) expect(synth.ensure()).toBe(true);
    expect(gains).toHaveLength(1);
    expect(gains[0].outputs).toHaveLength(1);
  });
  it('restores the master level after a silence', () => {
    const { gains } = fakeAudio();
    const synth = new Synth(); synth.ensure(); synth.silence();
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.03);
    synth.ensure();
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.8, 0, 0.005);
  });
  it('plays each chord tone as an electric piano voice on the backing kind', () => {
    const { sources, clock } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.keys(1, [57, 61, 64], 0.5, 0.4);
    expect(sources).toHaveLength(9);
    expect(sources.every(s => s.start.mock.calls[0][0] === 1)).toBe(true);
    synth.cancel('instrument');
    expect(sources.every(s => s.stop.mock.calls.length === 1)).toBe(true);
    clock.now = 0.5; synth.cancel('backing');
    expect(sources.every(s => s.stop.mock.calls.at(-1)![0] === 0.5)).toBe(true);
  });
  it('plays organ chords as drawbar partials on the backing kind', () => {
    const { sources } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.organ(1, [57, 61, 64], 0.5, 0.4);
    expect(sources.length).toBeGreaterThan(3);
    expect(sources.length % 3).toBe(0);
    expect(sources.every(s => s.type === 'sine' && s.start.mock.calls[0][0] === 1)).toBe(true);
    synth.cancel('backing');
    expect(sources.every(s => s.stop.mock.calls.length === 2)).toBe(true);
  });
  it('drives a chord through one wave shaper whose curve never passes full scale', () => {
    const { sources, shapers } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.drive(1, [52, 59, 64], 0.2, 0.5);
    synth.drive(2, [52, 59, 64], 0.2, 0.5);
    expect(shapers).toHaveLength(2);
    expect(shapers[0].curve).toBe(shapers[1].curve);
    const curve = shapers[0].curve!;
    expect(Math.max(...curve.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(curve[0]).toBeCloseTo(-1);
    expect(curve[curve.length - 1]).toBeCloseTo(1);
    expect(sources.filter(s => s.start.mock.calls[0][0] === 1).every(s => s.type === 'sawtooth')).toBe(true);
    expect(sources).toHaveLength(12);
  });
  it('cuts a palm-muted note short and starts it darker', () => {
    const { sources, filters, gains } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.voice(1, 52, 2, 0.28, undefined, 'instrument', { muted: true });
    synth.voice(3, 52, 2, 0.28);
    const [muted, open] = [filters[0], filters[1]] as unknown as { frequency: { setValueAtTime: { mock: { calls: number[][] } }; exponentialRampToValueAtTime: { mock: { calls: number[][] } } } }[];
    expect(sources[0].stop).toHaveBeenCalledWith(1 + 0.12 + 0.05);
    expect(sources[2].stop).toHaveBeenCalledWith(3 + 2 + 0.05);
    expect(gains[1].gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.0008, 1.12);
    expect(muted.frequency.setValueAtTime.mock.calls[0][0]).toBeLessThan(open.frequency.setValueAtTime.mock.calls[0][0]);
    expect(muted.frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.05);
  });
  it('fades a hammered note in and starts it dark, with no pick', () => {
    const { filters, gains } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.voice(1, 52, 1, 0.2, undefined, 'instrument', { legato: true });
    const lowPass = filters[0] as unknown as { frequency: { setValueAtTime: { mock: { calls: number[][] } }; exponentialRampToValueAtTime: { mock: { calls: number[][] } } } };
    expect(gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.2, 1.03);
    expect(lowPass.frequency.setValueAtTime.mock.calls[0][0]).toBe(lowPass.frequency.exponentialRampToValueAtTime.mock.calls[0][0]);
  });
  it('ends the glide of a palm-muted note while the note still sounds', () => {
    const { sources } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.voice(1, 55, 1, 0.2, undefined, 'instrument', { muted: true, pitch: [{ after: 0, cents: -200 }, { after: 0.3, cents: 0 }] });
    expect(sources[0].detune.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.06);
  });
  it('glides both oscillators of a voice through the pitch points', () => {
    const { sources } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.voice(1, 55, 1, 0.2, undefined, 'instrument', { pitch: [{ after: 0, cents: -200 }, { after: 0.1, cents: 0 }] });
    synth.voice(3, 55, 1, 0.2);
    expect(sources.slice(0, 2).map(s => s.type)).toEqual(['sawtooth', 'sine']);
    for (const source of sources.slice(0, 2)) {
      expect(source.detune.setValueAtTime).toHaveBeenCalledWith(-200, 1);
      expect(source.detune.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.1);
    }
    for (const source of sources.slice(2)) expect(source.detune.setValueAtTime).not.toHaveBeenCalled();
  });
  it('plays a dead note as one short falling sawtooth through a dark low pass', () => {
    const { sources, filters, gains } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.thud(1, 40, 0.2);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ type: 'sawtooth' });
    expect(sources[0].start).toHaveBeenCalledWith(1);
    expect(sources[0].stop).toHaveBeenCalledWith(1.05);
    expect(sources[0].detune.linearRampToValueAtTime).toHaveBeenCalledWith(-1200, 1.05);
    expect(filters).toEqual([expect.objectContaining({ type: 'lowpass', frequency: expect.objectContaining({ value: 900 }) })]);
    expect(gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.2, 1.003);
    synth.cancel('instrument', 1);
    expect(sources[0].stop).toHaveBeenCalledTimes(2);
  });
  it('cancels only backing sources that start after a given time', () => {
    const { sources } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.keys(1, [60], 0.2, 0.4); synth.keys(2, [60], 0.2, 0.4); synth.voice(2, 40, 0.2, 0.3);
    synth.cancelFuture('backing', 1.5);
    expect(sources.map(s => s.stop.mock.calls.length)).toEqual([1, 1, 1, 2, 2, 2, 1, 1]);
  });
});
