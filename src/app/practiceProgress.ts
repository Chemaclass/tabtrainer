import type { PassMark } from '../core/speedPractice';
import type { CatalogueEntry } from './catalogue';
import { CLEAN_SPEED, songProgress, type BarLoop, type SongProgress, type SongRecord } from './practiceLog';

export interface PickUp { entry: CatalogueEntry; loop: BarLoop | null; version: string | null; passSpeed: number | null; nextSpeed: number | null; lastPlayed: number }
export interface RowProgress { progress: SongProgress; label: string; when: string | null; best: number | null }

const SPEED_STEP = 5;
const LADDER = Array.from({ length: 10 }, (_, step) => CLEAN_SPEED - (9 - step) * SPEED_STEP);

const startOfDay = (time: number) => { const date = new Date(time); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); };

export function daysAgo(time: number, now: number): string {
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000));
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function nextSpeed(speed: number): number {
  return speed >= CLEAN_SPEED ? speed : Math.min(CLEAN_SPEED, Math.floor(speed / SPEED_STEP) * SPEED_STEP + SPEED_STEP);
}

/** The song last played in this instrument, with the loop, version and speed to go back to. */
export function pickUp(songs: Record<string, SongRecord>, entries: readonly CatalogueEntry[], family: string): PickUp | null {
  const available = new Map(entries.filter(e => e.family === family).map(e => [e.value, e]));
  const [latest] = Object.entries(songs).filter(([ref]) => available.has(ref)).sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed);
  if (!latest) return null;
  const [ref, song] = latest, passSpeed = song.bestSpeed > 0 ? song.lastSpeed : null;
  return { entry: available.get(ref)!, loop: song.lastLoop, version: song.version, passSpeed, nextSpeed: passSpeed === null ? null : nextSpeed(passSpeed), lastPlayed: song.lastPlayed };
}

export function pickUpTitle({ entry, loop }: PickUp): string {
  if (!loop) return entry.title;
  return loop[0] === loop[1] ? `${entry.title}, bar ${loop[0]}` : `${entry.title}, bars ${loop[0]} to ${loop[1]}`;
}

export function pickUpState({ passSpeed, nextSpeed, lastPlayed }: PickUp, now: number): string {
  const when = daysAgo(lastPlayed, now);
  if (passSpeed === null) return `Started ${when}.`;
  const next = nextSpeed !== null && nextSpeed > passSpeed ? ` Next step is ${nextSpeed}%.` : '';
  return `Played through at ${passSpeed}% ${when}.${next}`;
}

export function pickUpAction({ nextSpeed }: PickUp): string {
  return nextSpeed === null ? 'Continue' : `Continue at ${nextSpeed}%`;
}

/** Ten speed steps up to full speed: the ones already played through, and the next one. */
export function speedLadder({ passSpeed, nextSpeed }: PickUp): PassMark[] {
  return LADDER.map(step => passSpeed !== null && step <= passSpeed ? 'done' : step === nextSpeed ? 'current' : 'todo');
}

export function rowProgress(song: SongRecord | null, now: number): RowProgress {
  const progress = songProgress(song);
  if (!song) return { progress, label: 'Not started', when: null, best: null };
  if (song.cleanAt !== null) return { progress, label: `Clean at ${CLEAN_SPEED}%`, when: daysAgo(song.cleanAt, now), best: null };
  if (song.bestSpeed > 0) return { progress, label: `Best ${song.bestSpeed}%`, when: null, best: Math.min(song.bestSpeed, CLEAN_SPEED) };
  return { progress, label: 'Started', when: daysAgo(song.lastPlayed, now), best: null };
}

export const progressSummary = ({ label, when }: RowProgress): string => when ? `${label} · ${when}` : label;
