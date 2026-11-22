import { jamProgression, moodFits, moodNoteText, type Mood } from '../core/moods';
import { scaleById, type ScaleId } from '../core/scales';
import { isMinorKey, keyRootName, pitchClass } from '../core/theory';
import { keyTonic } from '../core/harmony';
import type { Jam, JamGroove } from './jam';
import { progressionName } from './jamSummary';

export const MOOD_QUESTION = 'How do you want it to feel?';

type MoodJam = Pick<Jam, 'mood' | 'key' | 'scale' | 'tempo' | 'progression' | 'groove' | 'list'>;

export interface MoodStage {
  name: string;
  why: string;
  /** "Usual for Sad: 56 to 88", or why the tempo is outside that range. */
  tempoHint: string;
  tempoOutside: boolean;
}

export const scaleTitleIn = (key: string, scale: ScaleId) => `${keyRootName(key)} ${scaleById(scale).title}`;

/** "A minor" for Am: the key spelled out, for players who do not read key names yet. */
export const keyLabel = (key: string) => `${keyRootName(key)} ${isMinorKey(key) ? 'minor' : 'major'}`;

/** "Faster than usual for Sad" once the tempo leaves the mood's range, empty inside it. */
export function tempoNote(mood: Mood, tempo: number): string {
  if (tempo > mood.tempo.max) return `Faster than usual for ${mood.name}`;
  if (tempo < mood.tempo.min) return `Slower than usual for ${mood.name}`;
  return '';
}

const playingLoop = (mood: Mood, progression: string) => mood.loops.find(loop => loop.slug === progression);

export function moodStage(jam: MoodJam): MoodStage | null {
  const { mood } = jam;
  if (!mood) return null;
  const range = `${mood.tempo.min} to ${mood.tempo.max}`;
  const note = tempoNote(mood, jam.tempo);
  return {
    name: mood.name,
    why: mood.why,
    tempoHint: note ? `${note}: ${range}` : `Usual for ${mood.name}: ${range}`,
    tempoOutside: note !== '',
  };
}

/** The page title: the mood, or the groove's own title with Free. */
export const heroTitle = (jam: MoodJam) => jam.mood?.name ?? jam.groove.title;

export interface ChordsChoice { short: string; count: string }

/** What the Chords control shows: the loop name and "1/3" under a mood, the progression name with Free. */
export function chordsChoice(jam: MoodJam): ChordsChoice {
  const { mood } = jam;
  const loop = mood ? playingLoop(mood, jam.progression) : undefined;
  if (!mood || !loop) return { short: progressionName(jam.progression, mood), count: '' };
  return { short: loop.name, count: `${mood.loops.indexOf(loop) + 1}/${mood.loops.length}` };
}

export interface NowText { job: string; showNext: boolean }

/** The job of the bar that plays; with no job, as with Free, the line names the next chord instead. */
export function nowText(jam: MoodJam, bar: number): NowText {
  const bars = moodBars(jam);
  const job = bars?.length ? (bars[bar % bars.length]?.job ?? '') : '';
  return { job, showNext: job === '' };
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

export interface MoodLegend {
  /** Where the fretboard marks the mood note, or null when the chosen scale leaves it out. */
  pitchClass: number | null;
  name: string;
  sentence: string;
}

/** A note borrowed from outside the mood scale shows only with its chord; a scale without the mood note says it leaves it out. */
export function moodLegend(mood: Mood | null, key: string, scale: ScaleId): MoodLegend | null {
  if (!mood) return null;
  const tonic = keyTonic(key) ?? 0;
  const note = moodNoteText(mood, keyRootName(key));
  const semitones = pitchClass(note.pitchClass - tonic);
  const borrowed = !scaleById(mood.scale).intervals.includes(semitones);
  const onScale = scaleById(scale).intervals.includes(semitones);
  if (onScale || borrowed) return note;
  return { pitchClass: null, name: note.name, sentence: `This scale leaves out ${note.name}, ${mood.note.label}.` };
}

export interface ScaleGroup { label: string | null; scales: ScaleId[] }

/** With a mood on, the scales that carry its note come first, then the others that fit the chords. */
export function scaleGroups(mood: Mood | null, scales: readonly ScaleId[]): ScaleGroup[] {
  if (!mood) return [{ label: null, scales: [...scales] }];
  const carriers: readonly ScaleId[] = [mood.scale, ...mood.alsoScales];
  return [
    { label: 'Carries the mood', scales: scales.filter(id => carriers.includes(id)) },
    { label: 'Also fits these chords', scales: scales.filter(id => !carriers.includes(id)) },
  ].filter(group => group.scales.length > 0);
}

export interface GrooveGroups { fitting: JamGroove[]; other: JamGroove[] }

/** The bundled grooves, those whose genre fits the mood first, best genre first; with no mood all of them are "other". */
export function grooveGroups(list: readonly JamGroove[], mood: Mood | null): GrooveGroups {
  const bundled = list.filter(entry => !entry.mine);
  if (!mood) return { fitting: [], other: bundled };
  return {
    fitting: mood.genres.flatMap(genre => bundled.filter(entry => entry.groove.genre === genre)),
    other: bundled.filter(entry => !moodFits(mood, entry.groove.genre)),
  };
}
