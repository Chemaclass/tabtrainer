import { searchSongs, type SongEntry } from './songSearch';

export type LibraryKind = 'exercises' | 'songs' | 'mine';
export interface CatalogueEntry extends SongEntry { kind: LibraryKind; tempo: number; versions: number; practiceLevels?: boolean }
export const isLibraryKind = (value: unknown): value is LibraryKind => value === 'exercises' || value === 'songs' || value === 'mine';
export function catalogueMatches(entries: CatalogueEntry[], kind: LibraryKind, family: string, query: string, level: string): CatalogueEntry[] {
  const available = entries.filter(e => e.kind === kind && e.family === family);
  return searchSongs(available, query).filter(e => !level || (level === 'unrated' ? !e.levels?.length : e.levels?.includes(level)));
}
export function nextExercise(entries: CatalogueEntry[], value: string): CatalogueEntry | undefined {
  const current = entries.find(e => e.value === value);
  if (current?.kind !== 'exercises') return;
  const exercises = entries.filter(e => e.kind === 'exercises' && e.family === current.family);
  return exercises[exercises.indexOf(current) + 1];
}
export function recentEntries(entries: CatalogueEntry[], recent: string[], family: string): CatalogueEntry[] {
  const available = new Map(entries.filter(e => e.family === family).map(e => [e.value, e]));
  return [...new Set(recent)].slice(0, 10).flatMap(value => available.get(value) ?? []);
}

export function difficultyLabel(levels: readonly string[] = []): string {
  const ordered = ['easy', 'medium', 'hard'].filter(level => levels.includes(level));
  if (!ordered.length) return 'Unrated';
  const title = (level: string) => level[0].toUpperCase() + level.slice(1);
  return ordered.length === 1 ? title(ordered[0]) : `${title(ordered[0])} to ${ordered[ordered.length - 1]}`;
}
export function categoryCounts(entries: readonly CatalogueEntry[], family: string): Record<LibraryKind, number> {
  const counts = { exercises: 0, songs: 0, mine: 0 };
  for (const entry of entries) if (entry.family === family) counts[entry.kind]++;
  return counts;
}
