import { parseGroove, type Groove } from '../core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../core/grooveTimeline';
import { OWN_PROGRESSION, isMinorProgression, keyTonic, presetProgression, type Numeral } from '../core/harmony';
import { isFamily, type Family } from '../core/instruments';
import { pref, setPref, type JamChoice } from './storage';

export interface BundledGroove { slug: string; groove: Groove }

export const JAM_TEMPO = { min: 40, max: 220 } as const;
export const JAM_SWING = { min: 50, max: 66 } as const;
const MAJOR_KEYS: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS: readonly string[] = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const grooveSlug = (path: string) => (path.split('/').pop() ?? '').replace(/\.txt$/, '').replace(/^\d+-/, '');

export function bundledGrooves(files: Record<string, string>): BundledGroove[] {
  return Object.keys(files).sort().map(path => ({ slug: grooveSlug(path), groove: parseGroove(files[path]).groove }));
}

function byGenre(grooves: readonly BundledGroove[]): BundledGroove[] {
  const genres = [...new Set(grooves.map(g => g.groove.genre))];
  return genres.flatMap(genre => grooves.filter(g => g.groove.genre === genre));
}

export const jamKeys = (groove: Groove): readonly string[] => (groove.key.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS);

function jamKey(keys: readonly string[], key: string, fallback: string): string {
  if (keys.includes(key)) return key;
  const tonic = keyTonic(key) ?? keyTonic(fallback);
  return keys.find(k => keyTonic(k) === tonic) ?? keys[0];
}

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.round(Math.min(max, Math.max(min, value)));
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export class Jam {
  private grooves: readonly BundledGroove[];
  private index = 0;
  private chosenKey = '';
  private chosenTempo = 0;
  private chosenProgression = OWN_PROGRESSION;
  private chosenSwing: number = JAM_SWING.min;

  constructor(grooves: readonly BundledGroove[]) {
    if (!grooves.length) throw new Error('No bundled grooves');
    this.grooves = byGenre(grooves);
    this.load();
  }

  get list(): readonly BundledGroove[] { return this.grooves; }
  get slug() { return this.grooves[this.index].slug; }
  get groove() { return this.grooves[this.index].groove; }
  get key() { return this.chosenKey; }
  get tempo() { return this.chosenTempo; }
  get progression() { return this.chosenProgression; }
  get swing() { return this.chosenSwing; }
  get keys(): readonly string[] {
    if (this.chosenProgression === OWN_PROGRESSION) return jamKeys(this.groove);
    return isMinorProgression(this.chords()) ? MINOR_KEYS : MAJOR_KEYS;
  }

  choose(slug: string): boolean {
    const index = this.grooves.findIndex(g => g.slug === slug);
    if (index < 0 || index === this.index) return false;
    this.index = index;
    this.load();
    return true;
  }

  setKey(key: string): boolean {
    if (!this.keys.includes(key) || key === this.chosenKey) return false;
    this.chosenKey = key;
    this.save();
    return true;
  }

  setTempo(bpm: number): boolean {
    if (!Number.isFinite(bpm)) return false;
    const tempo = clamp(bpm, JAM_TEMPO);
    if (tempo === this.chosenTempo) return false;
    this.chosenTempo = tempo;
    this.save();
    return true;
  }

  setProgression(slug: string): boolean {
    if (slug === this.chosenProgression || !presetProgression(slug, this.groove.progression)) return false;
    this.chosenProgression = slug;
    this.chosenKey = jamKey(this.keys, this.chosenKey, this.groove.key);
    this.save();
    return true;
  }

  setSwing(swing: number): boolean {
    if (!Number.isFinite(swing)) return false;
    const next = clamp(swing, JAM_SWING);
    if (next === this.chosenSwing) return false;
    this.chosenSwing = next;
    this.save();
    return true;
  }

  timeline(): GrooveTimeline {
    return buildGrooveTimeline({ ...this.groove, progression: this.chords(), swing: this.chosenSwing }, this.chosenKey);
  }

  private chords(): Numeral[] {
    return presetProgression(this.chosenProgression, this.groove.progression) ?? [...this.groove.progression];
  }

  private load() {
    const saved: unknown = Object.hasOwn(pref('jam', {}), this.slug) ? pref('jam', {})[this.slug] : null;
    const { key, tempo, progression, swing } = saved && typeof saved === 'object' ? saved as JamChoice : {};
    this.chosenProgression = typeof progression === 'string' && presetProgression(progression, this.groove.progression) ? progression : OWN_PROGRESSION;
    this.chosenKey = jamKey(this.keys, typeof key === 'string' ? key : this.groove.key, this.groove.key);
    this.chosenTempo = clamp(isFiniteNumber(tempo) ? tempo : this.groove.tempo, JAM_TEMPO);
    this.chosenSwing = clamp(isFiniteNumber(swing) ? swing : this.groove.swing, JAM_SWING);
  }

  private save() {
    const choice = { key: this.chosenKey, tempo: this.chosenTempo, progression: this.chosenProgression, swing: this.chosenSwing };
    setPref('jam', { ...pref('jam', {}), [this.slug]: choice });
  }
}

export const MIXER_PARTS = ['drums', 'bass', 'keys'] as const;
export type MixerPart = typeof MIXER_PARTS[number];
export interface PartLevel { volume: number; muted: boolean }

const FULL_VOLUME = 100;
const isVolume = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= FULL_VOLUME;

export class Mixer {
  private player: Family;
  private chosen: boolean;
  private parts: Record<MixerPart, PartLevel>;

  constructor(library: Family = pref('family', 'bass')) {
    const saved = pref('jamMixer', {});
    const plays = typeof saved.plays === 'string' && isFamily(saved.plays) ? saved.plays : null;
    this.chosen = plays !== null;
    this.player = plays ?? library;
    const parts: Partial<Record<string, unknown>> = saved.parts && typeof saved.parts === 'object' ? saved.parts : {};
    const level = (part: MixerPart): PartLevel => {
      const raw: unknown = Object.hasOwn(parts, part) ? parts[part] : null;
      const { volume, muted } = raw && typeof raw === 'object' ? raw as Partial<Record<keyof PartLevel, unknown>> : {};
      return {
        volume: isVolume(volume) ? Math.round(volume) : FULL_VOLUME,
        muted: typeof muted === 'boolean' ? muted : part === 'bass' && this.player === 'bass',
      };
    };
    this.parts = { drums: level('drums'), bass: level('bass'), keys: level('keys') };
  }

  get plays() { return this.player; }

  level(part: MixerPart): PartLevel { return { ...this.parts[part] }; }

  gain(part: MixerPart): number { return this.parts[part].muted ? 0 : this.parts[part].volume / FULL_VOLUME; }

  setPlays(family: Family): boolean {
    if (family === this.player) return false;
    this.player = family;
    this.parts.bass.muted = family === 'bass';
    this.save();
    return true;
  }

  followLibrary(family: Family): boolean {
    if (this.chosen || family === this.player) return false;
    this.player = family;
    this.parts.bass.muted = family === 'bass';
    return true;
  }

  setMuted(part: MixerPart, muted: boolean): boolean {
    if (this.parts[part].muted === muted) return false;
    this.parts[part].muted = muted;
    this.save();
    return true;
  }

  setVolume(part: MixerPart, volume: number): boolean {
    if (!Number.isFinite(volume)) return false;
    const next = Math.round(Math.min(FULL_VOLUME, Math.max(0, volume)));
    if (next === this.parts[part].volume) return false;
    this.parts[part].volume = next;
    this.save();
    return true;
  }

  private save() { this.chosen = true; setPref('jamMixer', { plays: this.player, parts: this.parts }); }
}
