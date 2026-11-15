import { afterEach, describe, expect, it, vi } from 'vitest';
import { library, practiceStore, saveSong, savedGrooves, setPref } from '../../src/app/storage';
import { PracticeLog } from '../../src/app/practiceLog';

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

describe('saving grooves', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    return values;
  }

  it('keeps grooves under their own key, apart from songs', () => {
    const values = memoryStorage();
    expect(savedGrooves.save('My groove', 'title: My groove')).toBe(true);
    expect(saveSong('My song', 'title: My song')).toBe(true);
    expect(savedGrooves.list().map(g => g.title)).toEqual(['My groove']);
    expect(library().map(s => s.title)).toEqual(['My song']);
    expect([...values.keys()].sort()).toEqual(['tabtrainer:grooves', 'tabtrainer:library']);
  });

  it('removes a groove and reports whether it could', () => {
    memoryStorage();
    savedGrooves.save('One', 'a');
    savedGrooves.save('Two', 'b');
    expect(savedGrooves.has('One')).toBe(true);
    expect(savedGrooves.remove('One')).toBe(true);
    expect(savedGrooves.list().map(g => g.title)).toEqual(['Two']);
    vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: vi.fn() });
    expect(savedGrooves.remove('Two')).toBe(false);
  });

  it('still reads songs saved before grooves existed', () => {
    const saved = { Old: { title: 'Old', text: 'title: Old', updated: 1 } };
    memoryStorage({ 'tabtrainer:library': JSON.stringify(saved) });
    expect(library()).toEqual([saved.Old]);
    expect(savedGrooves.list()).toEqual([]);
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
  it('keeps the template instrument chosen for each family and drops a mismatched one', async () => {
    const { pref } = await import('../../src/app/storage');
    store({ bass: 'bass5', guitar: 'guitar6' }); expect(pref('templateInstruments', {})).toEqual({ bass: 'bass5', guitar: 'guitar6' });
    for (const value of [{ bass: 'guitar6' }, { piano: 'bass4' }, { bass: 'bass7' }, ['bass4'], 'bass4']) { store(value); expect(pref('templateInstruments', {})).toEqual({}); }
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
    store({ text: 'changed', base: 'original', picked: 'lib:Song' });
    expect(pref('draft', null)).toEqual({ text: 'changed', base: 'original', picked: 'lib:Song' });
    store({ text: 'changed', base: 12, picked: 'lib:Song' }); expect(pref('draft', null)).toBeNull();
  });
  it('keeps a valid fretboard choice and drops a damaged one', async () => {
    const { pref } = await import('../../src/app/storage');
    const fallback = { root: 0, scale: 'major' as const, instrument: 'bass4', labels: 'names' as const, chord: null, sevenths: false, position: null, progression: null, bar: null, move: null, mood: null };
    store({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'degrees', chord: 2, sevenths: true, position: 5 });
    expect(pref('fretboardSheet', fallback)).toEqual({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'degrees', chord: 2, sevenths: true, position: 5, progression: null, bar: null, move: null, mood: null });
    store({ root: 9, scale: 'blues', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: 5, progression: '12-bar-blues', bar: 8, move: 'approach-scale' });
    expect(pref('fretboardSheet', fallback)).toMatchObject({ progression: '12-bar-blues', bar: 8, move: 'approach-scale' });
    store({ root: 9, scale: 'blues', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: 5, progression: 'bossa', bar: 8, move: null }); expect(pref('fretboardSheet', fallback)).toBe(fallback);
    store({ root: 9, scale: 'blues', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: 5, progression: null, bar: null, move: 'slap' }); expect(pref('fretboardSheet', fallback)).toBe(fallback);
    store({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'degrees' });
    expect(pref('fretboardSheet', fallback)).toEqual({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'degrees', chord: null, sevenths: false, position: null, progression: null, bar: null, move: null, mood: null });
    store({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'degrees', chord: 9 }); expect(pref('fretboardSheet', fallback)).toBe(fallback);
    store({ root: 3, scale: 'blues', instrument: 'guitar6', labels: 'tab' }); expect(pref('fretboardSheet', fallback)).toBe(fallback);
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

describe('practice record storage', () => {
  it('reads a missing record as empty and rejects one with the wrong shape without overwriting it', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    expect(practiceStore.read()).toBeNull();
    const wrong = JSON.stringify({ songs: [], days: {}, wins: [] });
    values.set('tabtrainer:practice', wrong);
    expect(() => practiceStore.read()).toThrow();
    expect(new PracticeLog(practiceStore).played('demo:a', 5, 0)).toBe(false);
    expect(values.get('tabtrainer:practice')).toBe(wrong);
  });
});
