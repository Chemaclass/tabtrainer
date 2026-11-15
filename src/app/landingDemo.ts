import type { Family } from '../core/instruments';
import { parseSong } from '../core/parser';
import { routeSearch } from './navigation';
import { songAddress } from './songLink';

export const DEMO_SPEEDS = [50, 75, 100] as const;
export type DemoSpeed = typeof DEMO_SPEEDS[number];
export const DEMO_START_SPEED: DemoSpeed = 75;

const DEMO_BARS: Record<Family, { instrument: string; notes: string }> = {
  bass: { instrument: 'bass4', notes: ':q 3.3 2.2 5.2 2.2 | 1.4 0.3 3.3 0.3 |' },
  guitar: { instrument: 'guitar6', notes: ':q 3.5 2.4 0.3 2.4 | 3.4 2.3 1.2 2.3 |' },
};

export function demoSongText(family: Family): string {
  const { instrument, notes } = DEMO_BARS[family];
  return `title: Two bars\ninstrument: ${instrument}\ntempo: 100\nkey: C\ntime: 4/4\n\n${notes}\n`;
}

export interface LandingEntry { href: string; detail: string }
export interface LandingEntries { firstSteps: LandingEntry; rhythm: LandingEntry; songs: LandingEntry }

const folder = (path: string) => path.split('/').slice(2, 4).join('/');
const shortTitle = (text: string) => parseSong(text).song.meta.title.split(':')[0].trim();

function exerciseEntry(path: string, text: string): LandingEntry {
  const level = parseSong(text).song.meta.level;
  return { href: songAddress('./', path), detail: [shortTitle(text), level].filter(Boolean).join(' · ') };
}

export function landingEntries(bundled: Record<string, string>, family: Family): LandingEntries {
  const paths = Object.keys(bundled).sort();
  const exercises = paths.filter(path => folder(path) === `${family}/exercises`);
  const songs = paths.filter(path => folder(path) === `${family}/songs`);
  const rhythm = exercises.find(path => path.endsWith('-rhythm-ladder.txt')) ?? exercises[1] ?? exercises[0];
  const more = songs.length - 1;
  return {
    firstSteps: exerciseEntry(exercises[0], bundled[exercises[0]]),
    rhythm: exerciseEntry(rhythm, bundled[rhythm]),
    songs: {
      href: './?' + routeSearch('', { screen: 'library', kind: 'songs', family }),
      detail: more > 0 ? `${shortTitle(bundled[songs[0]])} and ${more} more` : shortTitle(bundled[songs[0]]),
    },
  };
}
