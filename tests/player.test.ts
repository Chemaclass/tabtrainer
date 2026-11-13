import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/audio/player';

const loaded = () => {
  const p = new Player();
  p.load({ notes: [], bars: [{ bar: 1, start: 0, length: 4 }, { bar: 2, start: 4, length: 4 }], total: 8 }, 90);
  return p;
};
describe('playback position', () => {
  it('selects a beat without starting audio', () => {
    const p = loaded(); const beats: (number | null)[] = [];
    p.on(s => beats.push(s.beat)); p.seek(4);
    expect(p.playing).toBe(false); expect(p.pausedAt).toBe(4); expect(beats).toEqual([4]);
  });
  it('bounds selected positions and rejects nonfinite input', () => {
    const p = loaded(); p.seek(-1); expect(p.pausedAt).toBe(0);
    p.seek(100); expect(p.pausedAt).toBe(4);
    p.seek(NaN); expect(p.pausedAt).toBe(4);
  });
  it('clears a selected position on Stop or loading another song', () => {
    const p = loaded(); p.seek(4); p.stop(); expect(p.pausedAt).toBeNull();
    p.seek(4); p.load({notes:[],bars:[],total:0},90); expect(p.pausedAt).toBeNull();
  });
});

describe('active passage boundaries', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('extends running playback when a partial range becomes the whole song', () => {
    vi.useFakeTimers();
    let now = 0;
    const gain = { gain: { value: 1, setTargetAtTime() {} }, connect() {} };
    class AudioContext {
      get currentTime() { return now; }
      resume() { return Promise.resolve(); }
      createGain() { return gain; }
    }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = loaded(); p.setRange([0, 4], false); p.play();
    now = 1; p.setRange(null, false);
    now = 3; vi.advanceTimersByTime(25);
    expect(p.playing).toBe(true);
    now = 6; vi.advanceTimersByTime(25);
    expect(p.playing).toBe(false);
  });
});
