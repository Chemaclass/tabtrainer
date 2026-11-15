import { describe, expect, it, vi } from 'vitest';
import { Songbook } from '../../src/app/songbook';
import type { Saved } from '../../src/app/storage';

const song = (title: string, instrument: string, extra = '') => `title: ${title}\nartist: TabTrainer\ninstrument: ${instrument}\ntempo: 80\n${extra}\n:q 3.3 |\n`;
const bundled = {
  './songs/guitar/exercises/01-strum.txt': song('Strum', 'guitar6'),
  './songs/bass/songs/01-groove.txt': song('Groove', 'bass4'),
  './songs/bass/exercises/02-walk.txt': song('Walk', 'bass4', 'level: medium'),
  './songs/bass/exercises/01-roots.txt': song('Roots', 'bass4', 'level: easy'),
};
const mine: Saved = { title: 'My riff', text: song('My riff', 'ukulele'), updated: 1 };

function songbook(saved: Saved[] = [mine]) {
  const read = vi.fn(() => saved);
  return { book: new Songbook(bundled, read), read };
}

describe('songbook', () => {
  it('lists bundled songs by path, then saved songs, as catalogue entries', () => {
    const { book } = songbook();
    expect(book.entries().map(e => [e.value, e.kind, e.family, e.title])).toEqual([
      ['demo:./songs/bass/exercises/01-roots.txt', 'exercises', 'bass', 'Roots'],
      ['demo:./songs/bass/exercises/02-walk.txt', 'exercises', 'bass', 'Walk'],
      ['demo:./songs/bass/songs/01-groove.txt', 'songs', 'bass', 'Groove'],
      ['demo:./songs/guitar/exercises/01-strum.txt', 'exercises', 'guitar', 'Strum'],
      ['lib:My riff', 'mine', 'guitar', 'My riff'],
    ]);
  });

  it('fills an entry from the song text', () => {
    const { book } = songbook();
    expect(book.entries()[1]).toEqual({
      value: 'demo:./songs/bass/exercises/02-walk.txt', title: 'Walk', artist: '', levels: ['medium'], about: undefined,
      family: 'bass', kind: 'exercises', tempo: 80, versions: 1, practiceLevels: false,
    });
  });

  it('parses bundled songs once and reads saved songs on every call', () => {
    const { book, read } = songbook();
    const first = book.entries();
    const second = book.entries();
    expect(second[0]).toBe(first[0]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('gives the text of a bundled or saved reference', () => {
    const { book } = songbook();
    expect(book.text('demo:./songs/bass/songs/01-groove.txt')).toBe(bundled['./songs/bass/songs/01-groove.txt']);
    expect(book.text('lib:My riff')).toBe(mine.text);
  });

  it('has no text for an unknown reference', () => {
    const { book } = songbook();
    expect(book.text('demo:./songs/bass/songs/99-gone.txt')).toBeUndefined();
    expect(book.text('lib:Gone')).toBeUndefined();
    expect(book.text('')).toBeUndefined();
  });

  it('tells the library kind of a reference', () => {
    const { book } = songbook();
    expect(book.kind('demo:./songs/bass/exercises/01-roots.txt')).toBe('exercises');
    expect(book.kind('demo:./songs/bass/songs/01-groove.txt')).toBe('songs');
    expect(book.kind('lib:My riff')).toBe('mine');
  });

  it('starts a family on its first bundled song', () => {
    const { book } = songbook();
    expect(book.firstBundled('bass')).toBe('demo:./songs/bass/exercises/01-roots.txt');
    expect(book.firstBundled('guitar')).toBe('demo:./songs/guitar/exercises/01-strum.txt');
  });

  it('has no first song for a family without bundled songs', () => {
    expect(new Songbook({}, () => []).firstBundled('bass')).toBeNull();
  });

  it('keeps the bundled paths for links and history', () => {
    const { book } = songbook();
    expect(book.paths).toEqual(Object.keys(bundled));
  });
});
