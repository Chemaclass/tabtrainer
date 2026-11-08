import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { findBySlug, songSlug, versionSlug } from '../src/ui/songLink';

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
