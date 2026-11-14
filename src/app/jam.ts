import { BACKING_PARTS, parseGroove, type BackingPart, type Groove } from '../core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../core/grooveTimeline';
import { OWN_PROGRESSION, isMinorProgression, keyTonic, presetProgression, type Numeral } from '../core/harmony';
import { isFamily, type Family } from '../core/instruments';
import { fittingScales, isScaleId, type ScaleId } from '../core/scales';
import { isMinorKey } from '../core/theory';
import { grooveSlug, mineGrooveSlug, type JamSetup } from './jamLink';
import { pref, setPref, type JamChoice, type Saved } from './storage';

export interface JamGroove { slug: string; groove: Groove; text: string; mine: boolean }

export const JAM_TEMPO = { min: 40, max: 220 } as const;
export const JAM_SWING = { min: 50, max: 66 } as const;
const MAJOR_KEYS: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS: readonly string[] = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const BLUESY_GENRES: ReadonlySet<string> = new Set(['blues', 'rock']);

export const NEW_GROOVE_TEXT = `title: My groove
genre: rock
tempo: 100
key: E
time: 4/4
progression: I IV V IV
kit: rock

hat:   xxxxxxxx
snare: ..X...X.
kick:  X...X.x.
keys:  X-..X-..
bass:  1 - 1 - 5 - 8 -
`;

export function bundledGrooves(files: Record<string, string>): JamGroove[] {
  return Object.keys(files).sort().map(path => {
    const text = files[path];
    return { slug: grooveSlug(path), groove: parseGroove(text).groove, text, mine: false };
  });
}

function mineGroove({ title, text }: Saved): JamGroove {
  const { groove } = parseGroove(text);
  return { slug: mineGrooveSlug(title), groove, text, mine: true };
}

/** A groove plays only when it parses without a single issue, so a half typed line never reaches the speakers. */
export function playableGroove(text: string) {
  const { groove, issues } = parseGroove(text);
  const playable = issues.length ? null : groove;
  return { playable, issues };
}

function progressionText(groove: Groove): string {
  const names = groove.progression.map(numeral => numeral.text);
  return names.join(' ');
}

function byGenre(grooves: readonly JamGroove[]): JamGroove[] {
  const genres = [...new Set(grooves.map(g => g.groove.genre))];
  return genres.flatMap(genre => grooves.filter(g => g.groove.genre === genre));
}

export const jamKeys = (groove: Groove): readonly string[] => (isMinorKey(groove.key) ? MINOR_KEYS : MAJOR_KEYS);

const keyOnTonic = (keys: readonly string[], tonic: number | null) => keys.find(k => keyTonic(k) === tonic);

function jamKey(keys: readonly string[], key: string, fallback: string): string {
  if (keys.includes(key)) return key;
  const tonic = keyTonic(key) ?? keyTonic(fallback);
  return keyOnTonic(keys, tonic) ?? keys[0];
}

interface NumberRange { min: number; max: number }

const within = (value: number | undefined, { min, max }: NumberRange): value is number => value !== undefined && value >= min && value <= max;
const clamp = (value: number, { min, max }: NumberRange) => Math.round(Math.min(max, Math.max(min, value)));
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export class Jam {
  private bundled: readonly JamGroove[];
  private grooves: readonly JamGroove[];
  private current: JamGroove;
  private draft: Groove | null = null;
  private chosenKey = '';
  private chosenTempo = 0;
  private chosenProgression = OWN_PROGRESSION;
  private chosenSwing: number = JAM_SWING.min;
  private chosenScale: ScaleId | null = null;

  constructor(bundled: readonly JamGroove[], private saved: () => readonly Saved[] = () => []) {
    if (!bundled.length) throw new Error('No bundled grooves');
    this.bundled = byGenre(bundled);
    this.grooves = this.withMine();
    this.current = this.grooves[0];
    this.load();
  }

  get list(): readonly JamGroove[] { return this.grooves; }
  get entry(): JamGroove { return this.current; }
  get slug() { return this.current.slug; }
  /** The groove being written while there is a playable draft, otherwise the chosen one. */
  get groove() { return this.draft ?? this.current.groove; }
  get previewing() { return this.draft !== null; }
  get key() { return this.chosenKey; }
  get tempo() { return this.chosenTempo; }
  get progression() { return this.chosenProgression; }
  get swing() { return this.chosenSwing; }
  get setup(): Required<JamSetup> {
    return { key: this.chosenKey, tempo: this.chosenTempo, progression: this.chosenProgression, swing: this.chosenSwing };
  }
  get keys(): readonly string[] {
    if (this.chosenProgression === OWN_PROGRESSION) return jamKeys(this.groove);
    return isMinorProgression(this.chords()) ? MINOR_KEYS : MAJOR_KEYS;
  }
  get scales(): ScaleId[] {
    const minorKey = isMinorKey(this.chosenKey);
    const bluesy = BLUESY_GENRES.has(this.groove.genre);
    return fittingScales({ minorKey, bluesy });
  }
  /** The chosen scale while it fits the key, otherwise the usual scale of the groove. */
  get scale(): ScaleId {
    const scales = this.scales;
    if (this.chosenScale && scales.includes(this.chosenScale)) return this.chosenScale;
    return scales[0];
  }

  choose(slug: string): boolean {
    const found = this.find(slug);
    if (!found || found === this.current) return false;
    this.current = found;
    this.load();
    return true;
  }

  /** Reads the saved grooves again after one is saved or deleted. */
  refreshMine() {
    this.grooves = this.withMine();
    const kept = this.find(this.current.slug);
    if (kept) {
      this.current = kept;
      return;
    }
    this.current = this.grooves[0];
    this.load();
  }

  /** Plays a draft in place of the chosen groove, following each header the player changes. */
  preview(groove: Groove) {
    const before = this.groove;
    this.draft = groove;
    this.followChangedHeaders(before, groove);
  }

  /** Makes a just saved draft the chosen groove, keeping and remembering the setup it plays with. */
  keepDraftAs(slug: string): boolean {
    const saved = this.find(slug);
    if (!saved) return false;
    this.current = saved;
    this.draft = null;
    this.save();
    return true;
  }

  endPreview(): boolean {
    if (!this.draft) return false;
    this.load();
    return true;
  }

  open(slug: string, setup: JamSetup = {}): boolean {
    const moved = this.choose(slug);
    if (this.slug !== slug) return moved;
    const { key, tempo, progression, swing } = setup;
    const changes = [
      progression !== undefined && this.setProgression(progression),
      key !== undefined && this.setKey(this.keyWithTonicOf(key)),
      within(tempo, JAM_TEMPO) && this.setTempo(tempo),
      within(swing, JAM_SWING) && this.setSwing(swing),
    ];
    return moved || changes.includes(true);
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

  setScale(id: ScaleId): boolean {
    if (!this.scales.includes(id) || id === this.scale) return false;
    this.chosenScale = id;
    this.save();
    return true;
  }

  timeline(): GrooveTimeline {
    return buildGrooveTimeline({ ...this.groove, progression: this.chords(), swing: this.chosenSwing }, this.chosenKey);
  }

  private find(slug: string): JamGroove | undefined {
    return this.grooves.find(entry => entry.slug === slug);
  }

  private withMine(): JamGroove[] {
    const mine = this.saved().map(mineGroove);
    return [...this.bundled, ...mine];
  }

  private followChangedHeaders(before: Groove, after: Groove) {
    if (progressionText(after) !== progressionText(before)) this.chosenProgression = OWN_PROGRESSION;
    const wantedKey = after.key === before.key ? this.chosenKey : after.key;
    this.chosenKey = jamKey(this.keys, wantedKey, after.key);
    if (after.tempo !== before.tempo) this.chosenTempo = clamp(after.tempo, JAM_TEMPO);
    if (after.swing !== before.swing) this.chosenSwing = clamp(after.swing, JAM_SWING);
  }

  /** The offered key on the same tonic, so a shared "C#" opens as "Db" where the list spells it so. */
  private keyWithTonicOf(key: string): string {
    return keyOnTonic(this.keys, keyTonic(key)) ?? key;
  }

  private chords(): Numeral[] {
    return presetProgression(this.chosenProgression, this.groove.progression) ?? [...this.groove.progression];
  }

  private savedChoice(): JamChoice {
    const saved = pref('jam', {});
    const choice: unknown = Object.hasOwn(saved, this.slug) ? saved[this.slug] : null;
    return choice && typeof choice === 'object' ? choice as JamChoice : {};
  }

  private load() {
    this.draft = null;
    const { key, tempo, progression, swing, scale } = this.savedChoice();
    const { groove } = this;
    const isOffered = typeof progression === 'string' && presetProgression(progression, groove.progression);
    this.chosenProgression = isOffered ? progression : OWN_PROGRESSION;
    this.chosenKey = jamKey(this.keys, typeof key === 'string' ? key : groove.key, groove.key);
    this.chosenTempo = clamp(isFiniteNumber(tempo) ? tempo : groove.tempo, JAM_TEMPO);
    this.chosenSwing = clamp(isFiniteNumber(swing) ? swing : groove.swing, JAM_SWING);
    this.chosenScale = isScaleId(scale) ? scale : null;
  }

  private save() {
    // A draft is not saved yet, so its choices would land on the groove it replaces
    if (this.draft) return;
    const choice = { ...this.setup, scale: this.chosenScale ?? undefined };
    setPref('jam', { ...pref('jam', {}), [this.slug]: choice });
  }
}

export const MIXER_PARTS = BACKING_PARTS;
export type MixerPart = BackingPart;
export interface PartLevel { volume: number; muted: boolean }

const FULL_VOLUME = 100;
const VOLUME_RANGE: NumberRange = { min: 0, max: FULL_VOLUME };
const isVolume = (value: unknown): value is number => isFiniteNumber(value) && within(value, VOLUME_RANGE);

/** The bass part starts muted for a bass player, who plays it. */
const mutedByDefault = (part: MixerPart, player: Family) => part === 'bass' && player === 'bass';

function savedLevel(parts: Partial<Record<string, unknown>>, part: MixerPart, player: Family): PartLevel {
  const raw: unknown = Object.hasOwn(parts, part) ? parts[part] : null;
  const { volume, muted } = raw && typeof raw === 'object' ? raw as Partial<Record<keyof PartLevel, unknown>> : {};
  return {
    volume: isVolume(volume) ? Math.round(volume) : FULL_VOLUME,
    muted: typeof muted === 'boolean' ? muted : mutedByDefault(part, player),
  };
}

export class Mixer {
  private player: Family;
  private chosen: boolean;
  private parts: Record<MixerPart, PartLevel>;
  private roomOn: boolean;

  constructor(library: Family = pref('family', 'bass')) {
    const saved = pref('jamMixer', {});
    const plays = typeof saved.plays === 'string' && isFamily(saved.plays) ? saved.plays : null;
    this.chosen = plays !== null;
    this.player = plays ?? library;
    const parts: Partial<Record<string, unknown>> = saved.parts && typeof saved.parts === 'object' ? saved.parts : {};
    const level = (part: MixerPart) => savedLevel(parts, part, this.player);
    this.parts = { drums: level('drums'), bass: level('bass'), keys: level('keys') };
    this.roomOn = typeof saved.room === 'boolean' ? saved.room : true;
  }

  get plays() { return this.player; }

  get room() { return this.roomOn; }

  level(part: MixerPart): PartLevel { return { ...this.parts[part] }; }

  gain(part: MixerPart): number {
    const { muted, volume } = this.parts[part];
    return muted ? 0 : volume / FULL_VOLUME;
  }

  setPlays(family: Family): boolean {
    if (family === this.player) return false;
    this.playAs(family);
    this.save();
    return true;
  }

  followLibrary(family: Family): boolean {
    if (this.chosen || family === this.player) return false;
    this.playAs(family);
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
    const next = clamp(volume, VOLUME_RANGE);
    if (next === this.parts[part].volume) return false;
    this.parts[part].volume = next;
    this.save();
    return true;
  }

  setRoom(on: boolean): boolean {
    if (on === this.roomOn) return false;
    this.roomOn = on;
    this.save();
    return true;
  }

  private playAs(family: Family) {
    this.player = family;
    this.parts.bass.muted = family === 'bass';
  }

  private save() {
    this.chosen = true;
    setPref('jamMixer', { plays: this.player, parts: this.parts, room: this.roomOn });
  }
}
