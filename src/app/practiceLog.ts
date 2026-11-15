import type { PassEnd } from '../audio/practicePasses';

export type BarLoop = [number, number];
export interface SongRecord { bestSpeed: number; cleanAt: number | null; lastPlayed: number; seconds: number; lastLoop: BarLoop | null; lastSpeed: number; version: string | null }
export interface Win { song: string; speed: number; loop: BarLoop | null; at: number }
export interface PracticeRecord { songs: Record<string, SongRecord>; days: Record<string, number>; wins: Win[] }
export interface PracticeStore { read(): PracticeRecord | null; write(record: PracticeRecord): boolean }
export interface PassOutcome { best: boolean; clean: boolean }
export type SongProgress = 'not-started' | 'in-progress' | 'done';
export interface PracticeDay { day: string; seconds: number }

export const CLEAN_SPEED = 100;
const KEPT_WINS = 10;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const emptyRecord = (): PracticeRecord => ({ songs: {}, days: {}, wins: [] });
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isBarLoop = (value: unknown): value is BarLoop => Array.isArray(value) && value.length === 2 && value.every(Number.isInteger) && value[0] <= value[1];

function isSongRecord(value: unknown): value is SongRecord {
  if (!isObject(value)) return false;
  const { bestSpeed, cleanAt, lastPlayed, seconds, lastLoop, lastSpeed, version } = value;
  return isAmount(bestSpeed) && (cleanAt === null || isAmount(cleanAt)) && isAmount(lastPlayed) && isAmount(seconds)
    && (lastLoop === null || isBarLoop(lastLoop)) && isAmount(lastSpeed) && (version === null || typeof version === 'string');
}

function isWin(value: unknown): value is Win {
  if (!isObject(value)) return false;
  const { song, speed, loop, at } = value;
  return typeof song === 'string' && isAmount(speed) && (loop === null || isBarLoop(loop)) && isAmount(at);
}

export function isPracticeRecord(value: unknown): value is PracticeRecord {
  if (!isObject(value) || !isObject(value.songs) || !isObject(value.days) || !Array.isArray(value.wins)) return false;
  return Object.values(value.songs).every(isSongRecord)
    && Object.entries(value.days).every(([day, seconds]) => DAY_KEY.test(day) && isAmount(seconds))
    && value.wins.every(isWin);
}

/** The local calendar day of a time, as YYYY-MM-DD. */
export function dayKey(time: number): string {
  const date = new Date(time);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
}

const dayOffset = (time: number, days: number) => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
};

const newSong = (now: number): SongRecord => ({ bestSpeed: 0, cleanAt: null, lastPlayed: now, seconds: 0, lastLoop: null, lastSpeed: CLEAN_SPEED, version: null });

function mergeSong(mine: SongRecord | undefined, theirs: SongRecord): SongRecord {
  if (!mine) return theirs;
  const latest = theirs.lastPlayed > mine.lastPlayed ? theirs : mine;
  const cleanAt = mine.cleanAt === null ? theirs.cleanAt : theirs.cleanAt === null ? mine.cleanAt : Math.min(mine.cleanAt, theirs.cleanAt);
  return { ...latest, bestSpeed: Math.max(mine.bestSpeed, theirs.bestSpeed), cleanAt, seconds: Math.max(mine.seconds, theirs.seconds) };
}

/** What the player has played through, per song and per day, kept in this browser. */
export class PracticeLog {
  constructor(private readonly store: PracticeStore) {}

  get record(): PracticeRecord {
    try { return this.read(); } catch { return emptyRecord(); }
  }

  song(ref: string): SongRecord | null {
    return this.record.songs[ref] ?? null;
  }

  progress(ref: string): SongProgress {
    const song = this.song(ref);
    return !song ? 'not-started' : song.cleanAt !== null ? 'done' : 'in-progress';
  }

  latest(): { ref: string; song: SongRecord } | null {
    const [entry] = Object.entries(this.record.songs).sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed);
    return entry ? { ref: entry[0], song: entry[1] } : null;
  }

  wins(): Win[] {
    return this.record.wins;
  }

  /** Seven local days, Monday first, of the week that holds the time. */
  week(now: number): PracticeDay[] {
    const days = this.record.days, monday = dayOffset(now, -((new Date(now).getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const day = dayKey(dayOffset(monday, i));
      return { day, seconds: days[day] ?? 0 };
    });
  }

  daysInARow(now: number): number {
    const days = this.record.days;
    let time = days[dayKey(now)] ? now : dayOffset(now, -1), count = 0;
    while (days[dayKey(time)]) { count++; time = dayOffset(time, -1); }
    return count;
  }

  passEnded(ref: string, version: string | null, pass: PassEnd, now: number): PassOutcome | null {
    return this.update(record => {
      const song = { ...record.songs[ref] ?? newSong(now) };
      const loop: BarLoop | null = pass.whole ? null : [pass.firstBar, pass.lastBar];
      const best = pass.speed > song.bestSpeed, clean = pass.whole && pass.speed >= CLEAN_SPEED && song.cleanAt === null;
      if (best) song.bestSpeed = pass.speed;
      if (clean) song.cleanAt = now;
      Object.assign(song, { lastPlayed: now, lastLoop: loop, lastSpeed: pass.speed, version });
      record.songs[ref] = song;
      if (best || clean) record.wins = [{ song: ref, speed: pass.speed, loop, at: now }, ...record.wins].slice(0, KEPT_WINS);
      return { best, clean };
    });
  }

  played(ref: string, seconds: number, now: number): boolean {
    if (!(seconds > 0)) return false;
    return this.update(record => {
      const song = record.songs[ref] ?? newSong(now), day = dayKey(now);
      record.songs[ref] = { ...song, lastPlayed: now, seconds: song.seconds + seconds };
      record.days[day] = (record.days[day] ?? 0) + seconds;
      return true;
    }) ?? false;
  }

  merge(other: PracticeRecord): boolean {
    return this.update(record => {
      for (const [ref, song] of Object.entries(other.songs)) record.songs[ref] = mergeSong(record.songs[ref], song);
      for (const [day, seconds] of Object.entries(other.days)) record.days[day] = Math.max(record.days[day] ?? 0, seconds);
      const wins = new Map([...record.wins, ...other.wins].map(win => [`${win.song} ${win.at}`, win]));
      record.wins = [...wins.values()].sort((a, b) => b.at - a.at).slice(0, KEPT_WINS);
      return true;
    }) ?? false;
  }

  private update<T>(change: (record: PracticeRecord) => T): T | null {
    let record: PracticeRecord;
    try { record = this.read(); } catch { return null; }
    const result = change(record);
    return this.store.write(record) ? result : null;
  }

  // Throws on unreadable or corrupt data, so a write never replaces a record it could not read.
  private read(): PracticeRecord {
    const stored = this.store.read();
    if (!stored) return emptyRecord();
    return { songs: { ...stored.songs }, days: { ...stored.days }, wins: [...stored.wins] };
  }
}

/** Adds up the seconds audio plays for a song, saving at least every interval so a closed tab loses little. */
export class PlayTime {
  private song: string | null = null;
  private since: number | null = null;

  constructor(private readonly log: PracticeLog, private readonly interval = 15_000) {}

  update(song: string | null, playing: boolean, now: number) {
    if (this.since !== null && this.song !== null && (!playing || song !== this.song || now - this.since >= this.interval)) {
      this.log.played(this.song, (now - this.since) / 1000, now);
      this.since = null;
    }
    if (playing && song && this.since === null) { this.song = song; this.since = now; }
  }
}
