import { afterEach, describe, expect, it, vi } from 'vitest';
import { library, saveSong, setPref } from '../../src/app/storage';

afterEach(() => vi.unstubAllGlobals());
describe('saving songs', () => {
  it('reports a successful write and retains existing songs', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    expect(saveSong('First', 'one')).toBe(true); expect(saveSong('Second', 'two')).toBe(true);
    expect(library().map(s => s.title)).toEqual(['First', 'Second']);
  });
  it('reports a failed write without claiming success', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw Error('full'); } });
    expect(saveSong('Song', 'text')).toBe(false); expect(setPref('last', 'text')).toBe(false);
  });
  it('does not replace a library it could not read', () => {
    const write = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: write });
    expect(saveSong('Song', 'text')).toBe(false); expect(write).not.toHaveBeenCalled(); expect(library()).toEqual([]);
  });
  it('does not overwrite corrupt library data', () => {
    const write = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: write });
    expect(saveSong('Song', 'text')).toBe(false); expect(write).not.toHaveBeenCalled();
  });
});

describe('preferences', () => {
  function store(value: unknown) {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(value) });
  }
  it('rejects valid JSON with the wrong type or bounds', async () => {
    const { pref } = await import('../../src/app/storage');
    store('false'); expect(pref('editor', false)).toBe(false);
    store('dark'); expect(pref('theme', null)).toBe('dark');
    store('blue'); expect(pref('theme', null)).toBeNull();
    store({}); expect(pref('picked', '')).toBe('');
    store(0); expect(pref('speed', 100)).toBe(100);
    store(100); expect(pref('zoom', 1)).toBe(1);
    store('piano'); expect(pref('family', 'bass')).toBe('bass');
  });
  it('validates practice timing preferences and falls back when storage is blocked', async () => {
    const { pref } = await import('../../src/app/storage');
    store(true); expect(pref('metronome', false)).toBe(true); expect(pref('countIn', false)).toBe(true);
    store('true'); expect(pref('metronome', false)).toBe(false); expect(pref('countIn', false)).toBe(false);
    for (const value of [0, 50, 100]) { store(value); expect(pref('clickVolume', 50)).toBe(value); }
    for (const value of [-1, 101, '50', null]) { store(value); expect(pref('clickVolume', 50)).toBe(50); }
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); } });
    expect(pref('metronome', false)).toBe(false); expect(pref('countIn', false)).toBe(false); expect(pref('clickVolume', 50)).toBe(50);
  });
  it('retains valid settings and checks every recovered draft field', async () => {
    const { pref } = await import('../../src/app/storage');
    store(0.8); expect(pref('zoom', 1)).toBe(0.8);
    store(true); expect(pref('notation', false)).toBe(true);
    store({ text: 'changed', base: 'original', picked: 'lib:Song' });
    expect(pref('draft', null)).toEqual({ text: 'changed', base: 'original', picked: 'lib:Song' });
    store({ text: 'changed', base: 12, picked: 'lib:Song' }); expect(pref('draft', null)).toBeNull();
  });
});

describe('gradual speed settings', () => {
  const fallback = { repetitions: 4, increase: 5, target: 100 };
  it('reads valid settings and rejects malformed or missing values', async () => {
    const { pref } = await import('../../src/app/storage');
    let raw: string | null = null;
    vi.stubGlobal('localStorage', { getItem: () => raw });
    expect(pref('speedPractice', fallback)).toEqual(fallback);
    raw = JSON.stringify({ repetitions: 3, increase: 7, target: 80 });
    expect(pref('speedPractice', fallback)).toEqual({ repetitions: 3, increase: 7, target: 80 });
    for (const value of [null, [], 'bad', {}, { repetitions: 1.5, increase: 5, target: 100 }, { repetitions: 0, increase: 5, target: 100 }, { repetitions: 4, increase: 21, target: 100 }, { repetitions: 4, increase: 5, target: 131 }, { repetitions: 4, increase: 5, target: null }]) {
      raw = JSON.stringify(value); expect(pref('speedPractice', fallback)).toEqual(fallback);
    }
    raw = '{bad'; expect(pref('speedPractice', fallback)).toEqual(fallback);
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); } });
    expect(pref('speedPractice', fallback)).toEqual(fallback);
  });
  it('only saves valid settings and handles blocked writes', async () => {
    const { pref } = await import('../../src/app/storage');
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const valid = { repetitions: 4, increase: 5, target: 80 };
    const running = { ...valid, enabled: true, completed: 2 };
    expect(setPref('speedPractice', running)).toBe(true); expect(pref('speedPractice', fallback)).toEqual(valid);
    expect(setPref('speedPractice', { ...valid, target: Infinity })).toBe(false);
    expect(pref('speedPractice', fallback)).toEqual(valid);
    vi.stubGlobal('localStorage', { setItem: () => { throw Error('blocked'); } });
    expect(setPref('speedPractice', valid)).toBe(false);
  });
});
