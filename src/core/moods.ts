import { PROGRESSION_PRESETS, TWELVE_BAR_BLUES, numerals, presetProgression, type Numeral } from './harmony';
import { scaleNotes, type ScaleId } from './scales';
import { ACCIDENTAL_SHIFTS, MAJOR_SCALE, OCTAVE, letterName, pitchClass, pitchClassOf } from './theory';

export type MoodId = 'happy' | 'sad' | 'melancholic' | 'exciting' | 'epic' | 'dark' | 'tense' | 'dreamy' | 'bluesy' | 'funky';

export interface MoodLoop {
  slug: string;
  /** A plain name, unique inside its mood. */
  name: string;
  bars: string;
  /** What the chord of each bar does, true in every key. */
  jobs: readonly string[];
}

export type TempoWord = 'Slow' | 'Medium' | 'Fast';

export interface MoodTempo {
  min: number;
  max: number;
  /** Where a mood picked from its chip starts. */
  start: number;
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

type MoodEntry = Omit<Mood, 'loops'> & { loops: readonly Omit<MoodLoop, 'slug'>[] };

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
      {
        name: 'Lift and return',
        bars: 'I V vi IV I V IV V',
        jobs: ['Home. Bright and settled.', 'Lifts away from home.', 'A touch of shade.', 'Opens up.', 'Home again.', 'Lifts away again.', 'Opens up wider.', 'Pulls hard back home.'],
      },
      {
        name: 'Home and away',
        bars: 'I IV I V vi IV I V',
        jobs: ['Home. Bright and settled.', 'Steps away and opens up.', 'Back home.', 'Pulls back home.', 'Lands in shade instead.', 'Opens up.', 'Home for a moment.', 'Pulls hard back home.'],
      },
      {
        name: 'Shade and sun',
        bars: 'I vi IV V I vi ii V',
        jobs: ['Home. Bright and settled.', 'A touch of shade.', 'Opens up.', 'Pulls back home.', 'Home again.', 'Shade again.', 'A softer step before the pull.', 'Pulls hard back home.'],
      },
    ],
    tempo: { min: 100, max: 140, start: 120, word: 'Medium', outside: 'Slower and it turns calm' },
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
      {
        name: 'Sink and rise',
        bars: 'i bVI bIII bVII i bVI iv v',
        jobs: ['Home. Minor, so it starts low.', 'A major chord that sinks below home.', 'A moment of light.', 'Leads back home.', 'Home again.', 'Sinks below home again.', 'Sinks deeper.', 'A soft pull back home.'],
      },
      {
        name: 'Deeper each time',
        bars: 'i iv i v bVI bIII iv v',
        jobs: ['Home. Minor, so it starts low.', 'Sinks deeper.', 'Back home.', 'A soft pull back home.', 'A warm major chord instead.', 'A moment of light.', 'Sinks again.', 'A soft pull back home.'],
      },
      {
        name: 'Walking down',
        bars: 'i bVII bVI bVII i bVII bVI v',
        jobs: ['Home. Minor, so it starts low.', 'Steps down.', 'Steps down again.', 'Steps back up.', 'Home again.', 'Steps down.', 'Steps down again.', 'A soft pull back home.'],
      },
    ],
    tempo: { min: 56, max: 88, start: 66, word: 'Slow', outside: 'Faster and it turns restless' },
    genres: ['ballad', 'rock'],
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
      {
        name: 'Wistful steps',
        bars: 'I iii IV iv I vi IV iv',
        jobs: ['Home. Bright and settled.', 'A gentle, wistful step.', 'Opens up.', 'The same chord turns minor.', 'Home again, but changed.', 'A touch of shade.', 'Opens up.', 'Turns minor and sighs home.'],
      },
      {
        name: 'Changed home',
        bars: 'I IV iv I vi IV iv V',
        jobs: ['Home. Bright and settled.', 'Opens up.', 'The same chord turns minor.', 'Home again, but changed.', 'A touch of shade.', 'Opens up.', 'Turns minor again.', 'Pulls back home.'],
      },
      {
        name: 'Soft and warm',
        bars: 'Imaj7 vi7 IV iv Imaj7 iii IV iv',
        jobs: ['Home, soft and warm.', 'A touch of shade.', 'Opens up.', 'The same chord turns minor.', 'Home, soft and warm.', 'A gentle, wistful step.', 'Opens up.', 'Turns minor and sighs home.'],
      },
    ],
    tempo: { min: 60, max: 96, start: 72, word: 'Slow', outside: 'Faster and it starts to sound happy' },
    genres: ['ballad', 'bossa'],
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
      {
        name: 'Drive and climb',
        bars: 'I I bVII IV I I IV bVII',
        jobs: ['Home. Bright with grit.', 'Stays home and drives.', 'Drops one step down.', 'Opens up.', 'Back home with a punch.', 'Drives on.', 'Opens up, starting the climb.', 'One step below, climbing home.'],
      },
      {
        name: 'Punch and climb',
        bars: 'I bVII IV I I bVII IV bVII',
        jobs: ['Home. Bright with grit.', 'One step down, ready to push.', 'Opens up.', 'Back home with a punch.', 'Home again.', 'One step down again.', 'Opens up.', 'Climbs back home.'],
      },
      {
        name: 'Swing and hold',
        bars: 'I IV bVII IV I IV bVII bVII',
        jobs: ['Home. Bright with grit.', 'Opens up.', 'One step below home.', 'Swings back toward home.', 'Home again.', 'Opens up.', 'One step below home.', 'Holds there, then climbs home.'],
      },
    ],
    tempo: { min: 120, max: 176, start: 148, word: 'Fast', outside: 'Slower and it loses its push' },
    genres: ['rock', 'metal'],
    note: { degree: 'b7', label: 'the exciting note', contrast: 'not one' },
    why: 'Bright like a happy tune, with one gritty note two frets below home. The chord on that note climbs straight up into home, so the loop keeps charging ahead.',
  },
  {
    id: 'epic',
    name: 'Epic',
    scale: 'minor',
    alsoScales: [],
    progressions: ['i bVI bVII', 'i bVII bVI bVII'],
    loops: [
      {
        name: 'Build and climb',
        bars: 'i i bVI bVII i bIII bVI bVII',
        jobs: ['Home. Minor and heavy.', 'Stays home, building up.', 'A big major chord.', 'Climbs one step higher.', 'Lands back home.', 'Lifts to a bright chord.', 'The big major chord again.', 'Climbs back home.'],
      },
      {
        name: 'Break out',
        bars: 'i bVII bVI bVII bIII bVII bVI bVII',
        jobs: ['Home. Minor and heavy.', 'A big chord one step down.', 'Steps down again.', 'Climbs back toward home.', 'Breaks out to a bright chord.', 'Falls to a big chord.', 'Steps down again.', 'Climbs back home.'],
      },
      {
        name: 'Long climb',
        bars: 'i i bVI bVI bIII bIII bVII bVII',
        jobs: ['Home. Minor and heavy.', 'Stays home, building up.', 'A big major chord.', 'Holds it.', 'Lifts to a bright chord.', 'Holds the peak.', 'One step below home.', 'Climbs back home.'],
      },
    ],
    tempo: { min: 120, max: 180, start: 160, word: 'Fast', outside: 'Slower and it turns sad' },
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
      {
        name: 'Hang and fall',
        bars: 'i bII i bII i bII bIII bII',
        jobs: ['Home. Minor and low.', 'One fret up, then falls back.', 'Back home.', 'Hangs over home again.', 'Back home.', 'One fret up again.', 'Climbs a step higher.', 'Falls back, one fret above home.'],
      },
      {
        name: 'Step down',
        bars: 'i bII bvii i iv bIII bII bII',
        jobs: ['Home. Minor and low.', 'One fret above home.', 'Sinks below home.', 'Back home.', 'Jumps up high.', 'Steps down.', 'Steps down, one fret above home.', 'Hangs there, then falls home.'],
      },
      {
        name: 'Low and still',
        bars: 'i i bII bII i i bvii bII',
        jobs: ['Home. Minor and low.', 'Stays low.', 'One fret up.', 'Hangs over home.', 'Falls back home.', 'Stays low.', 'Sinks below home.', 'One fret above, falls home.'],
      },
    ],
    tempo: { min: 80, max: 130, start: 100, word: 'Medium', outside: 'Faster and it turns frantic' },
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
      {
        name: 'Pull and hold',
        bars: 'i iv V7 i bVI iv V7 V7',
        jobs: ['Home. Minor and uneasy.', 'Sinks deeper.', 'Pulls hard back home.', 'Home, but not for long.', 'A warm major chord.', 'Sinks deeper.', 'The pull home starts.', 'Holds the pull, then lets go.'],
      },
      {
        name: 'Uneasy turn',
        bars: 'i bVI V7 i iv iim7b5 V7 V7',
        jobs: ['Home. Minor and uneasy.', 'A warm major chord.', 'Pulls hard back home.', 'Home, but not for long.', 'Sinks deeper.', 'An unstable chord, wanting to move.', 'The pull home starts.', 'Holds the pull, then lets go.'],
      },
      {
        name: 'Back and forth',
        bars: 'i V7 i V7 iv iv V7 V7',
        jobs: ['Home. Minor and uneasy.', 'Pulls back home.', 'Home again.', 'Pulls again.', 'Sinks deeper.', 'Stays down.', 'The pull home starts.', 'Holds the pull, then lets go.'],
      },
    ],
    tempo: { min: 90, max: 140, start: 112, word: 'Medium', outside: 'Slower and the pull home fades' },
    genres: ['rock', 'bossa'],
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
      {
        name: 'Linger',
        bars: 'Imaj7 Imaj7 II II Imaj7 Imaj7 vi II',
        jobs: ['Home, soft and open.', 'Stays and lingers.', 'Floats one step up.', 'Hangs there.', 'Drifts back home.', 'Lingers again.', 'Dips into shade.', 'Floats up, then drifts home.'],
      },
      {
        name: 'Float and drift',
        bars: 'Imaj7 II Imaj7 II vi II Imaj7 II',
        jobs: ['Home, soft and open.', 'Floats one step up.', 'Drifts back home.', 'Floats up again.', 'Dips into shade.', 'Floats up from there.', 'Home for a moment.', 'Floats up, then drifts home.'],
      },
      {
        name: 'Rise and settle',
        bars: 'Imaj7 II iii II Imaj7 II vii II',
        jobs: ['Home, soft and open.', 'Floats one step up.', 'Rises one more step.', 'Settles back down.', 'Home again.', 'Floats up.', 'Slips just below home.', 'Floats up, then drifts home.'],
      },
    ],
    tempo: { min: 70, max: 110, start: 76, word: 'Slow', outside: 'Faster and it stops floating' },
    genres: ['ballad', 'bossa', 'reggae'],
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
        name: '12 bar blues',
        bars: TWELVE_BAR_BLUES,
        jobs: ['Home, already restless.', 'A quick move away.', 'Back home.', 'Home, getting ready to move.', 'Moves away for longer.', 'Stays away.', 'Back home.', 'Home a little longer.', 'Climbs to the peak.', 'Steps down from the peak.', 'Back home.', 'Turns around to start again.'],
      },
      {
        name: 'Minor blues',
        bars: presetBars(MINOR_BLUES),
        jobs: ['Home. Minor and restless.', 'A quick move away.', 'Back home.', 'Home, getting ready to move.', 'Moves away for longer.', 'Stays away.', 'Back home.', 'Home a little longer.', 'Sets up the big pull.', 'Pulls hard back home.', 'Back home.', 'Turns around to start again.'],
      },
    ],
    tempo: { min: 60, max: 130, start: 80, word: 'Medium', outside: 'Faster and it turns into rock and roll' },
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
      {
        name: 'Stay and lift',
        bars: 'i7 i7 i7 IV7 i7 i7 IV7 IV7',
        jobs: ['Home. Minor but bright.', 'Stays home and grooves.', 'Still home.', 'A bright lift, then home.', 'Home again.', 'Stays home and grooves.', 'The bright lift comes early.', 'Holds the lift, then home.'],
      },
      {
        name: 'To and fro',
        bars: 'i7 IV7 i7 IV7 i7 IV7 bVIImaj7 IV7',
        jobs: ['Home. Minor but bright.', 'A bright lift.', 'Back home.', 'A bright lift again.', 'Back home.', 'Lifts again.', 'Drops one step below home.', 'Lifts back toward home.'],
      },
      {
        name: 'Long lift',
        bars: 'i7 i7 IV7 IV7 i7 i7 v7 IV7',
        jobs: ['Home. Minor but bright.', 'Stays home and grooves.', 'A bright lift.', 'Holds the lift.', 'Back home.', 'Stays home and grooves.', 'Steps up high.', 'Slides down, then home.'],
      },
    ],
    tempo: { min: 88, max: 116, start: 98, word: 'Medium', outside: 'Slower and it loses its bounce' },
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

const BARS_PER_ROW = 4;

/** Numerals in rows of four bars, such as ["I I bVII IV", "I I IV bVII"]. */
export function barRows(bars: string): string[] {
  const numerals = bars.split(' ');
  const rows = [];
  for (let start = 0; start < numerals.length; start += BARS_PER_ROW) rows.push(numerals.slice(start, start + BARS_PER_ROW).join(' '));
  return rows;
}

/** A loop the Jam already offers as a preset keeps that preset's slug, so it shows once. */
function moodLoop(id: MoodId, loop: Omit<MoodLoop, 'slug'>): MoodLoop {
  const preset = PROGRESSION_PRESETS.find(p => presetBars(p.slug) === loop.bars);
  return { slug: preset?.slug ?? moodSlug(id, loop.bars), ...loop };
}

export const MOODS: readonly Mood[] = MOOD_ENTRIES.map(entry => ({ ...entry, loops: entry.loops.map(loop => moodLoop(entry.id, loop)) }));

export const isMoodId = (value: unknown): value is MoodId => MOODS.some(mood => mood.id === value);

interface RetiredLoop {
  mood: MoodId;
  slug: string;
  bars: string;
  /** The slug of a Jam preset, which stays a preset when no mood is named. */
  presetSlug?: boolean;
}

/** Old loops, each pointing at the loop that starts with the same bars. */
export const RETIRED_LOOPS: readonly RetiredLoop[] = [
  { mood: 'happy', slug: 'i-v-vi-iv', bars: 'I V vi IV I V IV V', presetSlug: true },
  { mood: 'happy', slug: 'i-iv-v', bars: 'I IV I V vi IV I V', presetSlug: true },
  { mood: 'happy', slug: 'happy-i-vi-iv-v', bars: 'I vi IV V I vi ii V' },
  { mood: 'sad', slug: 'sad-i-bvi-biii-bvii', bars: 'i bVI bIII bVII i bVI iv v' },
  { mood: 'sad', slug: 'sad-i-iv-i-v', bars: 'i iv i v bVI bIII iv v' },
  { mood: 'sad', slug: 'sad-i-iv-bvi-v', bars: 'i iv i v bVI bIII iv v' },
  { mood: 'melancholic', slug: 'melancholic-i-iv-iv-i', bars: 'I IV iv I vi IV iv V' },
  { mood: 'melancholic', slug: 'melancholic-i-iii-iv-iv', bars: 'I iii IV iv I vi IV iv' },
  { mood: 'melancholic', slug: 'melancholic-imaj7-vi7-iv-iv', bars: 'Imaj7 vi7 IV iv Imaj7 iii IV iv' },
  { mood: 'exciting', slug: 'exciting-i-bvii-iv-i', bars: 'I bVII IV I I bVII IV bVII' },
  { mood: 'exciting', slug: 'exciting-i-iv-bvii-iv', bars: 'I IV bVII IV I IV bVII bVII' },
  { mood: 'epic', slug: 'epic-i-bvi-bvii-i', bars: 'i i bVI bVII i bIII bVI bVII' },
  { mood: 'epic', slug: 'epic-i-i-bvi-bvii', bars: 'i i bVI bVII i bIII bVI bVII' },
  { mood: 'epic', slug: 'i-bvii-bvi-bvii', bars: 'i bVII bVI bVII bIII bVII bVI bVII', presetSlug: true },
  { mood: 'dark', slug: 'dark-i-bii-i-bii', bars: 'i bII i bII i bII bIII bII' },
  { mood: 'dark', slug: 'dark-i-bii-bvii-i', bars: 'i bII bvii i iv bIII bII bII' },
  { mood: 'tense', slug: 'tense-i-iv-v7-i', bars: 'i iv V7 i bVI iv V7 V7' },
  { mood: 'tense', slug: 'tense-i-bvi-v7-i', bars: 'i bVI V7 i iv iim7b5 V7 V7' },
  { mood: 'dreamy', slug: 'dreamy-imaj7-imaj7-ii-ii', bars: 'Imaj7 Imaj7 II II Imaj7 Imaj7 vi II' },
  { mood: 'dreamy', slug: 'dreamy-imaj7-ii-imaj7-ii', bars: 'Imaj7 II Imaj7 II vi II Imaj7 II' },
  { mood: 'funky', slug: 'funky-i7-i7-i7-iv7', bars: 'i7 i7 i7 IV7 i7 i7 IV7 IV7' },
  { mood: 'funky', slug: 'funky-i7-iv7-i7-iv7', bars: 'i7 IV7 i7 IV7 i7 IV7 bVIImaj7 IV7' },
];

/** The loop a retired slug now plays; any other slug stays as it is. A Jam preset slug means a mood loop only with that mood named. */
export function currentLoopSlug(slug: string, mood: MoodId | null): string {
  const retired = RETIRED_LOOPS.find(loop => loop.slug === slug && (!loop.presetSlug || loop.mood === mood));
  return retired ? moodSlug(retired.mood, retired.bars) : slug;
}

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
