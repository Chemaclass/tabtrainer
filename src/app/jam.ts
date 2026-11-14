import { parseGroove, type Groove } from '../core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../core/grooveTimeline';
import { keyTonic } from '../core/harmony';
import { isFamily, type Family } from '../core/instruments';
import { pref, setPref, type JamChoice } from './storage';

export interface BundledGroove { slug: string; groove: Groove }

export const JAM_TEMPO = { min: 40, max: 220 } as const;
const MAJOR_KEYS: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS: readonly string[] = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const grooveSlug = (path: string) => (path.split('/').pop() ?? '').replace(/\.txt$/, '').replace(/^\d+-/, '');

export function bundledGrooves(files: Record<string, string>): BundledGroove[] {
  return Object.keys(files).sort().map(path => ({ slug: grooveSlug(path), groove: parseGroove(files[path]).groove }));
}

export const jamKeys = (groove: Groove): readonly string[] => (groove.key.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS);

function jamKey(groove: Groove, key: string): string {
  const keys = jamKeys(groove);
  if (keys.includes(key)) return key;
  const tonic = keyTonic(key) ?? keyTonic(groove.key);
  return keys.find(k => keyTonic(k) === tonic) ?? keys[0];
}

const jamTempo = (bpm: number) => Math.round(Math.min(JAM_TEMPO.max, Math.max(JAM_TEMPO.min, bpm)));

export class Jam {
  private index = 0;
  private chosenKey = '';
  private chosenTempo = 0;

  constructor(private grooves: readonly BundledGroove[]) {
    if (!grooves.length) throw new Error('No bundled grooves');
    this.load();
  }

  get slug() { return this.grooves[this.index].slug; }
  get groove() { return this.grooves[this.index].groove; }
  get key() { return this.chosenKey; }
  get tempo() { return this.chosenTempo; }
  get keys() { return jamKeys(this.groove); }

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
    const tempo = jamTempo(bpm);
    if (tempo === this.chosenTempo) return false;
    this.chosenTempo = tempo;
    this.save();
    return true;
  }

  timeline(): GrooveTimeline { return buildGrooveTimeline(this.groove, this.chosenKey); }

  private load() {
    const saved: unknown = Object.hasOwn(pref('jam', {}), this.slug) ? pref('jam', {})[this.slug] : null;
    const { key, tempo } = saved && typeof saved === 'object' ? saved as JamChoice : {};
    this.chosenKey = jamKey(this.groove, typeof key === 'string' ? key : this.groove.key);
    this.chosenTempo = jamTempo(typeof tempo === 'number' && Number.isFinite(tempo) ? tempo : this.groove.tempo);
  }

  private save() { setPref('jam', { ...pref('jam', {}), [this.slug]: { key: this.chosenKey, tempo: this.chosenTempo } }); }
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
