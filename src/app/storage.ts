import { isSpeedPracticeConfig, type SpeedPracticeConfig } from '../core/speedPractice';
import { isFamily, type Family } from '../core/instruments';
import { isLibraryKind, type LibraryKind } from './catalogue';
import { isTunings, type Tunings } from './tuning';
import { isPracticeRecord, type PracticeRecord, type PracticeStore } from './practiceLog';
import { isTemplateInstrumentChoice, type TemplateInstrumentChoice } from './songTemplates';
import { isFretboardChoice, isFretboardInstruments, withFretboardDefaults, type FretboardChoice, type FretboardInstruments } from './fretboardSheet';

export interface Saved { title: string; text: string; updated: number }

export function isSaved(value: unknown): value is Saved {
  if (!value || typeof value !== 'object') return false;
  const { title, text, updated } = value as Partial<Record<keyof Saved, unknown>>;
  return typeof title === 'string' && typeof text === 'string' && typeof updated === 'number';
}

/** Texts saved in this browser under one storage key, by title. */
export class SavedTexts {
  constructor(private readonly key: string) {}

  list(): Saved[] {
    try {
      const items = Object.values(this.read());
      return items.sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      return [];
    }
  }

  has(title: string): boolean {
    return this.list().some(item => item.title === title);
  }

  save(title: string, text: string): boolean {
    try {
      const items = this.read();
      items[title] = { title, text, updated: Date.now() };
      localStorage.setItem(this.key, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }

  /** Adds the texts, keeping the newer of two with the same title. */
  merge(texts: readonly Saved[]): boolean {
    try {
      const items = this.read();
      for (const text of texts) if (!items[text.title] || items[text.title].updated < text.updated) items[text.title] = { title: text.title, text: text.text, updated: text.updated };
      localStorage.setItem(this.key, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }

  remove(title: string): boolean {
    try {
      const items = this.read();
      delete items[title];
      localStorage.setItem(this.key, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }

  // Throws on unreadable or corrupt data, so a write never replaces texts it could not read.
  private read(): Record<string, Saved> {
    const parsed: unknown = JSON.parse(localStorage.getItem(this.key) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(`Invalid ${this.key}`);
    const items: Record<string, Saved> = Object.create(null);
    for (const [title, value] of Object.entries(parsed)) {
      if (!isSaved(value)) throw Error(`Invalid entry in ${this.key}`);
      items[title] = { title: value.title, text: value.text, updated: value.updated };
    }
    return items;
  }
}

export const savedSongs = new SavedTexts('tabtrainer:library');
export const savedGrooves = new SavedTexts('tabtrainer:grooves');
export const library = () => savedSongs.list();
export const saveSong = (title: string, text: string) => savedSongs.save(title, text);
export const removeSong = (title: string) => savedSongs.remove(title);
export interface DraftSnapshot { text: string; base: string; picked: string }
export interface JamChoice { key?: unknown; tempo?: unknown; progression?: unknown; swing?: unknown; scale?: unknown; mood?: unknown }
export interface MixerChoice { plays?: unknown; parts?: unknown; room?: unknown }
export interface JamFretboardChoice { bass?: unknown; labels?: unknown }
interface Preferences {
  family: Family;
  libraryKind: LibraryKind;
  zoom: number;
  metronome: boolean;
  countIn: boolean;
  clickVolume: number;
  speed: number;
  speedPractice: SpeedPracticeConfig;
  scroll: number;
  editor: boolean;
  playerExpanded: boolean;
  playerMinimized: boolean;
  theme: 'light' | 'dark' | null;
  editorWidth: number | null;
  picked: string;
  last: string | null;
  draft: DraftSnapshot | null;
  tunings: Tunings;
  templateInstruments: TemplateInstrumentChoice;
  fretboardSheet: FretboardChoice;
  fretboardInstruments: FretboardInstruments;
  jam: Record<string, JamChoice>;
  jamMixer: MixerChoice;
  jamCountIn: boolean;
  jamFretboard: JamFretboardChoice;
  practice: PracticeRecord;
  shareNoticeDismissed: boolean;
}
const finiteBetween = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isString = (value: unknown): value is string => typeof value === 'string';
const validators: { [K in keyof Preferences]: (value: unknown) => value is Preferences[K] } = {
  family: (value): value is Family => typeof value === 'string' && isFamily(value),
  libraryKind: isLibraryKind,
  zoom: (value): value is number => finiteBetween(value, 0.6, 1.8),
  metronome: isBoolean,
  countIn: isBoolean,
  clickVolume: (value): value is number => finiteBetween(value, 0, 100),
  speed: (value): value is number => finiteBetween(value, 30, 130),
  speedPractice: isSpeedPracticeConfig,
  scroll: (value): value is number => finiteBetween(value, 3, 80),
  editor: isBoolean,
  playerExpanded: isBoolean,
  playerMinimized: isBoolean,
  theme: (value): value is 'light' | 'dark' | null => value === null || value === 'light' || value === 'dark',
  editorWidth: (value): value is number | null => value === null || finiteBetween(value, 0, Number.MAX_VALUE),
  picked: isString,
  last: (value): value is string | null => value === null || isString(value),
  draft: (value): value is DraftSnapshot | null => value === null || !!value && typeof value === 'object' && 'text' in value && isString(value.text) && 'base' in value && isString(value.base) && 'picked' in value && isString(value.picked),
  tunings: isTunings,
  templateInstruments: isTemplateInstrumentChoice,
  fretboardSheet: isFretboardChoice,
  fretboardInstruments: isFretboardInstruments,
  jam: (value): value is Record<string, JamChoice> => !!value && typeof value === 'object' && !Array.isArray(value),
  jamMixer: (value): value is MixerChoice => !!value && typeof value === 'object' && !Array.isArray(value),
  jamCountIn: isBoolean,
  jamFretboard: (value): value is JamFretboardChoice => !!value && typeof value === 'object' && !Array.isArray(value),
  practice: isPracticeRecord,
  shareNoticeDismissed: isBoolean,
};
const upgrades: { [K in keyof Preferences]?: (value: unknown) => unknown } = {
  fretboardSheet: withFretboardDefaults,
};
function readPreference(key: keyof Preferences): unknown {
  try { return JSON.parse(localStorage.getItem('tabtrainer:' + key) ?? 'null'); } catch { return null; }
}
export function pref<K extends keyof Preferences>(key: K, fallback: Preferences[K]): Preferences[K] {
  const stored = readPreference(key), upgrade = upgrades[key];
  const value = upgrade ? upgrade(stored) : stored;
  return validators[key](value) ? value : fallback;
}
// Throws on unreadable or invalid data, so a caller never writes over a value it could not read.
function storedPref<K extends keyof Preferences>(key: K): Preferences[K] | null {
  const stored = localStorage.getItem('tabtrainer:' + key);
  if (stored === null) return null;
  const value: unknown = JSON.parse(stored);
  if (!validators[key](value)) throw Error(`Invalid tabtrainer:${key}`);
  return value;
}
export function setPref<K extends keyof Preferences>(key: K, value: Preferences[K]): boolean {
  if (key === 'speedPractice') {
    if (!isSpeedPracticeConfig(value)) return false;
    try { localStorage.setItem('tabtrainer:' + key, JSON.stringify({ repetitions: value.repetitions, increase: value.increase, target: value.target })); return true; } catch { return false; }
  }
  try { localStorage.setItem('tabtrainer:' + key, JSON.stringify(value)); return true; } catch { return false; }
}

export const practiceStore: PracticeStore = { read: () => storedPref('practice'), write: record => setPref('practice', record) };
