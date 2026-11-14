import { describe, expect, it } from 'vitest';
import { artistOf, creditNames, shownCredits } from '../../src/app/credits';

describe('credits', () => {
  it('splits names on commas and trims them', () => {
    expect(creditNames('Ann Lee,  Bob ,')).toEqual(['Ann Lee', 'Bob']);
  });

  it('drops a trailing public domain note', () => {
    expect(creditNames('Traditional (Public Domain)')).toEqual(['Traditional']);
  });

  it('has no names without an artist', () => {
    expect(creditNames()).toEqual([]);
    expect(creditNames('')).toEqual([]);
  });

  it('does not credit TabTrainer, whatever the case', () => {
    expect(shownCredits('TabTrainer')).toEqual([]);
    expect(shownCredits('tabtrainer, Ann Lee')).toEqual(['Ann Lee']);
  });

  it('keeps Traditional as a credit', () => {
    expect(shownCredits('Traditional')).toEqual(['Traditional']);
  });

  it('reads the artist from the song header', () => {
    expect(artistOf('title: Riff\nartist: Ann Lee, Bob\ntempo: 90')).toBe('Ann Lee, Bob');
    expect(artistOf('  ARTIST : Ann Lee (public domain)')).toBe('Ann Lee');
  });

  it('gives an empty artist when none is named or TabTrainer wrote it', () => {
    expect(artistOf('title: Riff')).toBe('');
    expect(artistOf('artist: TabTrainer')).toBe('');
  });
});
