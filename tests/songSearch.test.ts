import { describe, expect, it } from 'vitest';
import { browseSongs, searchSongs, type SongEntry } from '../src/ui/songSearch';

const song = (title: string, artist = ''): SongEntry => ({ value: title, title, artist, family: 'bass', group: 'Songs' });
const songs = [song('A Dawning', 'Ólafur Arnalds, Talos'), song('Ode to Joy', 'Ludwig van Beethoven'), song('Rock Eighths')];
const titles = (q: string) => searchSongs(songs, q).map(s => s.title);

describe('song search', () => {
  it('lists every song for an empty search', () => expect(titles('  ')).toHaveLength(3));
  it('finds a song by title or artist', () => {
    expect(titles('joy')).toEqual(['Ode to Joy']);
    expect(titles('beethoven')).toEqual(['Ode to Joy']);
  });
  it('ignores accents and case', () => expect(titles('OLAFUR')).toEqual(['A Dawning']));
  it('needs every word to match', () => {
    expect(titles('dawning talos')).toEqual(['A Dawning']);
    expect(titles('dawning beethoven')).toEqual([]);
  });
});

describe('search by level', () => {
  const rated: SongEntry[] = [{ ...song('Two ways'), levels: ['medium', 'hard'] }, { ...song('Starter'), levels: ['easy'] }];
  it('finds a song by the level of any of its versions', () => {
    expect(searchSongs(rated, 'hard').map(s => s.title)).toEqual(['Two ways']);
    expect(searchSongs(rated, 'easy').map(s => s.title)).toEqual(['Starter']);
  });
});

describe('browsing songs', () => {
  const entries: SongEntry[] = [{ ...song('Versions'), levels: ['easy', 'hard'] }, song('Unrated'), { ...song('Guitar'), family: 'guitar', levels: ['easy'] }];
  it('uses family while browsing and searches all families while typing', () => {
    expect(browseSongs(entries, '', 'bass', 'easy', []).map(s => s.title)).toEqual(['Versions']);
    expect(browseSongs(entries, 'guitar', 'bass', 'easy', []).map(s => s.title)).toEqual(['Guitar']);
    expect(browseSongs(entries, '', 'bass', 'unrated', []).map(s => s.title)).toEqual(['Unrated']);
  });
  it('matches any version level and prepends only available matching recent songs', () => {
    const result = browseSongs(entries, '', 'bass', 'hard', ['gone', 'Versions', 'Versions', 'Guitar']);
    expect(result.map(s => [s.title, s.group])).toEqual([['Versions', 'Recently practised'], ['Versions', 'Songs']]);
  });
});
