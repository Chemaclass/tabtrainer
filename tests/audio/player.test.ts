import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../src/audio/player';

const loaded = () => {
  const p = new Player();
  p.load({ notes: [], bars: [{ bar: 1, start: 0, length: 4, beats: 4, beatValue: 4 }, { bar: 2, start: 4, length: 4, beats: 4, beatValue: 4 }], total: 8 }, 90);
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
    p.on(({ playing, beat }) => states.push({ playing, beat })); p.seekNote('2333'); p.toggle();
    expect(states).toEqual([{ playing: false, beat: 7 / 3 }, { playing: true, beat: 7 / 3 }]);
    p.stop();
  });
  it('seeks and continues when already playing', () => {
    vi.useFakeTimers();
    const gain = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect() {} };
    class AudioContext { currentTime = 0; resume() { return Promise.resolve(); } createGain() { return gain; } }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = withNotes(); p.play();
    expect(p.seekNote('2333')).toBe(true); expect(p.playing).toBe(true);
    expect(p.phase).toBe('playing');
    p.pause(); expect(p.pausedAt).toBeCloseTo(7 / 3);
  });
});

describe('practice click scheduling', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('counts in using the selected bar meter before music and cancels pending audio on stop', () => {
    vi.useFakeTimers();
    let now = 0;
    const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number }; connect: () => void; type: string }[] = [];
    const gain = () => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() }, connect() {} });
    class AudioContext {
      destination = {};
      get currentTime() { return now; }
      resume() { return Promise.resolve(); }
      createGain() { return gain(); }
      createOscillator() { const o = { start: vi.fn(), stop: vi.fn(), frequency: { value: 0 }, connect() {}, type: '' }; oscillators.push(o); return o; }
      createBiquadFilter() { return { type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect() {} }; }
    }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = new Player();
    p.load({ notes: [], bars: [{ bar: 1, start: 0, length: 4, beats: 4, beatValue: 4 }, { bar: 2, start: 4, length: 3, beats: 6, beatValue: 8 }], total: 7 }, 120);
    p.seek(4); p.setCountIn(true); p.play();
    expect(p.phase).toBe('counting-in'); expect(p.countInRemaining).toBe(6);
    now = 0.05; vi.advanceTimersByTime(25);
    expect(oscillators[0].start).toHaveBeenCalledWith(0.08);
    p.stop(); expect(p.phase).toBe('stopped'); expect(oscillators[0].stop).toHaveBeenCalledTimes(2);
  });
});

describe('audio clock', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  function setup(bars: { bar: number; start: number; length: number; beats: number; beatValue: number }[], total: number) {
    vi.useFakeTimers();
    let now = 0;
    const sounds: { frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: () => void; type: string }[] = [];
    const gains: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn>; setTargetAtTime: ReturnType<typeof vi.fn> }; connect: () => void }[] = [];
    class AudioContext {
      destination = {};
      get currentTime() { return now; }
      resume() { return Promise.resolve(); }
      createGain() { const g = { gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() }, connect() {} }; gains.push(g); return g; }
      createOscillator() { const o = { frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect() {}, type: '' }; sounds.push(o); return o; }
      createBiquadFilter() { return { type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect() {} }; }
    }
    vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
    const p = new Player(); p.load({ notes: [], bars, total }, 120);
    const advance = (time: number) => { while (now < time - 1e-6) { now = Math.min(time, now + 0.025); vi.advanceTimersByTime(25); } };
    const jump = (time: number) => { now = time; vi.advanceTimersByTime(25); };
    return { p, sounds, gains, advance, jump };
  }
  const bars = [
    { bar: 1, start: 0, length: 4, beats: 4, beatValue: 4 },
    { bar: 2, start: 4, length: 3, beats: 3, beatValue: 4 },
    { bar: 3, start: 7, length: 3, beats: 6, beatValue: 8 },
  ];
  it('schedules written beats and accents across meter changes at 75% speed', () => {
    const { p, sounds, advance } = setup(bars, 10); p.setSpeed(0.75); p.setMetronome(true); p.play(); advance(6.8);
    expect(sounds.map(s => s.frequency.value)).toEqual([1200, 800, 800, 800, 1200, 800, 800, 1200, 800, 800, 800, 800, 800]);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5].map(b => 0.08 + b * 2 / 3);
    sounds.forEach((s, i) => expect(s.start.mock.calls[0][0]).toBeCloseTo(expected[i], 6));
  });
  it('counts once for a selected passage and schedules loop boundaries without gaps', () => {
    const { p, sounds, advance } = setup(bars, 10); p.setRange([4, 10], true); p.setSpeed(0.75); p.setCountIn(true); p.setMetronome(true); p.play(); advance(10.2);
    const times = sounds.map(s => s.start.mock.calls[0][0]);
    expect(times.slice(0, 4)).toEqual([0.08, 0.08 + 2 / 3, 0.08 + 4 / 3, 2.08]);
    expect(times.filter(t => Math.abs(t - 6.08) < 1e-6)).toHaveLength(1);
    expect(times.filter(t => Math.abs(t - 10.08) < 1e-6)).toHaveLength(1);
  });
  it('distinguishes count-in cancellation from music pause and cancels on seek and load', () => {
    const { p, sounds, advance } = setup(bars, 10); p.setCountIn(true); p.play(); advance(0.1); p.pause();
    expect(p.canResume).toBe(false); expect(sounds[0].stop).toHaveBeenCalledTimes(2);
    p.play(); expect(p.phase).toBe('counting-in'); advance(2.3); expect(p.phase).toBe('playing');
    p.pause(); expect(p.canResume).toBe(true); p.play(); expect(p.phase).toBe('playing');
    p.stop(); p.play(); advance(2.4); p.seek(4); expect(p.phase).toBe('paused'); expect(p.pausedAt).toBe(4);
    p.play(); expect(p.phase).toBe('counting-in'); p.load({ notes: [], bars: [], total: 0 }, 120); expect(p.phase).toBe('stopped');
  });
  it('defaults to silence, joins the next click live and cancels clicks without restarting', () => {
    const { p, sounds, advance } = setup(bars, 10); p.play(); advance(0.3); expect(sounds).toHaveLength(0);
    p.setClickVolume(0.2); p.setMetronome(true); advance(0.4); expect(sounds[0].start.mock.calls[0][0]).toBeCloseTo(0.58);
    p.setMetronome(false); expect(sounds[0].stop).toHaveBeenCalledTimes(2); expect(p.phase).toBe('playing');
  });
  it('cancels the scheduled loop when looping is disabled before its boundary', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 4], true); p.setMetronome(true); p.play(); advance(1.85);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.08) < 1e-6);
    expect(pending).toHaveLength(3);
    p.setRange([0, 4], false);
    pending.forEach(s => expect(s.stop).toHaveBeenCalledTimes(2));
  });
  it('cancels scheduled music and clicks when speed changes', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 1, key: '1000', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setMetronome(true); p.play(); advance(0.35);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 0.58) < 1e-6);
    expect(pending).toHaveLength(3);
    p.setSpeed(0.75); pending.forEach(s => expect(s.stop).toHaveBeenCalledTimes(2));
    expect(p.phase).toBe('playing');
  });
  it('seeks an exact note during count-in and begins a fresh count-in from it', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 8.5, key: '8500', bar: 3, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setCountIn(true); p.play(); advance(0.1); expect(p.seekNote('8500')).toBe(true);
    expect(sounds[0].stop).toHaveBeenCalledTimes(2); expect(p.pausedAt).toBe(8.5);
    expect(p.canResume).toBe(false); p.play(); expect(p.countInRemaining).toBe(6);
  });

  it.each([
    [0, 4, 0.5], [4, 3, 0.5], [7, 6, 0.25],
  ])('counts one bar from beat %s using its written meter', (beat, count, interval) => {
    const { p, sounds, advance } = setup(bars, 10); p.seek(beat); p.setCountIn(true); p.play();
    expect(p.countInRemaining).toBe(count); advance(count * interval + 0.1);
    expect(sounds).toHaveLength(count);
    sounds.forEach((sound, i) => {
      expect(sound.start.mock.calls[0][0]).toBeCloseTo(0.08 + i * interval);
      expect(sound.frequency.value).toBe(i === 0 ? 1200 : 800);
    });
    expect(p.phase).toBe('playing');
  });
  it('cancels future notes as well as clicks when count-in is stopped', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setCountIn(true); p.setMetronome(true); p.play(); advance(1.85);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.08) < 1e-6);
    expect(pending).toHaveLength(3); p.stop();
    pending.forEach(s => expect(s.stop).toHaveBeenCalledTimes(2));
  });
  it('turns off pending metronome clicks without stopping scheduled notes', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 1, key: '1000', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setMetronome(true); p.play(); advance(0.35);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 0.58) < 1e-6);
    p.setMetronome(false);
    expect(pending.filter(s => s.frequency.value === 800)[0].stop).toHaveBeenCalledTimes(2);
    expect(pending.filter(s => s.frequency.value !== 800).every(s => s.stop.mock.calls.length === 1)).toBe(true);
  });
  it('uses click volume without changing the instrument envelope', () => {
    const { p, gains, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setClickVolume(0.2); p.setMetronome(true); p.play(); advance(0.1);
    expect(gains.some(g => g.gain.setValueAtTime.mock.calls.some(([v]) => v === 0.1))).toBe(true);
    expect(gains.some(g => g.gain.exponentialRampToValueAtTime.mock.calls.some(([v]) => v === 0.28))).toBe(true);
  });

  it('preserves the count-in lead and reschedules at the new speed', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.setCountIn(true); p.play(); p.setSpeed(0.75); advance(0.2);
    expect(sounds[0].start.mock.calls[0][0]).toBeCloseTo(0.08);
    advance(0.7); expect(sounds[1].start.mock.calls[0][0]).toBeCloseTo(0.08 + 2 / 3);
    expect(p.phase).toBe('counting-in');
  });
  it('does not duplicate already scheduled notes when metronome joins', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 1, key: '1000', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.play(); advance(0.35); p.setMetronome(true); advance(0.4);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 0.58) < 1e-6);
    expect(pending).toHaveLength(3);
  });

  it('skips missed audio after the audio clock jumps forward', () => {
    const { p, sounds, jump } = setup(bars, 10);
    p.notes = [0, 1, 2, 3].map(beat => ({ beat, key: String(beat * 1000), bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }));
    p.setMetronome(true); p.play(); jump(1.7);
    expect(sounds.every(s => s.start.mock.calls[0][0] >= 1.7)).toBe(true);
  });
  it('schedules only the current pass after a long elapsed loop', () => {
    const { p, sounds, jump } = setup(bars, 10);
    p.setRange([0, 1], true); p.setMetronome(true); p.play(); jump(500000);
    expect(sounds.length).toBeLessThanOrEqual(1);
    expect(sounds.every(s => s.start.mock.calls[0][0] >= 500000)).toBe(true);
  });
  it('cancels count-in when a new range excludes its selected start', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.setCountIn(true); p.play(); advance(0.05);
    expect(sounds).toHaveLength(1); p.setRange([4, 7], true);
    expect(sounds[0].stop).toHaveBeenCalledTimes(2);
    expect(p.playing).toBe(false); expect(p.pausedAt).toBe(4); expect(p.canResume).toBe(false);
    p.play(); expect(p.phase).toBe('counting-in'); expect(p.countInRemaining).toBe(3);
  });

  it('skips missed count-in beats after a clock jump', () => {
    const { p, sounds, jump } = setup(bars, 10);
    p.setCountIn(true); p.play(); jump(1.2);
    expect(sounds.every(s => s.start.mock.calls[0][0] >= 1.2)).toBe(true);
    expect(p.phase).toBe('counting-in');
  });

  it('cancels a queued loop wrap if looping changes during count-in', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 4], true); p.setCountIn(true); p.setMetronome(true); p.play(3.875); advance(2);
    const wrap = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.1425) < 1e-6);
    expect(wrap).toHaveLength(3); p.setRange([0, 4], false);
    expect(p.phase).toBe('counting-in');
    expect(wrap.every(s => s.stop.mock.calls.length === 2)).toBe(true);
    advance(2.2);
    expect(sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.1425) < 1e-6 && s.stop.mock.calls.length === 1)).toHaveLength(0);
  });
  it('does not pause before a selected late onset', () => {
    const { p } = setup(bars, 10); p.play(8.5); p.pause();
    expect(p.pausedAt).toBe(8.5);
  });
  it('clamps pause to the current pass after wrapping from a late onset', () => {
    const { p, advance } = setup(bars, 10); p.setRange([4, 10], true); p.play(9.9); advance(0.15); p.pause();
    expect(p.pausedAt).toBe(4);
  });

  it('commits gradual increases at full passage boundaries, not while queued', () => {
    const { p, advance } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeed(0.6);
    expect(p.setSpeedPractice({ repetitions: 1, increase: 5, target: 70 })).toBe(true);
    p.play(); advance(3.2);
    expect(p.speed).toBe(0.6); expect(p.speedPracticeState.completed).toBe(0);
    advance(3.42); expect(p.speed).toBe(0.65);
    p.stop(); expect(p.speed).toBe(0.6); expect(p.speedPracticeState.enabled).toBe(true);
  });
  it('does not credit a partial play or a seek and ends on seek', () => {
    const { p, advance } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 });
    p.play(2); advance(1.2); expect(p.speed).toBe(1);
    advance(3.2); expect(p.speed).toBe(1.05);
    p.seek(0); expect(p.speedPracticeState.enabled).toBe(false);
  });

  it('schedules notes and clicks at the new speed before committing the boundary', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 4], true); p.setMetronome(true);
    p.setSpeedPractice({ repetitions: 1, increase: 20, target: 120 }); p.play(); advance(1.9);
    expect(p.speed).toBe(1);
    expect(sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.08) < 1e-6)).toHaveLength(3);
    advance(2.1); expect(p.speed).toBe(1.2);
    advance(2.3);
    expect(sounds.some(s => Math.abs(s.start.mock.calls[0][0] - (2.08 + 0.5 / 1.2)) < 1e-6)).toBe(true);
  });
  it('cancels queued accelerated audio when disabled and retains the current speed', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 4], true); p.setMetronome(true);
    p.setSpeedPractice({ repetitions: 1, increase: 20, target: 120 }); p.play(); advance(1.9);
    const pending = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 2.08) < 1e-6);
    p.setSpeedPractice(null); expect(pending.every(s => s.stop.mock.calls.length === 2)).toBe(true);
    advance(2.2); expect(p.speed).toBe(1); expect(p.speedPracticeState.enabled).toBe(false);
  });
  it('preserves a paused traversal and reconciles a boundary before stop', () => {
    const { p, advance, jump } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 });
    p.play(); advance(1); p.pause(); p.play(); advance(2.25);
    expect(p.speed).toBe(1.05); p.stop(); expect(p.speed).toBe(1);
    p.play(); jump(20); expect(p.speed).toBe(1.1);
  });
  it('keeps practice for identical range changes and ends it for changed boundaries', () => {
    const { p } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 2, increase: 5, target: 110 });
    p.setRange([0, 4], true); expect(p.speedPracticeState.enabled).toBe(true);
    p.setRange([0, 7], true); expect(p.speedPracticeState.enabled).toBe(false);
  });

  it('handles a long practice clock jump and stays at the target', () => {
    const { p, sounds, jump } = setup(bars, 10);
    p.setRange([0, 1], true); p.setMetronome(true);
    p.setSpeedPractice({ repetitions: 4, increase: 1, target: 130 }); p.play(); jump(500000);
    expect(p.speed).toBe(1.3); expect(p.speedPracticeState.reached).toBe(true);
    expect(sounds.length).toBeLessThanOrEqual(1);
  });
  it('starts at the target without increasing and counts in only once', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.setRange([0, 4], true); p.setCountIn(true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 100 });
    p.play(); advance(6.2); expect(p.speedPracticeState.reached).toBe(true); expect(p.speed).toBe(1);
    expect(sounds).toHaveLength(4);
  });
  it('retains current speed when changing it manually or loading a song', () => {
    const { p, advance } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 });
    p.play(); advance(2.1); expect(p.speed).toBe(1.05);
    p.load({ notes: [], bars, total: 10 }, 120); expect(p.speed).toBe(1.05); expect(p.speedPracticeState.enabled).toBe(false);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 }); p.setSpeed(0.8);
    expect(p.speed).toBe(0.8); expect(p.speedPracticeState.enabled).toBe(false);
  });
  it('disables practice while counting in without scheduling an accelerated wrap', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 0.125], true); p.setCountIn(true); p.setMetronome(true);
    p.setSpeedPractice({ repetitions: 1, increase: 20, target: 120 }); p.play(); advance(1.95);
    p.setSpeedPractice(null); advance(2.3); expect(p.speed).toBe(1);
    expect(sounds.some(s => s.start.mock.calls[0][0] > 2.08 && s.stop.mock.calls.length === 1)).toBe(true);
  });
  it('preserves eligibility through an unchanged range and a pause before the boundary', () => {
    const { p, advance } = setup(bars, 10);
    p.setRange([0, 4], true); p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 }); p.play();
    advance(1.9); p.setRange([0, 4], true); p.pause(); expect(p.speed).toBe(1);
    p.play(); advance(2.3); expect(p.speed).toBe(1.05);
  });

  it('reschedules the first note and click at the original start when practice is disabled during the lead', () => {
    const { p, sounds, advance } = setup(bars, 10);
    p.notes = [{ beat: 0, key: '0', bar: 1, string: 1, fret: 0, midi: 60, ring: 1 }];
    p.setRange([0, 4], true); p.setMetronome(true);
    p.setSpeedPractice({ repetitions: 1, increase: 5, target: 110 }); p.play(); advance(0.025);
    const initial = sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 0.08) < 1e-6);
    expect(initial).toHaveLength(3); p.setSpeedPractice(null); advance(0.05);
    expect(initial.every(s => s.stop.mock.calls.length === 2)).toBe(true);
    expect(sounds.filter(s => Math.abs(s.start.mock.calls[0][0] - 0.08) < 1e-6 && s.stop.mock.calls.length === 1)).toHaveLength(3);
  });

  it('does not credit a paused fragment after disabling and enabling a new run', () => {
    const { p, advance } = setup(bars, 10);
    const config = { repetitions: 1, increase: 5, target: 110 };
    p.setRange([0, 4], true); p.setSpeedPractice(config); p.play(); advance(1.9); p.pause();
    p.setSpeedPractice(null); p.setSpeedPractice(config); p.play(); advance(2.3);
    expect(p.speed).toBe(1); advance(4.3); expect(p.speed).toBe(1.05);
  });

});
