// "./songs/bass/songs/07-a-dawning.txt" -> "bass/a-dawning". The number only orders the list, so links survive a renumbering.
export const songSlug = (path: string) => {
  const parts = path.split('/');
  return `${parts[2]}/${parts[4].replace(/^\d+-/, '').replace(/\.txt$/, '')}`;
};
export const findBySlug = (paths: string[], slug: string) => paths.find(p => songSlug(p) === slug);
