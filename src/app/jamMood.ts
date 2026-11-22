import { jamProgression, moodNoteText, type Mood } from '../core/moods';
import { scaleById, type ScaleId } from '../core/scales';
import { isMinorKey, keyRootName, pitchClass } from '../core/theory';
import { keyTonic } from '../core/harmony';
import type { Jam } from './jam';
import { SUMMARY_SEPARATOR } from './jamSummary';

export const MOOD_QUESTION = 'How do you want it to feel?';

type MoodJam = Pick<Jam, 'mood' | 'key' | 'scale' | 'tempo' | 'progression' | 'groove' | 'list'>;

export interface MoodFact { value: string; helper: string }

export interface MoodStage {
  name: string;
  why: string;
  scale: MoodFact;
  chords: MoodFact & { more: boolean };
  tempo: MoodFact;
  groove: MoodFact;
  /** The facts in one line, for narrow screens. */
  summary: string;
  tempoHint: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const scaleTitleIn = (key: string, scale: ScaleId) => `${keyRootName(key)} ${scaleById(scale).title}`;

/** "A minor" for Am: the key spelled out, for players who do not read key names yet. */
export const keyLabel = (key: string) => `${keyRootName(key)} ${isMinorKey(key) ? 'minor' : 'major'}`;

const playingLoop = (mood: Mood, progression: string) => mood.loops.find(loop => loop.slug === progression);

function grooveHelper(jam: MoodJam, mood: Mood): string {
  const fitting = jam.list.filter(entry => mood.genres.includes(entry.groove.genre)).length;
  const fits = `${plural(fitting, 'groove fits', 'grooves fit')} ${mood.name}`;
  return mood.genres.includes(jam.groove.genre) ? fits : `${fits}, not this one`;
}

export function moodStage(jam: MoodJam): MoodStage | null {
  const { mood } = jam;
  if (!mood) return null;
  const loop = playingLoop(mood, jam.progression);
  const others = mood.loops.length - 1;
  const scaleTitle = scaleTitleIn(jam.key, jam.scale);
  const range = `${mood.tempo.min} to ${mood.tempo.max}`;
  return {
    name: mood.name,
    why: mood.why,
    scale: { value: scaleTitle, helper: 'Shown on the fretboard below' },
    chords: { value: loop?.bars ?? '', helper: `${plural(others, 'more loop', 'more loops')} for ${mood.name}`, more: others > 0 },
    tempo: { value: `${mood.tempo.word}, ${range}`, helper: mood.tempo.outside },
    groove: { value: jam.groove.title, helper: grooveHelper(jam, mood) },
    summary: [scaleTitle, `${mood.tempo.word.toLowerCase()}, ${range}`, `${jam.groove.title} groove`].join(SUMMARY_SEPARATOR),
    tempoHint: `Usual for ${mood.name}: ${range}`,
  };
}

export interface MoodBar { numeral: string; job: string }

/** The numeral of every bar, and its job while a mood loop plays. */
export function moodBars(jam: MoodJam): MoodBar[] | null {
  const { mood } = jam;
  if (!mood) return null;
  const chords = jamProgression(jam.progression, jam.groove.progression) ?? [];
  const jobs = playingLoop(mood, jam.progression)?.jobs ?? [];
  return chords.map((numeral, bar) => ({ numeral: numeral.text, job: jobs[bar] ?? '' }));
}

export interface MoodLegend { pitchClass: number; name: string; sentence: string }

/** A note borrowed from outside the mood scale shows only with its chord; a scale without the mood note gets no legend. */
export function moodLegend(mood: Mood | null, key: string, scale: ScaleId): MoodLegend | null {
  if (!mood) return null;
  const tonic = keyTonic(key) ?? 0;
  const note = moodNoteText(mood, keyRootName(key));
  const semitones = pitchClass(note.pitchClass - tonic);
  const borrowed = !scaleById(mood.scale).intervals.includes(semitones);
  const onScale = scaleById(scale).intervals.includes(semitones);
  if (!onScale && !borrowed) return null;
  return note;
}
