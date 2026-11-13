export interface SongEntry { value: string; title: string; artist: string; family: string; group: string; levels?: string[]; about?: string }

// "Ólafur" matches "olafur": accents and case do not count
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// every typed word must appear in the title, the artist or the level
export function searchSongs(entries: SongEntry[], query: string): SongEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return entries.filter(e => { const text = fold(`${e.title} ${e.artist} ${(e.levels ?? []).join(' ')}`); return words.every(w => text.includes(w)); });
}

export function browseSongs(entries: SongEntry[], query: string, family: string, level: string, recent: string[]): SongEntry[] {
  const matches = (query.trim() ? searchSongs(entries, query) : entries.filter(e => e.family === family)).filter(e =>
    !level || (level === 'unrated' ? !e.levels?.length : e.levels?.includes(level)));
  const byValue = new Map(matches.map(e => [e.value, e]));
  const practised = [...new Set(recent)].slice(0, 10).flatMap(value => {
    const entry = byValue.get(value);
    return entry ? [{ ...entry, group: 'Recently practised' }] : [];
  });
  return [...practised, ...matches];
}
