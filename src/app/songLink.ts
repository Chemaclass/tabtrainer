import { REPOSITORY } from './repository';
import { bundledPath, bundledRef } from './songRef';

// "./songs/bass/songs/07-a-dawning.txt" -> "bass/a-dawning". The number only orders the list, so links survive a renumbering.
export const songSlug = (path: string) => {
  const parts = path.split('/');
  return `${parts[2]}/${parts[4].replace(/^\d+-/, '').replace(/\.txt$/, '')}`;
};
export const songAddress = (root: string, path: string) => `${root}${songSlug(path)}/`;
export const findBySlug = (paths: readonly string[], slug: string) => paths.find(p => songSlug(p) === slug);
// "Solo bass (melody + chords)" -> "solo-bass-melody-chords"
export const versionSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeSongReference(value: string, paths: string[]): string {
  const valuePath = bundledPath(value);
  if (valuePath === null) return value;
  const withoutOrder = (path: string) => path.replace(/\/\d+-([^/]+\.txt)$/, '/$1');
  const wanted = withoutOrder(valuePath);
  const path = paths.find(path => withoutOrder(path) === wanted);
  return path ? bundledRef(path) : value;
}
export const shareUrl = (root: string, path: string, version: string | null) =>
  `${songAddress(root, path)}${version ? `?${new URLSearchParams({ version })}` : ''}`;
export function songShareLink(root: string, picked: string, version: string | null): string | null {
  const path = bundledPath(picked);
  return path === null ? null : shareUrl(root, path, version);
}

export interface SongSource { url: string; exercise: boolean }
// An exercise opens GitHub's editor so a player can fix it; a song opens its file to read.
export function songSource(picked: string): SongSource | null {
  const path = bundledPath(picked);
  if (path === null) return null;
  const exercise = path.split('/')[3] === 'exercises';
  return { url: `${REPOSITORY}/${exercise ? 'edit' : 'blob'}/main/src/${path.replace(/^\.\//, '')}`, exercise };
}
