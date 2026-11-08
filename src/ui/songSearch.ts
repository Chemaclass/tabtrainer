export interface SongEntry { value: string; title: string; artist: string; family: string; group: string }

// "Ólafur" matches "olafur": accents and case do not count
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// every typed word must appear in the title or the artist
export function searchSongs(entries: SongEntry[], query: string): SongEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return entries.filter(e => { const text = fold(`${e.title} ${e.artist}`); return words.every(w => text.includes(w)); });
}
