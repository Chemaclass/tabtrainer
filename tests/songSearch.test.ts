import { describe, expect, it } from 'vitest';
import { searchSongs, type SongEntry } from '../src/app/songSearch';

const song = (title: string, artist = ''): SongEntry => ({ value: title, title, artist, family: 'bass' });
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
