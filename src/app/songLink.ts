import { bundledPath, bundledRef } from './songRef';

// "./songs/bass/songs/07-a-dawning.txt" -> "bass/a-dawning". The number only orders the list, so links survive a renumbering.
export const songSlug = (path: string) => {
  const parts = path.split('/');
  return `${parts[2]}/${parts[4].replace(/^\d+-/, '').replace(/\.txt$/, '')}`;
};
export const songAddress = (root: string, path: string) => `${root}?${new URLSearchParams({ song: songSlug(path) })}`;
export const findBySlug = (paths: string[], slug: string) => paths.find(p => songSlug(p) === slug);
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
// Points at the static page the build writes per song, so link previews show the song's own title.
export const shareUrl = (root: string, path: string, version: string | null) =>
  `${root}${songSlug(path)}/${version ? `?${new URLSearchParams({ version })}` : ''}`;
// Only the build writes the per-song pages, so the dev server links to the query instead.
export function songShareLink(root: string, picked: string, version: string | null, dev: boolean): string | null {
  const path = bundledPath(picked);
  if (path === null) return null;
  return dev ? `${root}?${new URLSearchParams({ song: songSlug(path), ...version && { version } })}` : shareUrl(root, path, version);
}
