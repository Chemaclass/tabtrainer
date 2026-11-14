import { INSTRUMENTS, familyOf, type Family, type Instrument } from '../core/instruments';
import { frequencyOf, nearestNote, nearestString, noteName } from '../core/pitch';

export type Tunings = Record<string, number[]>;
export type TuneDirection = 'up' | 'down' | 'in-tune';

export const IN_TUNE_CENTS = 5;
const MAX_SHIFT = 12, LOWEST = 12, HIGHEST = 108;

const sounding = (instrument: Instrument) => instrument.tuning.map(written => written + instrument.transpose);
export const tuningKey = (family: Family, strings: number) => `${family}${strings}`;

/** Standard tuning for a family and string count, as sounding MIDI notes with string 1 first. */
export function standardTuning(family: Family, strings: number): number[] | null {
  const found = Object.values(INSTRUMENTS).find(i => i.id !== 'ukulele' && familyOf(i) === family && i.tuning.length === strings);
  return found ? sounding(found) : null;
}

export const isTunings = (value: unknown): value is Tunings =>
  !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value).every(t => Array.isArray(t) && t.length >= 1 && t.length <= 12 && t.every(n => Number.isInteger(n) && n >= LOWEST && n <= HIGHEST));

/** The strings the tuner offers: a non-standard song tuning wins, then the player's saved tuning, then standard. */
export class TunerTuning {
  readonly key: string;
  readonly standard: number[];
  private notes: number[];

  constructor(chosen: Family, song: Instrument | null, saved: Tunings) {
    const songNotes = song ? sounding(song) : null;
    const family = song ? familyOf(song) : chosen;
    const count = songNotes?.length ?? (family === 'guitar' ? 6 : 4);
    this.key = tuningKey(family, count);
    this.standard = standardTuning(family, count) ?? songNotes ?? [];
    const stored = saved[this.key]?.length === count ? saved[this.key] : null;
    const songDiffers = songNotes !== null && !same(songNotes, this.standard);
    this.notes = [...(songDiffers ? songNotes : stored ?? this.standard)];
  }

  get strings(): readonly number[] { return this.notes; }
  get isStandard() { return same(this.notes, this.standard); }
  name(index: number) { return noteName(this.notes[index]); }
  frequency(index: number) { return frequencyOf(this.notes[index]); }

  /** Moves one string by a half step, within an octave of standard. Returns false when it cannot move. */
  shift(index: number, step: 1 | -1): boolean {
    const next = this.notes[index] + step, base = this.standard[index] ?? this.notes[index];
    if (Math.abs(next - base) > MAX_SHIFT || next < LOWEST || next > HIGHEST) return false;
    this.notes[index] = next;
    return true;
  }
  reset() { this.notes = [...this.standard]; }

  /** The saved tunings with this one recorded, or removed when it is standard. */
  saveInto(saved: Tunings): Tunings {
    const next = { ...saved };
    if (this.isStandard) delete next[this.key]; else next[this.key] = [...this.notes];
    return next;
  }
}

function same(a: readonly number[], b: readonly number[]) { return a.length === b.length && a.every((n, i) => n === b[i]); }

export interface TunerReading {
  heard: string;
  frequency: number;
  target: number;
  targetName: string;
  targetFrequency: number;
  cents: number;
  direction: TuneDirection;
}

/** Compares a frequency with the locked string, or with the nearest string when `locked` is null. */
export function readTuning(frequency: number, strings: readonly number[], locked: number | null): TunerReading | null {
  const nearest = nearestString(frequency, strings);
  if (!nearest) return null;
  const target = locked !== null && locked >= 0 && locked < strings.length ? locked : nearest.index;
  const cents = (12 * Math.log2(frequency / frequencyOf(strings[target]))) * 100;
  const heard = nearestNote(frequency);
  return {
    heard: `${heard.name}${heard.octave}`, frequency, target,
    targetName: noteName(strings[target]), targetFrequency: frequencyOf(strings[target]), cents,
    direction: Math.abs(cents) <= IN_TUNE_CENTS ? 'in-tune' : cents < 0 ? 'up' : 'down',
  };
}
