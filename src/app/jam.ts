import { BACKING_PARTS, parseGroove, type BackingPart, type Groove } from '../core/groove';
import { buildGrooveTimeline, type GrooveTimeline } from '../core/grooveTimeline';
import { OWN_PROGRESSION, isMinorProgression, keyTonic, type Numeral } from '../core/harmony';
import type { Family } from '../core/instruments';
import { currentLoopSlug, isMoodId, jamProgression, moodById, moodFits, type Mood, type MoodId } from '../core/moods';
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
  /** Whether the player set the tempo by hand on this groove; a reload restores it, a mood chip moving to the groove does not. */
  private ownTempo = false;
  private chosenProgression = OWN_PROGRESSION;
  private chosenSwing: number = JAM_SWING.min;
  private chosenScale: ScaleId | null = null;
  private chosenMood: MoodId | null = null;

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
  get mood(): Mood | null { return this.chosenMood ? moodById(this.chosenMood) : null; }
  /** What a link carries; the mood only while one is on, so a link without a mood stays as it was. */
  get setup(): JamSetup & Required<Omit<JamSetup, 'mood'>> {
    const setup = { key: this.chosenKey, tempo: this.chosenTempo, progression: this.chosenProgression, swing: this.chosenSwing };
    return this.chosenMood ? { mood: this.chosenMood, ...setup } : setup;
  }
  get keys(): readonly string[] {
    if (this.chosenProgression === OWN_PROGRESSION) return jamKeys(this.groove);
    return isMinorProgression(this.chords()) ? MINOR_KEYS : MAJOR_KEYS;
  }
  get scales(): ScaleId[] {
    const minorKey = isMinorKey(this.chosenKey);
    const bluesy = BLUESY_GENRES.has(this.groove.genre);
    const fitting = fittingScales({ minorKey, bluesy });
    const { mood } = this;
    if (!mood) return fitting;
    return [...new Set([mood.scale, ...mood.alsoScales, ...fitting])];
  }
  /** The chosen scale while it fits the key, otherwise the usual scale of the groove. */
  get scale(): ScaleId {
    const scales = this.scales;
    if (this.chosenScale && scales.includes(this.chosenScale)) return this.chosenScale;
    return scales[0];
  }

  /** Opens a groove with its own saved setup, mood included. */
  choose(slug: string): boolean {
    const found = this.find(slug);
    if (!found || found === this.current) return false;
    this.current = found;
    this.load();
    return true;
  }

  /** A groove the player picks from the list keeps what is on now: the mood, even on a genre that does not fit, or Free. */
  pickGroove(slug: string): boolean {
    const carried = this.chosenMood;
    if (!this.choose(slug)) return false;
    if (carried) this.applyMood(carried, 'clamp');
    else if (this.chosenMood) this.clearMood();
    return true;
  }

  /** The groove a mood chip moves to opens at the mood's starting tempo, whatever tempo was set by hand there before. */
  chooseForMood(slug: string): boolean {
    if (!this.choose(slug)) return false;
    this.ownTempo = false;
    return true;
  }

  /** Whether what plays now, a draft included, has a genre that fits the mood. */
  fitsMood(id: MoodId): boolean {
    return moodFits(moodById(id), this.groove.genre);
  }

  /**
   * The groove a mood plays on: the first groove of its best genre, so a mood sounds the same whatever was open.
   * The player's own groove or an unsaved draft stays when its genre fits, and so does a groove of the best genre.
   */
  grooveFor(id: MoodId): string {
    const mood = moodById(id);
    const ownWork = this.entry.mine || this.previewing;
    if (this.groove.genre === mood.genres[0] || (ownWork && this.fitsMood(id))) return this.slug;
    for (const genre of mood.genres) {
      const fitting = this.grooves.find(entry => entry.groove.genre === genre);
      if (fitting) return fitting.slug;
    }
    return this.slug;
  }

  /**
   * Sets the mood's chords, key mode, tempo and scale, keeping the tonic and any loop of the mood that plays.
   * From a chip the mood starts at its own tempo, unless the player set one by hand inside its range.
   * With "clamp", for a groove picked by hand, a tempo inside the range stays and one outside it becomes the groove's own, held inside the range.
   */
  applyMood(id: MoodId, tempo: 'start' | 'clamp' = 'start'): boolean {
    const mood = moodById(id);
    const playsLoop = this.playsLoopOf(mood);
    if (this.chosenMood === id && playsLoop) return false;
    this.chosenMood = id;
    if (!playsLoop) this.chosenProgression = mood.loops[0].slug;
    this.chosenKey = jamKey(this.keys, this.chosenKey, this.groove.key);
    const keepsTempo = within(this.chosenTempo, mood.tempo) && (this.ownTempo || tempo === 'clamp');
    if (!keepsTempo) {
      this.chosenTempo = tempo === 'start' ? mood.tempo.start : clamp(this.groove.tempo, mood.tempo);
      this.ownTempo = false;
    }
    this.chosenScale = null;
    this.save();
    return true;
  }

  /** Drops the mood and gives back the groove's own chords, keeping the home note and the tempo. */
  clearMood(): boolean {
    if (!this.chosenMood) return false;
    this.chosenMood = null;
    this.chosenProgression = OWN_PROGRESSION;
    this.chosenScale = null;
    this.chosenKey = jamKey(this.keys, this.chosenKey, this.groove.key);
    this.save();
    return true;
  }

  /** Plays the mood's next loop, back to the first after the last. */
  nextMoodLoop(): boolean {
    const { mood } = this;
    if (!mood || mood.loops.length < 2) return false;
    const index = mood.loops.findIndex(loop => loop.slug === this.chosenProgression);
    return this.setProgression(mood.loops[(index + 1) % mood.loops.length].slug);
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
    const { mood, key, tempo, progression, swing } = setup;
    const chords = this.linkedChords(mood, progression);
    const linkedTempo = within(tempo, JAM_TEMPO);
    const changes = [
      chords !== null && this.playProgression(chords),
      key !== undefined && this.setKey(this.keyWithTonicOf(key)),
      linkedTempo && this.placeTempo(tempo, false),
      within(swing, JAM_SWING) && this.setSwing(swing),
      mood !== undefined && this.labelMood(mood),
    ];
    const { mood: linkedMood } = this;
    const startsMood = !linkedTempo && linkedMood !== null && linkedMood.id === mood && this.placeTempo(linkedMood.tempo.start, false);
    return moved || changes.includes(true) || startsMood;
  }

  setKey(key: string): boolean {
    if (!this.keys.includes(key) || key === this.chosenKey) return false;
    this.chosenKey = key;
    this.save();
    return true;
  }

  /** The player's own tempo, from the slider or the tempo keys. */
  setTempo(bpm: number): boolean {
    return this.placeTempo(bpm, true);
  }

  private placeTempo(bpm: number, own: boolean): boolean {
    if (!Number.isFinite(bpm)) return false;
    const tempo = clamp(bpm, JAM_TEMPO);
    if (tempo === this.chosenTempo) return false;
    this.chosenTempo = tempo;
    this.ownTempo = own;
    this.save();
    return true;
  }

  /** A mood owns its chords, so with one on only its loops play. */
  setProgression(slug: string): boolean {
    const { mood } = this;
    if (mood && !mood.loops.some(loop => loop.slug === slug)) return false;
    return this.playProgression(slug);
  }

  /** The chords a link names, or the first loop of a linked mood that names none it can play. */
  private linkedChords(mood: string | undefined, progression: string | undefined): string | null {
    const linkedMood = isMoodId(mood) ? moodById(mood) : null;
    const slug = progression === undefined ? null : currentLoopSlug(progression, linkedMood?.id ?? null);
    if (slug !== null && jamProgression(slug, this.groove.progression)) return slug;
    if (!linkedMood || this.playsLoopOf(linkedMood)) return null;
    return linkedMood.loops[0].slug;
  }

  private playProgression(slug: string): boolean {
    if (slug === this.chosenProgression || !jamProgression(slug, this.groove.progression)) return false;
    this.chosenProgression = slug;
    this.dropMoodUnlessPlaying();
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

  /** A linked mood names the chords the link plays, or none at all when they are not its own. */
  private labelMood(value: string): boolean {
    if (!isMoodId(value)) return false;
    const next = this.playsLoopOf(moodById(value)) ? value : null;
    if (next === this.chosenMood) return false;
    this.chosenMood = next;
    if (next) this.chosenScale = null;
    this.save();
    return true;
  }

  private playsLoopOf(mood: Mood): boolean {
    return mood.loops.some(loop => loop.slug === this.chosenProgression);
  }

  /** A mood stays on only while its chords play. */
  private dropMoodUnlessPlaying() {
    const { mood } = this;
    if (mood && !this.playsLoopOf(mood)) this.chosenMood = null;
  }

  private followChangedHeaders(before: Groove, after: Groove) {
    if (progressionText(after) !== progressionText(before)) this.chosenProgression = OWN_PROGRESSION;
    this.dropMoodUnlessPlaying();
    const wantedKey = after.key === before.key ? this.chosenKey : after.key;
    this.chosenKey = jamKey(this.keys, wantedKey, after.key);
    if (after.tempo !== before.tempo) {
      this.chosenTempo = clamp(after.tempo, JAM_TEMPO);
      this.ownTempo = false;
    }
    if (after.swing !== before.swing) this.chosenSwing = clamp(after.swing, JAM_SWING);
  }

  /** The offered key on the same tonic, so a shared "C#" opens as "Db" where the list spells it so. */
  private keyWithTonicOf(key: string): string {
    return keyOnTonic(this.keys, keyTonic(key)) ?? key;
  }

  private chords(): Numeral[] {
    return jamProgression(this.chosenProgression, this.groove.progression) ?? [...this.groove.progression];
  }

  private savedChoice(): JamChoice {
    const saved = pref('jam', {});
    const choice: unknown = Object.hasOwn(saved, this.slug) ? saved[this.slug] : null;
    return choice && typeof choice === 'object' ? choice as JamChoice : {};
  }

  private load() {
    this.draft = null;
    const { key, tempo, progression, swing, scale, mood, ownTempo } = this.savedChoice();
    const { groove } = this;
    const current = typeof progression === 'string' ? currentLoopSlug(progression, isMoodId(mood) ? mood : null) : null;
    const isOffered = current !== null && jamProgression(current, groove.progression);
    this.chosenProgression = isOffered ? current : OWN_PROGRESSION;
    this.chosenMood = isMoodId(mood) ? mood : null;
    this.dropMoodUnlessPlaying();
    this.chosenKey = jamKey(this.keys, typeof key === 'string' ? key : groove.key, groove.key);
    this.chosenTempo = clamp(isFiniteNumber(tempo) ? tempo : groove.tempo, JAM_TEMPO);
    this.ownTempo = isFiniteNumber(tempo) && ownTempo === true;
    this.chosenSwing = clamp(isFiniteNumber(swing) ? swing : groove.swing, JAM_SWING);
    this.chosenScale = isScaleId(scale) ? scale : null;
  }

  private save() {
    // A draft is not saved yet, so its choices would land on the groove it replaces
    if (this.draft) return;
    const choice = { ...this.setup, scale: this.chosenScale ?? undefined, mood: this.chosenMood ?? undefined, ownTempo: this.ownTempo || undefined };
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
  private parts: Record<MixerPart, PartLevel>;
  private roomOn: boolean;

  constructor(family: Family = pref('family', 'bass')) {
    const saved = pref('jamMixer', {});
    this.player = family;
    const parts: Partial<Record<string, unknown>> = saved.parts && typeof saved.parts === 'object' ? saved.parts : {};
    const level = (part: MixerPart) => savedLevel(parts, part, this.player);
    this.parts = { drums: level('drums'), bass: level('bass'), keys: level('keys') };
    if (saved.plays !== family) this.parts.bass.muted = mutedByDefault('bass', family);
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
    this.player = family;
    this.parts.bass.muted = mutedByDefault('bass', family);
    this.save();
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

  private save() {
    setPref('jamMixer', { plays: this.player, parts: this.parts, room: this.roomOn });
  }
}
