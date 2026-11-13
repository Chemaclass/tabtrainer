const LIB = 'tabtrainer:library';
export interface Saved { title: string; text: string; updated: number }
function read(): Record<string, Saved> {
  const parsed: unknown = JSON.parse(localStorage.getItem(LIB) ?? '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid library');
  const songs: Record<string, Saved> = Object.create(null);
  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.text !== 'string' || typeof value.updated !== 'number') throw Error('Invalid song');
    songs[key] = { title: value.title, text: value.text, updated: value.updated };
  }
  return songs;
}
export function library(): Saved[] { try { return Object.values(read()).sort((a, b) => a.title.localeCompare(b.title)); } catch { return []; } }
export function saveSong(title: string, text: string): boolean {
  try { const songs = read(); songs[title] = { title, text, updated: Date.now() }; localStorage.setItem(LIB, JSON.stringify(songs)); return true; } catch { return false; }
}
export function removeSong(title: string) { try { const songs = read(); delete songs[title]; localStorage.setItem(LIB, JSON.stringify(songs)); } catch { /* storage unavailable */ } }
export function pref<T>(k: string, def: T): T { try { const v = localStorage.getItem('tabtrainer:' + k); return v === null ? def : JSON.parse(v); } catch { return def; } }
export function setPref(k: string, v: unknown): boolean { try { localStorage.setItem('tabtrainer:' + k, JSON.stringify(v)); return true; } catch { return false; } }
