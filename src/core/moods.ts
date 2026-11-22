import { PROGRESSION_PRESETS, TWELVE_BAR_BLUES, numerals, presetProgression, type Numeral } from './harmony';
import { scaleNotes, type ScaleId } from './scales';
import { ACCIDENTAL_SHIFTS, MAJOR_SCALE, OCTAVE, letterName, pitchClass, pitchClassOf } from './theory';

export type MoodId = 'happy' | 'sad' | 'melancholic' | 'exciting' | 'epic' | 'dark' | 'tense' | 'dreamy' | 'bluesy' | 'funky';

export interface MoodLoop {
  slug: string;
  name: string;
  bars: string;
  /** What the chord of each bar does, true in every key. */
  jobs: readonly string[];
}

export type TempoWord = 'Slow' | 'Medium' | 'Fast';

export interface MoodTempo {
  min: number;
  max: number;
  word: TempoWord;
  outside: string;
}

export interface MoodNote {
  degree: string;
  label: string;
  /** The end of the sentence after the distance from the root, such as "not four". */
  contrast: string;
}

export interface Mood {
  id: MoodId;
  name: string;
  scale: ScaleId;
  /** Other scales that keep the mood note. */
  alsoScales: readonly ScaleId[];
  /** Roman numerals, one chord per bar, as the Fretboard dialog lists them. */
  progressions: readonly string[];
  /** The first is the default. */
  loops: readonly MoodLoop[];
  tempo: MoodTempo;
  /** Groove genres whose bass fits every loop, best first. */
  genres: readonly string[];
  note: MoodNote;
  why: string;
}

type MoodEntry = Omit<Mood, 'loops'> & { loops: readonly Omit<MoodLoop, 'slug' | 'name'>[] };

const MINOR_BLUES = 'minor-blues';
const presetBars = (slug: string) => presetProgression(slug, [])?.map(numeral => numeral.text).join(' ') ?? '';

const MOOD_ENTRIES: readonly MoodEntry[] = [
  {
    id: 'happy',
    name: 'Happy',
    scale: 'major',
    alsoScales: ['major-pentatonic'],
    progressions: ['I V vi IV', 'I IV V'],
    loops: [
      { bars: 'I V vi IV', jobs: ['Home. Bright and settled.', 'Lifts away from home.', 'A touch of shade.', 'Opens up, then leads home.'] },
      { bars: 'I IV I V', jobs: ['Home. Bright and settled.', 'Steps away and opens up.', 'Back home.', 'Pulls hard back home.'] },
      { bars: 'I vi IV V', jobs: ['Home. Bright and settled.', 'A touch of shade.', 'Opens up.', 'Pulls hard back home.'] },
    ],
    tempo: { min: 100, max: 140, word: 'Medium', outside: 'Slower and it turns calm' },
    genres: ['rock', 'bossa'],
    note: { degree: '3', label: 'the happy note', contrast: 'not three' },
    why: 'The note four frets above home sounds bright, so the tune feels open and settled.',
  },
  {
    id: 'sad',
    name: 'Sad',
    scale: 'minor',
    alsoScales: ['minor-pentatonic'],
    progressions: ['i bVI bIII bVII', 'i iv v'],
    loops: [
      { bars: 'i bVI bIII bVII', jobs: ['Home. Minor, so it starts low.', 'A major chord that sinks below home.', 'A moment of light.', 'Leads back home.'] },
      { bars: 'i iv i v', jobs: ['Home. Minor, so it starts low.', 'Sinks deeper.', 'Back home.', 'A soft pull back home.'] },
      { bars: 'i iv bVI v', jobs: ['Home. Minor, so it starts low.', 'Sinks deeper.', 'A warm major chord.', 'A soft pull back home.'] },
    ],
    tempo: { min: 56, max: 88, word: 'Slow', outside: 'Faster and it turns restless' },
    genres: ['rock'],
    note: { degree: 'b3', label: 'the sad note', contrast: 'not four' },
    why: 'The note three frets above home, one fret lower than in a happy tune, makes it sound soft and low.',
  },
  {
    id: 'melancholic',
    name: 'Melancholic',
    scale: 'major',
    alsoScales: [],
    progressions: ['I IV iv', 'I iii IV iv'],
    loops: [
      { bars: 'I IV iv I', jobs: ['Home. Bright and settled.', 'Opens up.', 'The same chord turns minor.', 'Home again, but changed.'] },
      { bars: 'I iii IV iv', jobs: ['Home. Bright and settled.', 'A gentle, wistful step.', 'Opens up.', 'The same chord turns minor.'] },
      { bars: 'Imaj7 vi7 IV iv', jobs: ['Home, soft and warm.', 'A touch of shade.', 'Opens up.', 'The same chord turns minor.'] },
    ],
    tempo: { min: 60, max: 96, word: 'Slow', outside: 'Faster and it starts to sound happy' },
    genres: ['bossa'],
    note: { degree: 'b6', label: 'the melancholic note', contrast: 'not three, and it comes with the minor chord' },
    why: 'A bright major key where one chord turns minor. That chord brings in one note from the minor key, so a happy tune gets one sad note.',
  },
  {
    id: 'exciting',
    name: 'Exciting',
    scale: 'mixolydian',
    alsoScales: [],
    progressions: ['I bVII IV'],
    loops: [
      { bars: 'I bVII IV I', jobs: ['Home. Bright with grit.', 'One step down, ready to push.', 'Opens up.', 'Back home with a punch.'] },
      { bars: 'I IV bVII IV', jobs: ['Home. Bright with grit.', 'Opens up.', 'One step below home.', 'Swings back toward home.'] },
    ],
    tempo: { min: 120, max: 176, word: 'Fast', outside: 'Slower and it loses its push' },
    genres: ['rock', 'metal'],
    note: { degree: 'b7', label: 'the exciting note', contrast: 'not one' },
    why: 'Bright like a happy tune, with a gritty note two frets below home. The chord built on that note keeps pushing back toward home.',
  },
  {
    id: 'epic',
    name: 'Epic',
    scale: 'minor',
    alsoScales: [],
    progressions: ['i bVI bVII', 'i bVII bVI bVII'],
    loops: [
      { bars: 'i bVI bVII i', jobs: ['Home. Minor and heavy.', 'A big major chord.', 'Climbs one step higher.', 'Lands back home.'] },
      { bars: 'i bVII bVI bVII', jobs: ['Home. Minor and heavy.', 'A big chord one step down.', 'Steps down again.', 'Climbs back toward home.'] },
      { bars: 'i i bVI bVII', jobs: ['Home. Minor and heavy.', 'Stays home, building up.', 'A big major chord.', 'Climbs back home.'] },
    ],
    tempo: { min: 120, max: 180, word: 'Fast', outside: 'Slower and it turns sad' },
    genres: ['metal', 'rock'],
    note: { degree: 'b6', label: 'the epic note', contrast: 'not three' },
    why: 'Home is a dark minor chord. Big bright chords built four and two frets below home climb back up to it.',
  },
  {
    id: 'dark',
    name: 'Dark',
    scale: 'phrygian',
    alsoScales: [],
    progressions: ['i bII', 'i bII bvii'],
    loops: [
      { bars: 'i bII i bII', jobs: ['Home. Minor and low.', 'One fret up, then falls back.', 'Back home.', 'Hangs over home again.'] },
      { bars: 'i bII bvii i', jobs: ['Home. Minor and low.', 'One fret above home.', 'Sinks below home.', 'Back home.'] },
    ],
    tempo: { min: 80, max: 130, word: 'Medium', outside: 'Faster and it turns frantic' },
    genres: ['metal', 'rock'],
    note: { degree: 'b2', label: 'the dark note', contrast: 'not two' },
    why: 'One note sits just one fret above home and keeps pulling back down to it.',
  },
  {
    id: 'tense',
    name: 'Tense',
    scale: 'harmonic-minor',
    alsoScales: [],
    progressions: ['i iv V7'],
    loops: [
      { bars: 'i iv V7 i', jobs: ['Home. Minor and uneasy.', 'Sinks deeper.', 'Pulls hard back home.', 'Lands home, and the pull lets go.'] },
      { bars: 'i bVI V7 i', jobs: ['Home. Minor and uneasy.', 'A warm major chord.', 'Pulls hard back home.', 'Lands home, and the pull lets go.'] },
    ],
    tempo: { min: 90, max: 140, word: 'Medium', outside: 'Slower and the pull home fades' },
    genres: ['bossa', 'rock'],
    note: { degree: '7', label: 'the tense note', contrast: 'so it pulls up into it' },
    why: 'One note sits one fret below home and begs to step up into it, so the chord before home pulls hard.',
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    scale: 'lydian',
    alsoScales: [],
    progressions: ['I II', 'Imaj7 II'],
    loops: [
      { bars: 'Imaj7 II Imaj7 II', jobs: ['Home, soft and open.', 'Floats one step up.', 'Drifts back home.', 'Floats up again.'] },
      { bars: 'Imaj7 Imaj7 II II', jobs: ['Home, soft and open.', 'Stays and lingers.', 'Floats one step up.', 'Hangs there, then drifts home.'] },
    ],
    tempo: { min: 70, max: 110, word: 'Slow', outside: 'Faster and it stops floating' },
    genres: ['bossa', 'reggae'],
    note: { degree: '#4', label: 'the dreamy note', contrast: 'not five' },
    why: 'One note sits six frets above home, one fret higher than usual. It floats and never quite settles.',
  },
  {
    id: 'bluesy',
    name: 'Bluesy',
    scale: 'blues',
    alsoScales: [],
    progressions: [TWELVE_BAR_BLUES],
    loops: [
      {
        bars: TWELVE_BAR_BLUES,
        jobs: ['Home, already restless.', 'A quick move away.', 'Back home.', 'Home, getting ready to move.', 'Moves away for longer.', 'Stays away.', 'Back home.', 'Home a little longer.', 'Climbs to the peak.', 'Steps down from the peak.', 'Back home.', 'Turns around to start again.'],
      },
      {
        bars: presetBars(MINOR_BLUES),
        jobs: ['Home. Minor and restless.', 'A quick move away.', 'Back home.', 'Home, getting ready to move.', 'Moves away for longer.', 'Stays away.', 'Back home.', 'Home a little longer.', 'Sets up the big pull.', 'Pulls hard back home.', 'Back home.', 'Turns around to start again.'],
      },
    ],
    tempo: { min: 60, max: 130, word: 'Medium', outside: 'Faster and it turns into rock and roll' },
    genres: ['blues', 'rock'],
    note: { degree: 'b5', label: 'the blue note', contrast: 'one fret below the fifth' },
    why: 'A rough note six frets above home rubs against its neighbour, and every chord carries an extra restless note.',
  },
  {
    id: 'funky',
    name: 'Funky',
    scale: 'dorian',
    alsoScales: [],
    progressions: ['i7 IV7'],
    loops: [
      { bars: 'i7 i7 i7 IV7', jobs: ['Home. Minor but bright.', 'Stays home and grooves.', 'Stays home and grooves.', 'A bright lift, then home.'] },
      { bars: 'i7 IV7 i7 IV7', jobs: ['Home. Minor but bright.', 'A bright lift.', 'Back home.', 'A bright lift again.'] },
    ],
    tempo: { min: 88, max: 116, word: 'Medium', outside: 'Slower and it loses its bounce' },
    genres: ['funk', 'reggae'],
    note: { degree: '6', label: 'the funky note', contrast: 'not four' },
    why: 'A bright note three frets below home lifts the minor home chord, so two chords are enough to keep it moving.',
  },
];

/** A mood's own slug for a progression: the mood id, then the numerals. */
export function moodSlug(id: MoodId, bars: string): string {
  const barsSlug = bars.toLowerCase().replaceAll(' ', '-');
  return `${id}-${barsSlug}`;
}

/** A loop the Jam already offers as a preset keeps that preset's slug and name, so it shows once. */
function moodLoop(id: MoodId, { bars, jobs }: Omit<MoodLoop, 'slug' | 'name'>): MoodLoop {
  const preset = PROGRESSION_PRESETS.find(p => presetBars(p.slug) === bars);
  if (preset) return { slug: preset.slug, name: preset.name, bars, jobs };
  return { slug: moodSlug(id, bars), name: bars, bars, jobs };
}

export const MOODS: readonly Mood[] = MOOD_ENTRIES.map(entry => ({ ...entry, loops: entry.loops.map(loop => moodLoop(entry.id, loop)) }));

export const isMoodId = (value: unknown): value is MoodId => MOODS.some(mood => mood.id === value);

export function moodById(id: MoodId): Mood {
  const mood = MOODS.find(m => m.id === id);
  if (!mood) throw new Error(`Unknown mood "${id}"`);
  return mood;
}

export const moodFits = (mood: Mood, genre: string) => mood.genres.includes(genre);

/** The chords of a Jam progression: a preset, the groove's own, or a mood loop. */
export function jamProgression(slug: string, own: readonly Numeral[]): Numeral[] | null {
  const preset = presetProgression(slug, own);
  if (preset) return preset;
  const loop = MOODS.flatMap(mood => mood.loops).find(l => l.slug === slug);
  return loop ? numerals(loop.bars) : null;
}

const DEGREE = /^(b|#)?([1-7])$/;

/** Semitones above the root and letters above the root's letter for a degree such as "b3" or "#4". */
function degreeSteps(degree: string): { semitones: number; letters: number } {
  const r = DEGREE.exec(degree);
  if (!r) throw new Error(`Unknown degree "${degree}"`);
  const letters = Number(r[2]) - 1;
  return { semitones: pitchClass(MAJOR_SCALE[letters] + (ACCIDENTAL_SHIFTS[r[1] ?? ''] ?? 0)), letters };
}

const FRET_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const HALF_OCTAVE = OCTAVE / 2;

/** "Three frets above A": the shorter way along one string from the root to the note. */
function fretDistance(semitones: number, rootSpelling: string): string {
  const above = semitones <= HALF_OCTAVE;
  const frets = above ? semitones : OCTAVE - semitones;
  const unit = frets === 1 ? 'fret' : 'frets';
  return `${FRET_WORDS[frets]} ${unit} ${above ? 'above' : 'below'} ${rootSpelling}`;
}

export interface MoodNoteText { pitchClass: number; name: string; sentence: string }

/** The mood note in a key, spelled as the fretboard spells it, with the sentence for the legend. */
export function moodNoteText(mood: Mood, rootSpelling: string): MoodNoteText {
  const root = pitchClassOf(rootSpelling);
  if (root === null) throw new Error(`Unknown root "${rootSpelling}"`);
  const { semitones, letters } = degreeSteps(mood.note.degree);
  const pc = pitchClass(root + semitones);
  const inScale = scaleNotes(root, mood.scale, rootSpelling).find(note => note.pitchClass === pc);
  const name = inScale?.name ?? letterName(pc, rootSpelling, letters);
  const sentence = `${name} is ${mood.note.label}. ${fretDistance(semitones, rootSpelling)}, ${mood.note.contrast}.`;
  return { pitchClass: pc, name, sentence };
}
