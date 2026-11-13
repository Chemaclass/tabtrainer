import { isFamily, type Family } from '../core/instruments';
import { isLibraryKind, type LibraryKind } from './catalogue';

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
export interface DraftSnapshot { text: string; base: string; picked: string }
interface Preferences {
  family: Family;
  libraryKind: LibraryKind;
  zoom: number;
  notation: boolean;
  speed: number;
  scroll: number;
  editor: boolean;
  editorWidth: number | null;
  picked: string;
  last: string | null;
  draft: DraftSnapshot | null;
  recent: string[];
}
const finiteBetween = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isString = (value: unknown): value is string => typeof value === 'string';
const validators: { [K in keyof Preferences]: (value: unknown) => value is Preferences[K] } = {
  family: (value): value is Family => typeof value === 'string' && isFamily(value),
  libraryKind: isLibraryKind,
  zoom: (value): value is number => finiteBetween(value, 0.6, 1.8),
  notation: isBoolean,
  speed: (value): value is number => finiteBetween(value, 30, 130),
  scroll: (value): value is number => finiteBetween(value, 3, 80),
  editor: isBoolean,
  editorWidth: (value): value is number | null => value === null || finiteBetween(value, 0, Number.MAX_VALUE),
  picked: isString,
  last: (value): value is string | null => value === null || isString(value),
  draft: (value): value is DraftSnapshot | null => value === null || !!value && typeof value === 'object' && 'text' in value && isString(value.text) && 'base' in value && isString(value.base) && 'picked' in value && isString(value.picked),
  recent: (value): value is string[] => Array.isArray(value) && value.every(isString),
};
function readPreference(key: keyof Preferences): unknown {
  try { return JSON.parse(localStorage.getItem('tabtrainer:' + key) ?? 'null'); } catch { return null; }
}
export function pref<K extends keyof Preferences>(key: K, fallback: Preferences[K]): Preferences[K] {
  const value = readPreference(key);
  return validators[key](value) ? value : fallback;
}
export function setPref<K extends keyof Preferences>(key: K, value: Preferences[K]): boolean {
  try { localStorage.setItem('tabtrainer:' + key, JSON.stringify(value)); return true; } catch { return false; }
}

export function recentPractice(): string[] {
  const stored = readPreference('recent');
  return Array.isArray(stored) ? [...new Set(stored.filter((s): s is string => typeof s === 'string' && s.length > 0))].slice(0, 10) : [];
}
export function recordPractice(value: string) {
  if (value) setPref('recent', [value, ...recentPractice().filter(s => s !== value)].slice(0, 10));
}

