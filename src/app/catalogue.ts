import type { SongProgress } from './practiceLog';
import { searchSongs, type SongEntry } from './songSearch';

export type LibraryKind = 'exercises' | 'songs' | 'mine';
export type ProgressFilter = 'all' | Exclude<SongProgress, 'not-started'>;
export interface CatalogueEntry extends SongEntry { kind: LibraryKind; tempo: number; versions: number; practiceLevels?: boolean }
export const isLibraryKind = (value: unknown): value is LibraryKind => value === 'exercises' || value === 'songs' || value === 'mine';
export const isProgressFilter = (value: unknown): value is ProgressFilter => value === 'all' || value === 'in-progress' || value === 'done';
const noProgress = (): SongProgress => 'not-started';
export function catalogueMatches(entries: CatalogueEntry[], kind: LibraryKind, family: string, query: string, level: string, progress: ProgressFilter = 'all', progressOf: (value: string) => SongProgress = noProgress): CatalogueEntry[] {
  const available = entries.filter(e => e.kind === kind && e.family === family);
  return searchSongs(available, query)
    .filter(e => !level || (level === 'unrated' ? !e.levels?.length : e.levels?.includes(level)))
    .filter(e => progress === 'all' || progressOf(e.value) === progress);
}
export function progressCounts(entries: readonly CatalogueEntry[], progressOf: (value: string) => SongProgress): Record<SongProgress, number> {
  const counts = { 'not-started': 0, 'in-progress': 0, done: 0 };
  for (const entry of entries) counts[progressOf(entry.value)]++;
  return counts;
}
export function nextExercise(entries: CatalogueEntry[], value: string): CatalogueEntry | undefined {
  const current = entries.find(e => e.value === value);
  if (current?.kind !== 'exercises') return;
  const exercises = entries.filter(e => e.kind === 'exercises' && e.family === current.family);
  return exercises[exercises.indexOf(current) + 1];
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
