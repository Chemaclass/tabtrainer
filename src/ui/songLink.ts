// "./songs/bass/songs/07-a-dawning.txt" -> "bass/a-dawning". The number only orders the list, so links survive a renumbering.
export const songSlug = (path: string) => {
  const parts = path.split('/');
  return `${parts[2]}/${parts[4].replace(/^\d+-/, '').replace(/\.txt$/, '')}`;
};
export const findBySlug = (paths: string[], slug: string) => paths.find(p => songSlug(p) === slug);
// "Solo bass (melody + chords)" -> "solo-bass-melody-chords"
export const versionSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeSongReference(value: string, paths: string[]): string {
  if (!value.startsWith('demo:')) return value;
  const withoutOrder = (path: string) => path.replace(/\/\d+-([^/]+\.txt)$/, '/$1');
  const wanted = withoutOrder(value.slice(5));
  const path = paths.find(path => withoutOrder(path) === wanted);
  return path ? 'demo:' + path : value;
}
