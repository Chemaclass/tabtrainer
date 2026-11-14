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
  it('cancels only backing sources that start after a given time', () => {
    const { sources } = fakeAudio();
    const synth = new Synth(); synth.ensure();
    synth.keys(1, [60], 0.2, 0.4); synth.keys(2, [60], 0.2, 0.4); synth.voice(2, 40, 0.2, 0.3);
    synth.cancelFuture('backing', 1.5);
    expect(sources.map(s => s.stop.mock.calls.length)).toEqual([1, 1, 1, 2, 2, 2, 1, 1]);
  });
});
