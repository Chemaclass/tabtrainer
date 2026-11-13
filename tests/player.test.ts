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
    const gain = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect() {} };
    class AudioContext {
      get currentTime() { return now; }
      resume() { return Promise.resolve(); }
      createGain() { return gain; }
    }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = loaded(); p.setRange([0, 4], false); p.play();
    now = 1; p.setRange(null, true);
    expect(gain.gain.setTargetAtTime).not.toHaveBeenCalled();
    p.setRange(null, false);
    expect(gain.gain.setTargetAtTime).not.toHaveBeenCalled();
    now = 3; vi.advanceTimersByTime(25);
    expect(p.playing).toBe(true);
    now = 6; vi.advanceTimersByTime(25);
    expect(p.playing).toBe(false);
  });
});

describe('note selection', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const note = (beat: number, key: string, bar: number, string = 1) => ({ beat, key, bar, string, fret: 0, midi: 60, ring: 1 });
  const withNotes = () => {
    const p = loaded();
    p.notes = [note(1.5, '1500', 1), note(7 / 3, '2333', 1), note(7 / 3, '2333', 1, 2), note(7, '7000', 2)];
    return p;
  };
  it('selects a note late in the final bar without starting audio', () => {
    const p = withNotes();
    expect(p.seekNote('7000')).toBe(true);
    expect(p.pausedAt).toBe(7); expect(p.playing).toBe(false);
  });
  it('uses exact dotted and triplet beats and treats a chord as one onset', () => {
    const p = withNotes();
    expect(p.seekNote('1500')).toBe(true); expect(p.pausedAt).toBe(1.5);
    expect(p.seekNote('2333')).toBe(true); expect(p.pausedAt).toBe(7 / 3);
  });
  it('rejects stale keys and invalid timeline positions', () => {
    const p = withNotes(); p.seekNote('7000');
    expect(p.seekNote('missing')).toBe(false);
    p.notes.push(note(8, '8000', 2), note(1, 'badbar', 2), note(NaN, 'nan', 1));
    for (const key of ['8000', 'badbar', 'nan']) expect(p.seekNote(key)).toBe(false);
    expect(p.pausedAt).toBe(7);
  });
  it('starts playback at the selected exact onset', () => {
    vi.useFakeTimers();
    const gain = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect() {} };
    class AudioContext {
      currentTime = 0;
      resume() { return Promise.resolve(); }
      createGain() { return gain; }
    }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = withNotes(); const states: { playing: boolean; beat: number | null }[] = [];
    p.on(state => states.push(state)); p.seekNote('2333'); p.toggle();
    expect(states).toEqual([{ playing: false, beat: 7 / 3 }, { playing: true, beat: 7 / 3 }]);
    p.stop();
  });
  it('seeks and continues when already playing', () => {
    const p = withNotes();
    vi.spyOn(p, 'playing', 'get').mockReturnValue(true);
    const play = vi.spyOn(p, 'play').mockImplementation(() => {});
    expect(p.seekNote('2333')).toBe(true); expect(play).toHaveBeenCalledWith(7 / 3);
  });
});
