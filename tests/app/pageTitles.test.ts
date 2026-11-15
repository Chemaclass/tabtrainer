import { describe, expect, it } from 'vitest';
import { jamPageTitle, libraryPage, songPageTitle } from '../../src/app/pageTitles';

describe('page titles', () => {
  it('names each library page after its instrument and kind', () => {
    expect(libraryPage('exercises', 'bass').title).toBe('Bass exercises · TabTrainer');
    expect(libraryPage('songs', 'guitar')).toEqual({ title: 'Guitar songs · TabTrainer', description: 'Songs to practise on guitar, with tab and rhythm. Slow each one down, loop the hard bars, and follow each note as it plays.' });
    expect(libraryPage('mine', 'bass').title).toBe('My bass songs · TabTrainer');
  });
  it('names a song and a groove page', () => {
    expect(songPageTitle('Orion')).toBe('Orion · TabTrainer');
    expect(jamPageTitle('Blues shuffle')).toBe('Blues shuffle · Jam · TabTrainer');
  });
});
