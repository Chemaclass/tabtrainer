import type { PassEnd } from '../audio/practicePasses';
import { PRACTICE_LEVELS } from './practiceLevels';
import { normalizeSongReference } from './songLink';

export type BarLoop = [number, number];
export interface SongRecord { bestSpeed: number; cleanAt: number | null; lastPlayed: number; seconds: number; lastLoop: BarLoop | null; lastSpeed: number; version: string | null; levels?: Record<string, number>; doneAt?: number | null; markedLevels?: Record<string, number> }
export interface Win { song: string; speed: number; loop: BarLoop | null; at: number }
export interface PracticeRecord { songs: Record<string, SongRecord>; days: Record<string, number>; wins: Win[] }
export interface PracticeStore { read(): PracticeRecord | null; write(record: PracticeRecord): boolean }
export interface PassOutcome { best: boolean; clean: boolean }
export type SongProgress = 'not-started' | 'in-progress' | 'done';
export interface PracticeDay { day: string; seconds: number }

export const CLEAN_SPEED = 100;
const KEPT_WINS = 10;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const emptyRecord = (): PracticeRecord => ({ songs: Object.create(null), days: Object.create(null), wins: [] });
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isBarLoop = (value: unknown): value is BarLoop => Array.isArray(value) && value.length === 2 && value.every(Number.isInteger) && value[0] <= value[1];

function isSongRecord(value: unknown): value is SongRecord {
  if (!isObject(value)) return false;
  const { bestSpeed, cleanAt, lastPlayed, seconds, lastLoop, lastSpeed, version, levels, doneAt, markedLevels } = value;
  return isAmount(bestSpeed) && (cleanAt === null || isAmount(cleanAt)) && isAmount(lastPlayed) && isAmount(seconds)
    && (lastLoop === null || isBarLoop(lastLoop)) && isAmount(lastSpeed) && (version === null || typeof version === 'string')
    && [levels, markedLevels].every(times => times === undefined || (isObject(times) && Object.values(times).every(isAmount)))
    && (doneAt === undefined || doneAt === null || isAmount(doneAt));
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

/** Seven local days, Monday first, of the week that holds the time. */
export function practiceWeek(days: Record<string, number>, now: number): PracticeDay[] {
  const monday = dayOffset(now, -((new Date(now).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(dayOffset(monday, i));
    return { day, seconds: days[day] ?? 0 };
  });
}

// A song only marked done by hand was never played, so it is no practice yet.
export const hasPractice = ({ songs, days }: PracticeRecord): boolean => Object.values(songs).some(song => song.lastPlayed > 0) || Object.keys(days).length > 0;

const FIRST_LEVEL = PRACTICE_LEVELS[0].toLowerCase();

// Version names come from song files, so a name like "constructor" must not read Object.prototype.
export const timeOf = (times: Record<string, number>, key: string): number | undefined => Object.hasOwn(times, key) ? times[key] : undefined;

/** When each version was first played clean, crediting a record from before levels were kept with its best guess. */
export function levelsDone(song: SongRecord): Record<string, number> {
  if (song.levels) return song.levels;
  if (song.cleanAt === null) return {};
  // A song clean before it had levels was clean at its first one.
  if (song.version === null) return { [FIRST_LEVEL]: song.cleanAt };
  // Older records saved the version of every pass, so it names the clean level only when the last pass was clean.
  return song.lastLoop === null && song.lastSpeed >= CLEAN_SPEED ? { [song.version]: song.cleanAt } : {};
}

const unionTimes = (a: Record<string, number>, b: Record<string, number>) => {
  const times = { ...a };
  for (const [key, at] of Object.entries(b)) times[key] = earliest(timeOf(times, key), at)!;
  return times;
};

/** Each level done, whether played clean or marked by hand. */
export const doneLevels = (song: SongRecord): Record<string, number> => unionTimes(levelsDone(song), song.markedLevels ?? {});

/** With practice levels, a song is done once every level is; otherwise once any version is. */
export function songProgress(song: SongRecord | null, levels: readonly string[] = []): SongProgress {
  if (!song) return 'not-started';
  if (levels.length === 0) return song.cleanAt !== null || (song.doneAt ?? null) !== null || Object.keys(doneLevels(song)).length > 0 ? 'done' : 'in-progress';
  const done = doneLevels(song);
  return levels.every(level => timeOf(done, level) !== undefined) ? 'done' : 'in-progress';
}

const earliest = (a: number | null | undefined, b: number | null | undefined) => a == null ? b ?? null : b == null ? a : Math.min(a, b);

const newSong = (now: number): SongRecord => ({ bestSpeed: 0, cleanAt: null, lastPlayed: now, seconds: 0, lastLoop: null, lastSpeed: CLEAN_SPEED, version: null });

function mergeSong(mine: SongRecord | undefined, theirs: SongRecord): SongRecord {
  if (!mine) return theirs;
  const latest = theirs.lastPlayed > mine.lastPlayed ? theirs : mine;
  const merged: SongRecord = { ...latest, bestSpeed: Math.max(mine.bestSpeed, theirs.bestSpeed), cleanAt: earliest(mine.cleanAt, theirs.cleanAt), seconds: Math.max(mine.seconds, theirs.seconds) };
  // Each side's levels are worked out before merging, since the merged version and clean time no longer pair up.
  if (mine.levels || theirs.levels || mine.version !== null || theirs.version !== null) {
    const levels = unionTimes(levelsDone(mine), levelsDone(theirs));
    if (Object.keys(levels).length > 0 || mine.levels || theirs.levels) merged.levels = levels;
  }
  if (mine.markedLevels || theirs.markedLevels) merged.markedLevels = unionTimes(mine.markedLevels ?? {}, theirs.markedLevels ?? {});
  const doneAt = earliest(mine.doneAt, theirs.doneAt);
  if (doneAt !== null) merged.doneAt = doneAt; else delete merged.doneAt;
  return merged;
}

// Bundled song numbers change when songs are inserted, so progress follows each song to its current file.
function renumbered(record: PracticeRecord, paths: string[]): PracticeRecord {
  const songs: Record<string, SongRecord> = Object.create(null);
  for (const [ref, song] of Object.entries(record.songs)) {
    const current = normalizeSongReference(ref, paths);
    songs[current] = mergeSong(Object.hasOwn(songs, current) ? songs[current] : undefined, song);
  }
  return { songs, days: Object.assign(Object.create(null), record.days), wins: record.wins.map(win => ({ ...win, song: normalizeSongReference(win.song, paths) })) };
}

/** What the player has played through, per song and per day, kept in this browser. */
export class PracticeLog {
  constructor(private readonly store: PracticeStore, private readonly paths: string[] = []) {}

  get record(): PracticeRecord {
    try { return this.read(); } catch { return emptyRecord(); }
  }

  song(ref: string): SongRecord | null {
    return this.record.songs[ref] ?? null;
  }

  progress(ref: string): SongProgress {
    return songProgress(this.song(ref));
  }

  /** Whether this version of the song was played whole at full speed or marked done by hand. */
  levelDone(ref: string, level: string | null): boolean {
    const song = this.song(ref);
    return song !== null && level !== null && timeOf(doneLevels(song), level) !== undefined;
  }

  latest(): { ref: string; song: SongRecord } | null {
    const [entry] = Object.entries(this.record.songs).sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed);
    return entry ? { ref: entry[0], song: entry[1] } : null;
  }

  wins(): Win[] {
    return this.record.wins;
  }

  week(now: number): PracticeDay[] {
    return practiceWeek(this.record.days, now);
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
      const fullSpeed = pass.whole && pass.speed >= CLEAN_SPEED;
      const levels = version === null ? null : { ...levelsDone(song) };
      const clean = fullSpeed && (levels && version !== null ? timeOf(levels, version) === undefined : song.cleanAt === null);
      const best = pass.speed > song.bestSpeed;
      if (best) song.bestSpeed = pass.speed;
      if (clean && levels && version !== null) levels[version] = now;
      if (clean && song.cleanAt === null) song.cleanAt = now;
      if (levels) song.levels = levels;
      Object.assign(song, { lastPlayed: now, lastLoop: loop, lastSpeed: pass.speed, version });
      record.songs[ref] = song;
      if (best || clean) record.wins = [{ song: ref, speed: pass.speed, loop, at: now }, ...record.wins].slice(0, KEPT_WINS);
      return { best, clean };
    });
  }

  /** Marks a song, or one of its levels, done by hand, or takes the hand mark back. A clean pass stays, since it was earned. */
  setDone(ref: string, level: string | null, done: boolean, now: number): boolean {
    return this.update(record => {
      const song: SongRecord = { ...record.songs[ref] ?? newSong(0) };
      if (level !== null) {
        const marked = { ...song.markedLevels };
        if (done && timeOf(levelsDone(song), level) === undefined && timeOf(marked, level) === undefined) marked[level] = now;
        if (!done) delete marked[level];
        song.markedLevels = marked;
      } else if (done) {
        if (songProgress(song) !== 'done') song.doneAt = now;
      } else {
        song.doneAt = null;
      }
      const marked = song.cleanAt !== null || (song.doneAt ?? null) !== null || Object.keys(doneLevels(song)).length > 0;
      if (song.lastPlayed === 0 && !marked) delete record.songs[ref]; else record.songs[ref] = song;
      return true;
    }) ?? false;
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
    const theirs = renumbered(other, this.paths);
    return this.update(record => {
      for (const [ref, song] of Object.entries(theirs.songs)) record.songs[ref] = mergeSong(record.songs[ref], song);
      for (const [day, seconds] of Object.entries(theirs.days)) record.days[day] = Math.max(record.days[day] ?? 0, seconds);
      const wins = new Map([...record.wins, ...theirs.wins].map(win => [`${win.song} ${win.at}`, win]));
      record.wins = [...wins.values()].sort((a, b) => b.at - a.at).slice(0, KEPT_WINS);
      return true;
    }) ?? false;
  }

  private update<T>(change: (record: PracticeRecord) => T): T | null {
    let record: PracticeRecord;
    try { record = this.read(); } catch { return null; }
    const result = change(record);
    return isPracticeRecord(record) && this.store.write(record) ? result : null;
  }

  // Throws on unreadable or corrupt data, so a write never replaces a record it could not read.
  // Renumbers on every read rather than once, so a failed write loses nothing.
  private read(): PracticeRecord {
    const stored = this.store.read();
    return stored ? renumbered(stored, this.paths) : emptyRecord();
  }
}

/** Adds up the seconds audio plays for a song, saving at least every interval so a closed tab loses little. A longer gap means the page was asleep, so it counts nothing. */
export class PlayTime {
  private song: string | null = null;
  private since: number | null = null;

  constructor(private readonly log: PracticeLog, private readonly interval = 15_000) {}

  update(song: string | null, playing: boolean, now: number) {
    if (this.since !== null && this.song !== null && (!playing || song !== this.song || now - this.since >= this.interval)) {
      if (now - this.since <= this.interval * 2) this.log.played(this.song, (now - this.since) / 1000, now);
      this.since = null;
    }
    if (playing && song && this.since === null) { this.song = song; this.since = now; }
  }
}
