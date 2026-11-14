import { describe, expect, it } from 'vitest';
import { jamAddress, jamShareLink } from '../../src/app/jamLink';

const root = 'https://example.com/tabtrainer/';
const setup = { key: 'F#', tempo: 96, progression: 'one-chord', swing: 50 };

describe('groove links', () => {
  it('shares the groove page with the full setup', () => {
    expect(jamShareLink(root, 'funk-sixteenths', setup, false)).toBe('https://example.com/tabtrainer/jam/funk-sixteenths/?key=F%23&tempo=96&progression=one-chord&swing=50');
  });
  it('links the dev server to the query, which has no groove pages', () => {
    expect(jamShareLink(root, 'funk-sixteenths', setup, true)).toBe('https://example.com/tabtrainer/?view=jam&groove=funk-sixteenths&key=F%23&tempo=96&progression=one-chord&swing=50');
  });
  it('addresses the groove in the app', () => {
    expect(jamAddress(root, 'blues-shuffle')).toBe('https://example.com/tabtrainer/?view=jam&groove=blues-shuffle');
  });
});
