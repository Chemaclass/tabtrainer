import { afterEach, describe, expect, it, vi } from 'vitest';
import { library, saveSong, setPref } from '../src/ui/storage';

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
