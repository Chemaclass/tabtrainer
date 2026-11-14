export interface SongEntry { value: string; title: string; artist: string; family: string; levels?: string[]; about?: string }

// "Ólafur" matches "olafur": accents and case do not count
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchSongs<T extends SongEntry>(entries: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return entries.filter(e => { const text = fold(`${e.title} ${e.artist} ${e.about ?? ''} ${(e.levels ?? []).join(' ')}`); return words.every(w => text.includes(w)); });
}
