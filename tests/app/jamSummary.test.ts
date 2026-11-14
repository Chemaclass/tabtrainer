import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mixer } from '../../src/app/jam';
import { PROGRESSION_CHOICES, grooveContext, grooveSummary, mixSummary, progressionName } from '../../src/app/jamSummary';
import { OWN_PROGRESSION } from '../../src/core/harmony';

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('progression names', () => {
  it('names presets and the groove own chords', () => {
    expect(progressionName('12-bar-blues')).toBe('12 bar blues');
    expect(progressionName(OWN_PROGRESSION)).toBe("Groove's own");
  });

  it('offers the groove own chords first', () => {
    expect(PROGRESSION_CHOICES[0]).toBe(OWN_PROGRESSION);
    expect(PROGRESSION_CHOICES).toContain('ii-v-i');
  });
});

describe('groove context', () => {
  it('joins genre and bar count', () => {
    expect(grooveContext('blues', 12)).toBe('blues · 12 bars');
  });

  it('counts a single bar and skips a missing genre', () => {
    expect(grooveContext('', 1)).toBe('1 bar');
  });
});

describe('closed section summaries', () => {
  it('sums up key, tempo and progression', () => {
    expect(grooveSummary({ key: 'A', tempo: 80, progression: '12-bar-blues' })).toBe('A · 80 bpm · 12 bar blues');
  });

  it('names the instrument played and the muted parts', () => {
    const mixer = new Mixer('bass');
    expect(mixSummary(mixer)).toBe('I play bass · bass muted');
    mixer.setMuted('drums', true);
    expect(mixSummary(mixer)).toBe('I play bass · drums, bass muted');
  });

  it('leaves out muting when every part sounds', () => {
    expect(mixSummary(new Mixer('guitar'))).toBe('I play guitar');
  });
});
