import { OWN_PROGRESSION, PROGRESSION_PRESETS } from '../core/harmony';
import { MIXER_PARTS, type Mixer } from './jam';
import type { JamSetup } from './jamLink';

export const OWN_PROGRESSION_NAME = "Groove's own";
export const PROGRESSION_CHOICES: readonly string[] = [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(preset => preset.slug)];

const SEPARATOR = ' · ';

export function progressionName(slug: string): string {
  const preset = PROGRESSION_PRESETS.find(candidate => candidate.slug === slug);
  return preset?.name ?? OWN_PROGRESSION_NAME;
}

function barCountText(barCount: number): string {
  if (barCount === 1) return '1 bar';
  return `${barCount} bars`;
}

export function grooveContext(genre: string, barCount: number, key: string): string {
  const parts = [genre, barCountText(barCount), key];
  return parts.filter(Boolean).join(SEPARATOR);
}

export function grooveSummary({ key, tempo, progression }: Required<Pick<JamSetup, 'key' | 'tempo' | 'progression'>>): string {
  const parts = [key, `${tempo} bpm`, progressionName(progression)];
  return parts.join(SEPARATOR);
}

export function mixSummary(mixer: Pick<Mixer, 'plays' | 'level'>): string {
  const playing = `I play ${mixer.plays}`;
  const mutedParts = MIXER_PARTS.filter(part => mixer.level(part).muted);
  if (!mutedParts.length) return playing;
  const muted = `${mutedParts.join(', ')} muted`;
  return [playing, muted].join(SEPARATOR);
}
