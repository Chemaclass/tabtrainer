import { describe, expect, it } from 'vitest';
import { jamAddress, jamShareLink } from '../../src/app/jamLink';

const root = 'https://example.com/tabtrainer/';
const setup = { key: 'F#', tempo: 96, progression: 'one-chord', swing: 50 };

describe('groove links', () => {
  it('shares the groove page with the full setup', () => {
    expect(jamShareLink(root, 'funk-sixteenths', setup)).toBe('https://example.com/tabtrainer/jam/funk-sixteenths/?key=F%23&tempo=96&progression=one-chord&swing=50');
  });
  it('shares the bare groove page when the setup is empty', () => {
    expect(jamShareLink(root, 'funk-sixteenths', {})).toBe('https://example.com/tabtrainer/jam/funk-sixteenths/');
  });
  it('addresses the groove in the app', () => {
    expect(jamAddress(root, 'blues-shuffle')).toBe('https://example.com/tabtrainer/jam/blues-shuffle/');
  });
});
