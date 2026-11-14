import { describe, expect, it } from 'vitest';
import { catalogueMatches, categoryCounts, difficultyLabel, nextExercise, recentEntries, type CatalogueEntry } from '../../src/app/catalogue';

const entry = (value: string, kind: CatalogueEntry['kind'] = 'exercises', family = 'bass'): CatalogueEntry => ({ value, title: value, artist: '', kind, family, tempo: 90, versions: 1, levels: ['easy'] });
const entries = [entry('Open strings'), { ...entry('Scale'), about: 'One finger per fret', levels: ['medium', 'hard'] }, entry('Song', 'songs'), entry('Saved', 'mine'), entry('Guitar exercise', 'exercises', 'guitar')];
describe('practice catalogue', () => {
  it('keeps search within the selected route and instrument and searches training descriptions', () => {
    expect(catalogueMatches(entries, 'exercises', 'bass', 'finger', 'hard').map(e => e.value)).toEqual(['Scale']);
    expect(catalogueMatches(entries, 'songs', 'bass', '', '').map(e => e.value)).toEqual(['Song']);
    expect(catalogueMatches(entries, 'mine', 'bass', '', '').map(e => e.value)).toEqual(['Saved']);
    expect(catalogueMatches(entries, 'exercises', 'bass', 'Guitar', '')).toEqual([]);
  });
  it('finds the next exercise in source order, independent of search filters, and does not wrap', () => {
    expect(nextExercise(entries, 'Open strings')?.value).toBe('Scale');
    expect(nextExercise(entries, 'Scale')).toBeUndefined();
    expect(nextExercise(entries, 'Song')).toBeUndefined();
    expect(nextExercise(entries, 'missing')).toBeUndefined();
  });
  it('ignores missing recent entries and other instruments without inventing progress', () => {
    expect(recentEntries(entries, ['missing', 'Guitar exercise', 'Song', 'Song', 'Open strings'], 'bass').map(e => e.value)).toEqual(['Song', 'Open strings']);
  });
});

it('counts every entry in the selected instrument independently of filters', () => {
  expect(categoryCounts(entries, 'bass')).toEqual({ exercises: 2, songs: 1, mine: 1 });
  expect(categoryCounts(entries, 'guitar')).toEqual({ exercises: 1, songs: 0, mine: 0 });
});
it('summarizes ordered unique difficulty levels', () => {
  expect(difficultyLabel(['hard', 'easy', 'easy'])).toBe('Easy to hard');
  expect(difficultyLabel(['hard', 'medium'])).toBe('Medium to hard');
  expect(difficultyLabel(['easy'])).toBe('Easy');
  expect(difficultyLabel([])).toBe('Unrated');
});
