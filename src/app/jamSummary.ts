import { OWN_PROGRESSION, PROGRESSION_PRESETS } from '../core/harmony';
import { MOODS, barRows, type Mood, type MoodLoop } from '../core/moods';
import { MIXER_PARTS, type Mixer } from './jam';

export const OWN_PROGRESSION_NAME = "Groove's own";
export const PROGRESSION_CHOICES: readonly string[] = [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(preset => preset.slug)];

export const SUMMARY_SEPARATOR = ' · ';

const MOOD_LOOPS = MOODS.flatMap(mood => mood.loops);
const isMoodLoop = (slug: string) => MOOD_LOOPS.some(loop => loop.slug === slug);

// Rows are joined with a comma rather than the bar line the groove text uses
const loopName = (loop: MoodLoop) => `${loop.name}: ${barRows(loop.bars).join(', ')}`;

/** A mood loop by its name and chords, such as "Drive and climb: I I bVII IV, I I IV bVII". */
export function progressionName(slug: string, mood: Mood | null = null): string {
  const moodLoop = mood?.loops.find(candidate => candidate.slug === slug);
  if (moodLoop) return loopName(moodLoop);
  const preset = PROGRESSION_PRESETS.find(candidate => candidate.slug === slug);
  if (preset) return preset.name;
  const strayLoop = MOOD_LOOPS.find(candidate => candidate.slug === slug);
  return strayLoop ? loopName(strayLoop) : OWN_PROGRESSION_NAME;
}

/** Only the loops of the mood that is on. With no mood, the fixed choices, and the chosen mood loop that a mood left behind. */
export function progressionChoices(mood: Mood | null, chosen: string): string[] {
  if (mood) return mood.loops.map(loop => loop.slug);
  return PROGRESSION_CHOICES.includes(chosen) || !isMoodLoop(chosen) ? [...PROGRESSION_CHOICES] : [...PROGRESSION_CHOICES, chosen];
}

export function mixSummary(mixer: Pick<Mixer, 'plays' | 'level'>): string {
  const playing = `I play ${mixer.plays}`;
  const mutedParts = MIXER_PARTS.filter(part => mixer.level(part).muted);
  if (!mutedParts.length) return playing;
  const muted = `${mutedParts.join(', ')} muted`;
  return [playing, muted].join(SUMMARY_SEPARATOR);
}
