import { describe, expect, it } from 'vitest';
import { searchSongs, type SongEntry } from '../src/ui/songSearch';

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
