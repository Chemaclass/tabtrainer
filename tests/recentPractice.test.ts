import { afterEach, describe, expect, it, vi } from 'vitest';
import { recentPractice, recordPractice } from '../src/app/storage';

afterEach(() => vi.unstubAllGlobals());
describe('recent practice', () => {
  it('keeps ten unique songs, most recently played first', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    for (let i = 0; i < 12; i++) recordPractice(String(i));
    recordPractice('5'); recordPractice('');
    expect(recentPractice()).toEqual(['5', '11', '10', '9', '8', '7', '6', '4', '3', '2']);
  });
  it('tolerates blocked storage and malformed saved data', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: () => { throw Error('blocked'); } });
    expect(() => recordPractice('song')).not.toThrow(); expect(recentPractice()).toEqual([]);
  });
});
