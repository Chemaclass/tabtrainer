import { OWN_PROGRESSION, PROGRESSION_PRESETS } from '../core/harmony';
import { MOODS, type Mood } from '../core/moods';
import { MIXER_PARTS, type Mixer } from './jam';
import type { JamSetup } from './jamLink';

export const OWN_PROGRESSION_NAME = "Groove's own";
export const PROGRESSION_CHOICES: readonly string[] = [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(preset => preset.slug)];

export const SUMMARY_SEPARATOR = ' · ';

const PRESET_SLUGS: readonly string[] = PROGRESSION_PRESETS.map(preset => preset.slug);

/** A mood loop carries its mood's name while that mood is on, so the list says which chords belong to it. */
export function progressionName(slug: string, mood: Mood | null = null): string {
  const moodLoop = mood?.loops.find(loop => loop.slug === slug);
  if (mood && moodLoop) return `${mood.name}: ${moodLoop.name}`;
  const preset = PROGRESSION_PRESETS.find(candidate => candidate.slug === slug);
  if (preset) return preset.name;
  const loop = MOODS.flatMap(m => m.loops).find(candidate => candidate.slug === slug);
  return loop?.name ?? OWN_PROGRESSION_NAME;
}

/** The fixed choices, then the loops of the mood that is on. */
export function progressionChoices(mood: Mood | null): string[] {
  const moodLoops = mood ? mood.loops.map(loop => loop.slug).filter(slug => !PRESET_SLUGS.includes(slug)) : [];
  return [...PROGRESSION_CHOICES, ...moodLoops];
}

function barCountText(barCount: number): string {
  if (barCount === 1) return '1 bar';
  return `${barCount} bars`;
}

export function grooveContext(genre: string, barCount: number): string {
  const parts = [genre, barCountText(barCount)];
  return parts.filter(Boolean).join(SUMMARY_SEPARATOR);
}

export function grooveSummary({ key, tempo, progression }: Required<Pick<JamSetup, 'key' | 'tempo' | 'progression'>>): string {
  const parts = [key, `${tempo} bpm`, progressionName(progression)];
  return parts.join(SUMMARY_SEPARATOR);
}

export function mixSummary(mixer: Pick<Mixer, 'plays' | 'level'>): string {
  const playing = `I play ${mixer.plays}`;
  const mutedParts = MIXER_PARTS.filter(part => mixer.level(part).muted);
  if (!mutedParts.length) return playing;
  const muted = `${mutedParts.join(', ')} muted`;
  return [playing, muted].join(SUMMARY_SEPARATOR);
}
