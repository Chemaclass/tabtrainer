import { parseGroove, type Groove } from '../core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../core/grooveTimeline';
import { keyTonic } from '../core/harmony';
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
