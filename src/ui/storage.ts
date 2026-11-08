const LIB = 'tabtrainer:library';
export interface Saved { title: string; text: string; updated: number }
const read = (): Record<string, Saved> => { try { return JSON.parse(localStorage.getItem(LIB) ?? '{}'); } catch { return {}; } };
export const library = (): Saved[] => Object.values(read()).sort((a, b) => a.title.localeCompare(b.title));
export function saveSong(title: string, text: string) { const l = read(); l[title] = { title, text, updated: Date.now() }; try { localStorage.setItem(LIB, JSON.stringify(l)); } catch { /* storage full or blocked */ } }
export function removeSong(title: string) { const l = read(); delete l[title]; try { localStorage.setItem(LIB, JSON.stringify(l)); } catch { /* ignore */ } }
export function pref<T>(k: string, def: T): T { try { const v = localStorage.getItem('tabtrainer:' + k); return v === null ? def : JSON.parse(v); } catch { return def; } }
export function setPref(k: string, v: unknown) { try { localStorage.setItem('tabtrainer:' + k, JSON.stringify(v)); } catch { /* ignore */ } }
