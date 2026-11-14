import { TWELVE_BAR_BLUES } from './harmony';
import type { ScaleId } from './scales';

export type MoodId = 'happy' | 'sad' | 'epic' | 'dark' | 'dreamy' | 'bluesy' | 'funky' | 'tense';

export interface Mood {
  id: MoodId;
  name: string;
  scale: ScaleId;
  /** Roman numerals, one chord per bar, as the Jam groove format writes them. */
  progressions: readonly string[];
  why: string;
}

export const MOODS: readonly Mood[] = [
  {
    id: 'happy',
    name: 'Happy',
    scale: 'major',
    progressions: ['I V vi IV', 'I IV V'],
    why: 'The major third above the root sounds bright and settled.',
  },
  {
    id: 'sad',
    name: 'Sad',
    scale: 'minor',
    progressions: ['i bVI bIII bVII', 'i iv v'],
    why: 'The minor third above the root sounds soft and low.',
  },
  {
    id: 'epic',
    name: 'Epic',
    scale: 'minor',
    progressions: ['i bVI bVII', 'i bVII bVI bVII'],
    why: 'Big major chords on the flat sixth and seventh climb back to a minor root.',
  },
  {
    id: 'dark',
    name: 'Dark',
    scale: 'phrygian',
    progressions: ['i bII', 'i bII bVII'],
    why: 'The note a half step above the root pulls down hard.',
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    scale: 'lydian',
    progressions: ['I II', 'Imaj7 II'],
    why: 'The raised fourth floats over the root and never settles.',
  },
  {
    id: 'bluesy',
    name: 'Bluesy',
    scale: 'blues',
    progressions: [TWELVE_BAR_BLUES],
    why: 'The flat fifth rubs against the fifth, and every chord is a restless seventh.',
  },
  {
    id: 'funky',
    name: 'Funky',
    scale: 'dorian',
    progressions: ['i7 IV7'],
    why: 'The major sixth brightens a minor chord, so a two chord vamp keeps moving.',
  },
  {
    id: 'tense',
    name: 'Tense',
    scale: 'harmonic-minor',
    progressions: ['i iv V7'],
    why: 'The raised seventh sits a half step under the root and begs to resolve.',
  },
];

export const isMoodId = (value: unknown): value is MoodId => MOODS.some(mood => mood.id === value);

export function moodById(id: MoodId): Mood {
  const mood = MOODS.find(m => m.id === id);
  if (!mood) throw new Error(`Unknown mood "${id}"`);
  return mood;
}
