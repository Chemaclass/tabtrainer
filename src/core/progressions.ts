import { PROGRESSION_PRESETS, chordAt, numerals, presetProgression, type Chord, type Numeral } from './harmony';
import { MOODS, type Mood } from './moods';
import { rootName, scaleById, scaleNotes, type ScaleChord, type ScaleId, type ScaleNote } from './scales';
import { degreeName, isKey, letterName } from './theory';

type Family = 'major' | 'minor' | 'blues' | 'mixolydian';

interface ProgressionEntry { slug: string; name: string; bars: string }

/** A progression the Jam screen already plays, with its name and bars taken from there. */
function jamPreset(slug: string): ProgressionEntry {
  const preset = PROGRESSION_PRESETS.find(p => p.slug === slug);
  const bars = presetProgression(slug, []);
  if (!preset || !bars) throw new Error(`Unknown Jam progression "${slug}"`);
  return { slug, name: preset.name, bars: bars.map(numeral => numeral.text).join(' ') };
}

const PROGRESSIONS: Record<Family, readonly ProgressionEntry[]> = {
  major: [
    { slug: 'major-i-iv-v', name: 'I IV V', bars: 'I IV V' },
    jamPreset('i-v-vi-iv'),
    jamPreset('ii-v-i'),
    { slug: 'major-i-vi-iv-v', name: 'I vi IV V', bars: 'I vi IV V' },
  ],
  minor: [
    { slug: 'minor-i-iv-v', name: 'i iv v', bars: 'i iv v' },
    jamPreset('i-bvii-bvi-bvii'),
    { slug: 'minor-i-bvi-biii-bvii', name: 'i bVI bIII bVII', bars: 'i bVI bIII bVII' },
    { slug: 'minor-ii-v-i', name: 'ii m7b5 V7 i', bars: 'iim7b5 V7 i' },
  ],
  blues: [jamPreset('12-bar-blues')],
  mixolydian: [{ slug: 'mixolydian-i-bvii-iv', name: 'I bVII IV', bars: 'I bVII IV' }],
};

const SCALE_FAMILIES: Partial<Record<ScaleId, Family>> = {
  major: 'major',
  'major-pentatonic': 'major',
  minor: 'minor',
  'minor-pentatonic': 'minor',
  blues: 'blues',
  mixolydian: 'mixolydian',
};

const FAMILY_ENTRIES = Object.values(PROGRESSIONS).flat();

function moodSlug(mood: Mood, bars: string): string {
  const barsSlug = bars.toLowerCase().replaceAll(' ', '-');
  return `${mood.id}-${barsSlug}`;
}

/** A mood progression the scale families already list keeps that entry, so it shows once under one name. */
function moodEntry(mood: Mood, bars: string): ProgressionEntry {
  const known = FAMILY_ENTRIES.find(entry => entry.bars === bars);
  if (known) return known;
  return { slug: moodSlug(mood, bars), name: bars, bars };
}

const moodEntries = (mood: Mood) => mood.progressions.map(bars => moodEntry(mood, bars));

const ALL_ENTRIES = [...FAMILY_ENTRIES, ...MOODS.flatMap(moodEntries)];

export const MOST_BARS = Math.max(...ALL_ENTRIES.map(entry => entry.bars.split(' ').length));

const SLUGS = new Set(ALL_ENTRIES.map(entry => entry.slug));

export const isProgressionSlug = (value: unknown): value is string => typeof value === 'string' && SLUGS.has(value);

export interface ProgressionChord extends ScaleChord { bar: number }

export interface Progression { slug: string; name: string; chords: ProgressionChord[] }

/** The key signature chordAt spells the chords in: the scale's own root spelling, minor when the scale has a minor third. */
export function progressionKey(root: number, id: ScaleId): string {
  const minor = scaleById(id).degrees.includes('b3');
  const key = minor ? `${rootName(root, id)}m` : rootName(root, id);
  if (!isKey(key)) throw new Error(`No key signature for ${key}`);
  return key;
}

const CHORD_ROOT_NAME = /^[A-G][#b]?/;
const LETTERS_PER_THIRD = 2;

/** A chord tone spelled up in thirds from the chord root (G# in E7), with its degree counted from the scale root. */
function chordTone(pitchClass: number, toneIndex: number, chordRootName: string, scaleRootName: string, scale: readonly ScaleNote[]): ScaleNote {
  const scaleNote = scale.find(note => note.pitchClass === pitchClass);
  if (scaleNote) return { ...scaleNote, root: false };
  const name = letterName(pitchClass, chordRootName, toneIndex * LETTERS_PER_THIRD);
  return { pitchClass, name, degree: degreeName(scaleRootName, name), root: false };
}

function progressionChord(numeral: Numeral, chord: Chord, bar: number, scaleRootName: string, scale: readonly ScaleNote[]): ProgressionChord {
  const chordRootName = CHORD_ROOT_NAME.exec(chord.name)?.[0] ?? chord.name;
  const tones = chord.tones.map((pitchClass, toneIndex) => chordTone(pitchClass, toneIndex, chordRootName, scaleRootName, scale));
  return {
    bar,
    step: numeral.step,
    numeral: numeral.text,
    name: chord.name,
    quality: numeral.quality,
    root: tones[0],
    tones,
  };
}

function uniqueBySlug(entries: readonly ProgressionEntry[]): ProgressionEntry[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    if (seen.has(entry.slug)) return false;
    seen.add(entry.slug);
    return true;
  });
}

/** The picked mood's progressions first, then the scale family's, then those of every other mood on the scale. */
function entriesFor(id: ScaleId, mood: Mood | null): ProgressionEntry[] {
  const picked = mood ? moodEntries(mood) : [];
  const family = SCALE_FAMILIES[id];
  const familyEntries = family ? PROGRESSIONS[family] : [];
  const moodsOnScale = MOODS.filter(m => m.scale === id).flatMap(moodEntries);
  return uniqueBySlug([...picked, ...familyEntries, ...moodsOnScale]);
}

export function progressions(root: number, id: ScaleId, mood: Mood | null = null): Progression[] {
  const key = progressionKey(root, id);
  const scaleRootName = rootName(root, id);
  const scale = scaleNotes(root, scaleById(id).chordsFrom ?? id);
  return entriesFor(id, mood).map(({ slug, name, bars }) => {
    const progression = numerals(bars);
    const chords = progression.map((numeral, bar) => progressionChord(numeral, chordAt(progression, key, bar), bar, scaleRootName, scale));
    return { slug, name, chords };
  });
}

/** The next chord with a different root, so a walk always has somewhere to go. */
export function nextChange<T extends { root: { pitchClass: number } }>(chords: readonly T[], bar: number): T | null {
  const current = chords[bar].root.pitchClass;
  for (let ahead = 1; ahead < chords.length; ahead++) {
    const next = chords[(bar + ahead) % chords.length];
    if (next.root.pitchClass !== current) return next;
  }
  return null;
}
