import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { findBySlug, normalizeSongReference, songShareLink, songSlug, songSource, versionSlug } from '../../src/app/songLink';

describe('song links', () => {
  it('names a song by family and file name, without the order number', () => {
    expect(songSlug('./songs/bass/songs/07-a-dawning.txt')).toBe('bass/a-dawning');
  });
  it('finds the song a link names', () => {
    const paths = ['./songs/bass/songs/01-ode-to-joy.txt', './songs/bass/songs/07-a-dawning.txt'];
    expect(findBySlug(paths, 'bass/a-dawning')).toBe(paths[1]);
    expect(findBySlug(paths, 'guitar/a-dawning')).toBeUndefined();
  });
  it('gives every bundled song its own link', () => {
    const slugs = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).map(f => songSlug(`./songs/${f}`));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('version links', () => {
  it('names a version in plain words', () => {
    expect(versionSlug('Solo bass (melody + chords)')).toBe('solo-bass-melody-chords');
    expect(versionSlug('Bass line')).toBe('bass-line');
  });
});

describe('exercise reordering', () => {
  it('keeps selections and drafts attached to the same exercise after renumbering', () => {
    const paths = ['./songs/bass/exercises/07-root-fifth.txt', './songs/guitar/exercises/06-arpeggios.txt'];
    expect(normalizeSongReference('demo:./songs/bass/exercises/04-root-fifth.txt', paths)).toBe('demo:' + paths[0]);
    expect(normalizeSongReference('demo:./songs/guitar/exercises/01-arpeggios.txt', paths)).toBe('demo:' + paths[1]);
    expect(normalizeSongReference('lib:My song', paths)).toBe('lib:My song');
    expect(normalizeSongReference('demo:missing', paths)).toBe('demo:missing');
  });
});

describe('share links', () => {
  const root = 'https://example.org/tabtrainer/', ref = 'demo:./songs/bass/songs/07-a-dawning.txt';
  it('links to the page the build writes for a bundled song', () => {
    expect(songShareLink(root, ref, null, false)).toBe(`${root}bass/a-dawning/`);
    expect(songShareLink(root, ref, 'easy', false)).toBe(`${root}bass/a-dawning/?version=easy`);
  });
  it('links to the query on the dev server', () => {
    expect(songShareLink(root, ref, 'easy', true)).toBe(`${root}?song=bass%2Fa-dawning&version=easy`);
    expect(songShareLink(root, ref, null, true)).toBe(`${root}?song=bass%2Fa-dawning`);
  });
  it('has no link for a saved song', () => {
    expect(songShareLink(root, 'lib:Mine', null, false)).toBeNull();
  });
});

describe('source links', () => {
  it('opens the file of a bundled song on GitHub', () => {
    expect(songSource('demo:./songs/bass/songs/07-a-dawning.txt')).toEqual({ url: 'https://github.com/Chemaclass/tabtrainer/blob/main/src/songs/bass/songs/07-a-dawning.txt', exercise: false });
  });
  it('opens the GitHub editor for a bundled exercise', () => {
    expect(songSource('demo:./songs/guitar/exercises/01-open-chords.txt')).toEqual({ url: 'https://github.com/Chemaclass/tabtrainer/edit/main/src/songs/guitar/exercises/01-open-chords.txt', exercise: true });
  });
  it('points every bundled song at its own file in the repository', () => {
    const files = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt'));
    for (const f of files) expect(songSource(`demo:./songs/${f}`)?.url.endsWith(`/main/src/songs/${f}`)).toBe(true);
  });
  it('has no source for a saved song', () => {
    expect(songSource('lib:Mine')).toBeNull();
  });
});
