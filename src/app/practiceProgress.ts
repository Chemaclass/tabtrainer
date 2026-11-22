import { defaultSpeedPractice, nextSpeedPracticeSpeed, type PassMark } from '../core/speedPractice';
import type { CatalogueEntry } from './catalogue';
import { CLEAN_SPEED, dayKey, levelsDone, songProgress, type BarLoop, type PracticeDay, type SongProgress, type SongRecord, type Win } from './practiceLog';

export interface PickUp { entry: CatalogueEntry; loop: BarLoop | null; version: string | null; passSpeed: number | null; nextSpeed: number | null; lastPlayed: number }
export interface RowProgress { progress: SongProgress; label: string; when: string | null; best: number | null; share: number | null; date: string | null }
export interface PracticeHistory { week: PracticeDay[]; wins: Win[] }
export interface WeekBar { letter: string; name: string; share: number; today: boolean }
export interface WeekSummary { minutes: number; days: number; bars: WeekBar[]; spoken: string; hint: string }
export interface RecentWin { when: string; text: string }

const LADDER = Array.from({ length: 10 }, (_, step) => CLEAN_SPEED - (9 - step) * 5);

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RECENT_WINS = 3;

const startOfDay = (time: number) => { const date = new Date(time); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); };

export function daysAgo(time: number, now: number): string {
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000));
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/** One climb step up from the speed, by the player's saved increase, never past full speed. */
export function nextSpeed(speed: number, increase = defaultSpeedPractice.increase): number {
  return speed >= CLEAN_SPEED ? speed : nextSpeedPracticeSpeed(speed, { increase, target: CLEAN_SPEED });
}

/** The song last played in this instrument, with the loop, version and speed to go back to. */
export function pickUp(songs: Record<string, SongRecord>, entries: readonly CatalogueEntry[], family: string, increase = defaultSpeedPractice.increase): PickUp | null {
  const available = new Map(entries.filter(e => e.family === family).map(e => [e.value, e]));
  const [latest] = Object.entries(songs).filter(([ref]) => available.has(ref)).sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed);
  if (!latest) return null;
  // A merged record can pair the last speed of a device that never finished a pass with the best of another.
  const [ref, song] = latest, passSpeed = song.bestSpeed > 0 ? Math.min(song.lastSpeed, song.bestSpeed) : null;
  return { entry: available.get(ref)!, loop: song.lastLoop, version: song.version, passSpeed, nextSpeed: passSpeed === null ? null : nextSpeed(passSpeed, increase), lastPlayed: song.lastPlayed };
}

function loopTitle(title: string, loop: BarLoop | null): string {
  if (!loop) return title;
  return loop[0] === loop[1] ? `${title}, bar ${loop[0]}` : `${title}, bars ${loop[0]} to ${loop[1]}`;
}

export const pickUpTitle = ({ entry, loop }: PickUp): string => loopTitle(entry.title, loop);

export function pickUpState({ passSpeed, nextSpeed, lastPlayed }: PickUp, now: number): string {
  const when = daysAgo(lastPlayed, now);
  if (passSpeed === null) return `Started ${when}.`;
  const next = nextSpeed !== null && nextSpeed > passSpeed ? ` Next step is ${nextSpeed}%.` : '';
  return `Played through at ${passSpeed}% ${when}.${next}`;
}

export function pickUpAction({ nextSpeed }: PickUp): string {
  return nextSpeed === null ? 'Continue' : `Continue at ${nextSpeed}%`;
}

/** Ten speed steps up to full speed: the ones already played through, and the first one above them. */
export function speedLadder({ passSpeed }: PickUp): PassMark[] {
  if (passSpeed === null) return LADDER.map(() => 'todo');
  const next = LADDER.find(step => step > passSpeed);
  return LADDER.map(step => step <= passSpeed ? 'done' : step === next ? 'current' : 'todo');
}

/** A date as "22 Nov 2026". */
export function fullDate(time: number): string {
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** How long ago, in words for the last week and as a date after that. */
export function doneWhen(time: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000);
  if (days < 7) return daysAgo(time, now);
  const date = new Date(time), sameYear = date.getFullYear() === new Date(now).getFullYear();
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** What a library row says about a song. Pass the level names when the song has practice levels. */
export function rowProgress(song: SongRecord | null, now: number, levels: readonly string[] = []): RowProgress {
  const slugs = levels.map(level => level.trim().toLowerCase());
  const progress = songProgress(song, slugs);
  const row = { progress, when: null, best: null, share: null, date: null };
  if (!song) return { ...row, label: 'Not started' };
  const done = levelsDone(song);
  const finished = slugs.map((slug, i) => ({ name: levels[i].trim(), at: done[slug] })).filter((level): level is { name: string; at: number } => level.at !== undefined);
  if (finished.length > 0) {
    const latest = finished.reduce((a, b) => b.at > a.at ? b : a);
    const label = finished.length === slugs.length ? `All ${slugs.length} levels done` : finished.length === 1 ? `${latest.name} done` : `${finished.length} of ${slugs.length} levels · ${latest.name} done`;
    return { ...row, label, when: doneWhen(latest.at, now), share: finished.length / slugs.length, date: fullDate(latest.at) };
  }
  if (slugs.length === 0 && song.cleanAt !== null) return { ...row, label: `Clean at ${CLEAN_SPEED}%`, when: doneWhen(song.cleanAt, now), date: fullDate(song.cleanAt) };
  if (song.bestSpeed > 0) return { ...row, label: `Best ${song.bestSpeed}%`, best: Math.min(song.bestSpeed, CLEAN_SPEED) };
  return { ...row, label: 'Started', when: daysAgo(song.lastPlayed, now) };
}

export const progressSummary = ({ label, when }: RowProgress): string => when ? `${label} · ${when}` : label;

/** Practice time as words: none, under a minute, or whole minutes. */
export function minutesLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (!(seconds > 0)) return 'none';
  if (minutes === 0) return 'under a minute';
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/** The week's minutes, the days with practice, and a bar per day scaled to the busiest one. */
export function weekSummary(week: readonly PracticeDay[], now: number): WeekSummary {
  const today = dayKey(now), most = Math.max(0, ...week.map(d => d.seconds));
  const total = week.reduce((sum, d) => sum + d.seconds, 0), todaySeconds = week.find(d => d.day === today)?.seconds ?? 0;
  const bars = week.map((d, i) => ({ letter: DAY_NAMES[i][0], name: DAY_NAMES[i], share: most > 0 ? d.seconds / most : 0, today: d.day === today }));
  return {
    minutes: total > 0 ? Math.max(1, Math.round(total / 60)) : 0,
    days: week.filter(d => d.seconds > 0).length,
    bars,
    spoken: week.map((d, i) => `${DAY_NAMES[i]} ${minutesLabel(d.seconds)}`).join(', '),
    hint: todaySeconds > 0 ? `Played ${minutesLabel(todaySeconds)} today.` : 'Ten minutes today keeps the week going.',
  };
}

export const weekUnit = ({ minutes, days }: WeekSummary): [string, string] =>
  [`${minutes === 1 ? 'minute' : 'minutes'} on`, `${days} ${days === 1 ? 'day' : 'days'}`];

function winDay(time: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000), date = new Date(time);
  if (days <= 0) return 'Today';
  return days < 7 ? DAY_NAMES[(date.getDay() + 6) % 7].slice(0, 3) : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** The latest win per song and loop in the instrument, with the day it happened. */
export function recentWins(wins: readonly Win[], entries: readonly CatalogueEntry[], family: string, now: number): RecentWin[] {
  const titles = new Map(entries.filter(e => e.family === family).map(e => [e.value, e.title]));
  const latest = new Map<string, Win>();
  for (const win of [...wins].sort((a, b) => b.at - a.at)) {
    const key = `${win.song} ${win.loop?.join('-') ?? 'whole'}`;
    if (titles.has(win.song) && !latest.has(key)) latest.set(key, win);
  }
  return [...latest.values()].slice(0, RECENT_WINS).map(win => {
    const title = loopTitle(titles.get(win.song)!, win.loop), clean = !win.loop && win.speed >= CLEAN_SPEED;
    return { when: winDay(win.at, now), text: clean ? `${title} clean at ${win.speed}%` : `${title} played through at ${win.speed}%` };
  });
}
