import { describe, expect, it } from 'vitest';
import { jamAddress, jamSetup, jamShareLink } from '../../src/app/jamLink';

const root = 'https://example.com/tabtrainer/';
const setup = { key: 'F#', tempo: 96, progression: 'one-chord', swing: 50 };

describe('groove links', () => {
  it('shares the groove page with the full setup', () => {
    expect(jamShareLink(root, 'funk-sixteenths', setup)).toBe('https://example.com/tabtrainer/jam/funk-sixteenths/?key=F%23&tempo=96&progression=one-chord&swing=50');
  });
  it('shares the bare groove page when the setup is empty', () => {
    expect(jamShareLink(root, 'funk-sixteenths', {})).toBe('https://example.com/tabtrainer/jam/funk-sixteenths/');
  });
  it('puts the mood first and reads it back', () => {
    const link = jamShareLink(root, 'rock-straight-eighths', { mood: 'sad', key: 'Em', tempo: 74, progression: 'sad-i-bvi-biii-bvii', swing: 50 });
    expect(link).toBe('https://example.com/tabtrainer/jam/rock-straight-eighths/?mood=sad&key=Em&tempo=74&progression=sad-i-bvi-biii-bvii&swing=50');
    expect(jamSetup(new URL(link).searchParams)).toEqual({ mood: 'sad', key: 'Em', tempo: 74, progression: 'sad-i-bvi-biii-bvii', swing: 50 });
    expect(jamSetup(new URLSearchParams('key=E'))).toEqual({ key: 'E' });
  });
  it('addresses the groove in the app', () => {
    expect(jamAddress(root, 'blues-shuffle')).toBe('https://example.com/tabtrainer/jam/blues-shuffle/');
  });
});
