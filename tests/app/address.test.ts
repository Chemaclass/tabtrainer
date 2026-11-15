import { describe, expect, it } from 'vitest';
import { addressOf, isRootPath, libraryAddress, routeQuery } from '../../src/app/address';

const base = '/tabtrainer/';

describe('addresses', () => {
  it('reads a song or groove path as its route query, keeping the rest', () => {
    expect(routeQuery('/tabtrainer/bass/orion/', '?version=easy', base)).toBe('version=easy&song=bass/orion');
    expect(routeQuery('/tabtrainer/guitar/bourree-in-e-minor', '', base)).toBe('song=guitar/bourree-in-e-minor');
    expect(routeQuery('/tabtrainer/jam/blues-shuffle/', '?key=E', base)).toBe('key=E&view=jam&groove=blues-shuffle');
  });
  it('lets the path win over an older query and leaves other paths alone', () => {
    expect(routeQuery('/tabtrainer/bass/orion/', '?view=library&song=bass/x', base)).toBe('song=bass/orion');
    expect(routeQuery('/tabtrainer/', '?song=bass/orion', base)).toBe('song=bass/orion');
    expect(routeQuery('/tabtrainer/piano/x/', '?view=library', base)).toBe('view=library');
    expect(routeQuery('/tabtrainer/bass/a/b/', '', base)).toBe('');
    expect(routeQuery('/elsewhere/bass/orion/', '', base)).toBe('');
    expect(routeQuery('/tabtrainer/jam/%zz/', '?view=library', base)).toBe('view=library');
  });
  it('reads the library path, from the bare library to one instrument and kind', () => {
    expect(routeQuery('/tabtrainer/library/', '', base)).toBe('view=library');
    expect(routeQuery('/tabtrainer/library/guitar/', '', base)).toBe('view=library&instrument=guitar');
    expect(routeQuery('/tabtrainer/library/bass/mine/', '?new=1', base)).toBe('new=1&view=library&instrument=bass&kind=mine');
    expect(routeQuery('/tabtrainer/library/', '?kind=mine&new=1', base)).toBe('kind=mine&new=1&view=library');
    expect(routeQuery('/tabtrainer/library/piano/songs/', '', base)).toBe('');
    expect(routeQuery('/tabtrainer/library/bass/songs/extra/', '', base)).toBe('');
  });
  it('addresses each library page', () => {
    expect(libraryAddress('https://example.com/tabtrainer/', 'exercises', 'bass')).toBe('https://example.com/tabtrainer/library/bass/exercises/');
  });
  it('treats the base and its index.html as the root', () => {
    expect(isRootPath('/tabtrainer/', base)).toBe(true);
    expect(isRootPath('/tabtrainer/index.html', base)).toBe(true);
    expect(isRootPath('/tabtrainer/bass/orion/', base)).toBe(false);
  });
  it('writes a bundled song or groove as its path and the rest as the query', () => {
    expect(addressOf('song=bass/orion&version=easy', base)).toBe('/tabtrainer/bass/orion/?version=easy');
    expect(addressOf('view=jam&groove=blues-shuffle&key=E', base)).toBe('/tabtrainer/jam/blues-shuffle/?key=E');
    expect(addressOf('view=library&kind=songs&instrument=bass', base)).toBe('/tabtrainer/library/bass/songs/');
    expect(addressOf('view=library&kind=songs', base)).toBe('/tabtrainer/library/?kind=songs');
    expect(addressOf('', base)).toBe('/tabtrainer/');
  });
  it('keeps a groove of your own in the query, since only bundled grooves have pages', () => {
    expect(addressOf('view=jam&groove=mine:My+groove', base)).toBe('/tabtrainer/?view=jam&groove=mine%3AMy+groove');
  });
  it('reads back what it writes', () => {
    for (const search of ['song=bass/orion&version=easy', 'view=jam&groove=blues-shuffle&key=E', 'view=library&kind=songs', 'view=library&kind=mine&instrument=guitar&new=1']) {
      const url = new URL(addressOf(search, base), 'https://example.com');
      const sorted = (query: string) => [...new URLSearchParams(query)].sort();
      expect(sorted(routeQuery(url.pathname, url.search, base))).toEqual(sorted(search));
    }
  });
});
