import { describe, expect, it } from 'vitest';
import { creditedArtist, jamPageTitle, libraryIndexPage, libraryPage, songPageTitle } from '../../src/app/pageTitles';

describe('page titles', () => {
  it('names each library page after its instrument and kind', () => {
    expect(libraryPage('exercises', 'bass').title).toBe('Bass exercises · TabTrainer');
    expect(libraryPage('songs', 'guitar')).toEqual({ title: 'Guitar songs · TabTrainer', description: 'Songs to practise on guitar, with tab and rhythm. Slow each one down, loop the hard bars, and follow each note as it plays.' });
    expect(libraryPage('mine', 'bass').title).toBe('My bass songs · TabTrainer');
  });
  it('names the bare library pages', () => {
    expect(libraryIndexPage(null).title).toBe('Bass and guitar exercises and songs · TabTrainer');
    expect(libraryIndexPage('guitar').title).toBe('Guitar exercises and songs · TabTrainer');
  });
  it('names a song and a groove page', () => {
    expect(songPageTitle('Orion', 'bass', 'Metallica')).toBe('Orion by Metallica, bass tab with rhythm · TabTrainer');
    expect(jamPageTitle('Blues shuffle', 'Blues')).toBe('Blues shuffle, Blues backing groove · TabTrainer');
  });
  it('credits only an artist someone would search for', () => {
    expect(creditedArtist('Johann Sebastian Bach (public domain)')).toBe('Johann Sebastian Bach');
    expect(creditedArtist('Traditional (public domain)')).toBe('');
    expect(creditedArtist('TabTrainer')).toBe('');
    expect(creditedArtist('Sigur Rós (band)')).toBe('Sigur Rós (band)');
    expect(songPageTitle('First steps', 'guitar', 'TabTrainer')).toBe('First steps, guitar tab with rhythm · TabTrainer');
  });
});
