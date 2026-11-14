import { MOVE_IDS, hasFlatFifth, hasSharpFifth, isMoveId, isWalk, moveShapes, placeMove, type MoveId, type MoveNote, type Walk } from '../core/bassMoves';
import { positionWindows, type FretMark, type FretPosition, type FretWindow, type MarkRole } from '../core/fretboard';
import { QUALITIES } from '../core/harmony';
import { INSTRUMENTS, type Instrument } from '../core/instruments';
import { isMoodId, moodById, type Mood, type MoodId } from '../core/moods';
import { harmonyScaleId, isScaleId, scaleById, scaleChords, scaleNotes, scaleTitle, usesFlats, type ScaleChord, type ScaleId, type ScaleNote } from '../core/scales';
import { MOST_BARS, isProgressionSlug, nextChange, progressions, type Progression, type ProgressionChord } from '../core/progressions';
import { MAJOR_SCALE, OCTAVE, spellPitchClass } from '../core/theory';
import { FIRST_FRET, LAST_FRET, fretMarks, fretboardDescription, isFretLabels, markRole, markedPositions, noteNames, notesByPitchClass, openStringNames, type FretLabels, type MarkedChord } from './fretboardMarks';

export interface FretboardChoice {
  root: number;
  scale: ScaleId;
  instrument: string;
  labels: FretLabels;
  /** Step of the chord in the scale, 0 for the chord on the root. */
  chord: number | null;
  sevenths: boolean;
  /** First fret of the position window; null shows every fret at full strength. */
  position: number | null;
  /** Slug and bar of a progression chord, which replaces the chord of the scale while set. */
  progression: string | null;
  bar: number | null;
  move: MoveId | null;
  /** The mood that set the scale; choosing a scale by hand clears it. */
  mood: MoodId | null;
}

/** The fields an older saved choice may lack, filled in when it loads. */
const LATER_CHOICE_DEFAULTS = { chord: null, sevenths: false, position: null, progression: null, bar: null, move: null, mood: null };

export const DEFAULT_FRETBOARD_CHOICE: FretboardChoice = { root: 0, scale: 'major', instrument: 'bass4', labels: 'names', ...LATER_CHOICE_DEFAULTS };

const LAST_PITCH_CLASS = OCTAVE - 1;
const LAST_SCALE_STEP = MAJOR_SCALE.length - 1;

const isMoodOnScale = (mood: unknown, scale: unknown) => isMoodId(mood) && moodById(mood).scale === scale;

const isIntegerBetween = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

export const isFretboardChoice = (value: unknown): value is FretboardChoice =>
  !!value && typeof value === 'object'
  && 'root' in value && isIntegerBetween(value.root, 0, LAST_PITCH_CLASS)
  && 'scale' in value && isScaleId(value.scale)
  && 'instrument' in value && typeof value.instrument === 'string' && Object.hasOwn(INSTRUMENTS, value.instrument)
  && 'labels' in value && isFretLabels(value.labels)
  && 'chord' in value && (value.chord === null || isIntegerBetween(value.chord, 0, LAST_SCALE_STEP))
  && 'sevenths' in value && typeof value.sevenths === 'boolean'
  && 'position' in value && (value.position === null || isIntegerBetween(value.position, FIRST_FRET, LAST_FRET))
  && 'progression' in value && (value.progression === null || isProgressionSlug(value.progression))
  && 'bar' in value && (value.bar === null || isIntegerBetween(value.bar, 0, MOST_BARS - 1))
  && 'move' in value && (value.move === null || isMoveId(value.move))
  && 'mood' in value && (value.mood === null || isMoodOnScale(value.mood, value.scale));

export const withFretboardDefaults = (value: unknown): unknown =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...LATER_CHOICE_DEFAULTS, ...value } : value;

/** A mood keeps the root and instrument, sets its scale and starts the progression list afresh. */
export function chooseMood(choice: FretboardChoice, id: MoodId): FretboardChoice {
  const withScale = chooseScale(choice, moodById(id).scale);
  return { ...withScale, mood: id };
}

/** Picking the chosen mood again clears it and keeps its scale. */
export function toggleMood(choice: FretboardChoice, id: MoodId): FretboardChoice {
  if (choice.mood === id) return { ...choice, mood: null };
  return chooseMood(choice, id);
}

export function chooseScale(choice: FretboardChoice, scale: ScaleId): FretboardChoice {
  return { ...choice, mood: null, scale, progression: null, bar: null };
}

export const ROOT_OPTIONS = Array.from({ length: OCTAVE }, (_, pc) => {
  const sharp = spellPitchClass(pc, false);
  const flat = spellPitchClass(pc, true);
  return { value: pc, label: sharp === flat ? sharp : `${sharp} / ${flat}` };
});

export interface StringNotes { name: string; text: string }

export interface SheetMove { id: MoveId; name: string; when: string }

export interface ShownMove extends SheetMove {
  notes: MoveNote[] | null;
  /** The nearest position the move fits when it does not fit the current one. */
  fits: FretWindow | null;
  text: string;
}

export interface FretboardSheet {
  instrument: Instrument;
  title: string;
  mood: Mood | null;
  summary: string;
  openNames: string[];
  chords: ScaleChord[];
  progressions: Progression[];
  progression: Progression | null;
  chord: ScaleChord | null;
  next: ProgressionChord | null;
  moves: SheetMove[];
  move: ShownMove | null;
  windows: FretWindow[];
  window: FretWindow | null;
  marks: FretMark[];
  strings: StringNotes[];
  description: string;
}

export function fretboardSheet(choice: FretboardChoice): FretboardSheet {
  const instrument = INSTRUMENTS[choice.instrument];
  const notes = scaleNotes(choice.root, choice.scale);
  const chords = scaleChords(choice.root, choice.scale, choice.sevenths);
  const mood = choice.mood === null ? null : moodById(choice.mood);
  const progressionList = progressions(choice.root, choice.scale, mood);
  const { progression, chord, next } = pickedChord(choice, chords, progressionList);
  const markedChord = chord ? markedChordOf(chord) : null;
  const title = scaleTitle(choice.root, choice.scale);
  const windows = scaleWindows(instrument, notes);
  const window = nearestWindow(windows, choice.position);
  const layout: NeckLayout = {
    instrument,
    openNames: openStringNames(instrument, usesFlats(choice.root, scaleById(choice.scale))),
    byPitch: notesByPitchClass(chord?.tones ?? [], notes),
    window,
    windows,
  };
  const positions = markedPositions(instrument, layout.byPitch);
  const moves = chord ? movesOver(chord, next) : [];
  const picked = moves.find(m => m.id === choice.move);
  const move = chord && picked ? placedMove(choice, picked, chord, next, layout) : null;
  const scaleMarks = fretMarks(positions, {
    notes: layout.byPitch,
    chord: markedChord,
    labels: choice.labels,
    isDimmed: fret => !inWindow(window, fret),
  });
  const windowText = window ? `${lowerWindowLabel(window)} at full strength and the rest dimmed` : null;
  return {
    instrument,
    title,
    mood,
    summary: sheetSummary(title, notes, chord, window),
    openNames: layout.openNames,
    chords,
    progressions: progressionList,
    progression,
    chord,
    next,
    moves,
    move,
    windows,
    window,
    marks: move?.notes ? numberMoveNotes(scaleMarks, move.notes) : scaleMarks,
    strings: stringNotes(layout, positions, choice.labels, markedChord),
    description: fretboardDescription(instrument, title, chord?.name ?? null, windowText),
  };
}

/** What the neck shows: its strings, the notes marked on it and the position window. */
interface NeckLayout {
  instrument: Instrument;
  openNames: string[];
  byPitch: ReadonlyMap<number, ScaleNote>;
  window: FretWindow | null;
  windows: readonly FretWindow[];
}

const OPEN_STRING = 0;

const fretText = (fret: number) => (fret === OPEN_STRING ? 'open' : `fret ${fret}`);

const inWindow = (window: FretWindow | null, fret: number) => !window || (fret >= window.first && fret <= window.last);

const lowerWindowLabel = (window: FretWindow) => windowLabel(window).toLowerCase();

function scaleWindows(instrument: Instrument, notes: readonly ScaleNote[]): FretWindow[] {
  const pitchClasses = notes.map(note => note.pitchClass);
  const windows = positionWindows(instrument.tuning, pitchClasses, FIRST_FRET, LAST_FRET - 1);
  return windows.map(window => ({ first: window.first, last: Math.min(window.last, LAST_FRET) }));
}

function sheetSummary(title: string, notes: readonly ScaleNote[], chord: ScaleChord | null, window: FretWindow | null): string {
  const shown = chord ? `${chord.name} in ${title}: ${noteNames(chord.tones)}` : `${title}: ${noteNames(notes)}`;
  const where = window ? `; ${lowerWindowLabel(window)}` : '';
  return shown + where;
}

function stringNotes(layout: NeckLayout, positions: readonly FretPosition[], labels: FretLabels, markedChord: MarkedChord | null): StringNotes[] {
  const { instrument, openNames, byPitch, window } = layout;
  const roleText: Record<MarkRole, string> = { root: markedChord ? ' chord root' : ' root', tone: ' chord tone', scale: '' };
  const noNotes = window ? 'no notes in this position' : 'no scale notes';
  return instrument.tuning.map((_, stringIndex) => {
    const name = stringName(instrument.tuning, stringIndex, openNames);
    const shown = positions.filter(p => p.stringIndex === stringIndex && inWindow(window, p.fret));
    const frets = shown.map(position => {
      const note = byPitch.get(position.pitchClass)!;
      const degree = labels === 'degrees' ? ` (${note.degree})` : '';
      return `${fretText(position.fret)} ${note.name}${degree}${roleText[markRole(note, markedChord)]}`;
    });
    return { name, text: `${name}: ${frets.length ? frets.join(', ') : noNotes}` };
  });
}

function placedMove(choice: FretboardChoice, move: SheetMove, chord: ScaleChord, next: ProgressionChord | null, layout: NeckLayout): ShownMove {
  const { instrument, openNames, byPitch } = layout;
  const keyNotes = scaleNotes(choice.root, harmonyScaleId(choice.scale)).map(note => note.pitchClass);
  const walk: Walk | null = next ? { from: chord.root.pitchClass, to: next.root.pitchClass, scale: keyNotes } : null;
  const shapes = moveShapes(move.id, QUALITIES[chord.quality], walk);
  const place = (first: number, last: number) => placeMove(instrument.tuning, chord.root.pitchClass, shapes, first, last);
  const spellsWithFlats = move.id === 'approach-above';
  const describe = (note: MoveNote) => {
    const name = byPitch.get(note.pitchClass)?.name ?? spellPitchClass(note.pitchClass, spellsWithFlats);
    return `${note.order} ${stringName(instrument.tuning, note.stringIndex, openNames)} ${fretText(note.fret)} ${name}`;
  };
  return showMove(move, layout, place, describe);
}

function markedChordOf(chord: ScaleChord): MarkedChord {
  const tones = chord.tones.map(tone => tone.pitchClass);
  return { root: chord.root.pitchClass, tones };
}

interface PickedChord { progression: Progression | null; chord: ScaleChord | null; next: ProgressionChord | null }

/** A progression chord wins over a chord of the scale; only a progression chord has a next chord to walk to. */
function pickedChord(choice: FretboardChoice, chords: readonly ScaleChord[], progressionList: readonly Progression[]): PickedChord {
  const progression = progressionList.find(p => p.slug === choice.progression);
  const barChord = progression && choice.bar !== null ? progression.chords[choice.bar] : undefined;
  if (progression && barChord) return { progression, chord: barChord, next: nextChange(progression.chords, barChord.bar) };
  const scaleChord = choice.chord === null ? null : chords[choice.chord] ?? null;
  return { progression: null, chord: scaleChord, next: null };
}

interface MoveWords { fifth: string; arpeggio: string; target: string }

const BEFORE_THE_CHANGE = 'on the last beat before the change';
const PERFECT_FIFTH = 'fifth';

const MOVE_TEXTS: Record<MoveId, (words: MoveWords) => Omit<SheetMove, 'id'>> = {
  'root-fifth': ({ fifth }) => ({
    name: `Root and ${fifth}`,
    when: fifth === PERFECT_FIFTH ? 'Safe under any major or minor chord.' : `Safe here: the ${fifth} is in the chord.`,
  }),
  'root-fifth-octave': ({ fifth }) => ({ name: `Root, ${fifth}, octave`, when: 'Fills a bar and climbs; safe under any chord with that fifth.' }),
  arpeggio: ({ arpeggio }) => ({ name: arpeggio, when: 'Spells out the chord: play up, then back down the same notes. Good when the chord lasts a bar or more.' }),
  'root-fifth-below': ({ fifth }) => ({ name: `Root and ${fifth} below`, when: 'The same notes lower, with the fifth one string down. Deeper; good at slow tempos.' }),
  'approach-below': ({ target }) => ({ name: 'Half step below', when: `Walks into ${target} from one fret below its root, ${BEFORE_THE_CHANGE}.` }),
  'approach-above': ({ target }) => ({ name: 'Half step above', when: `Walks into ${target} from one fret above its root, ${BEFORE_THE_CHANGE}.` }),
  'approach-scale': ({ target }) => ({ name: 'Scale step', when: `Walks into ${target} from the next note of the scale, ${BEFORE_THE_CHANGE}.` }),
};

const TRIAD_SIZE = 3;

function fifthName(chord: ScaleChord): string {
  const quality = QUALITIES[chord.quality];
  if (hasFlatFifth(quality)) return 'flat fifth';
  if (hasSharpFifth(quality)) return 'sharp fifth';
  return PERFECT_FIFTH;
}

function movesOver(chord: ScaleChord, next: ScaleChord | null): SheetMove[] {
  const words: MoveWords = {
    fifth: fifthName(chord),
    arpeggio: chord.tones.length > TRIAD_SIZE ? 'Seventh arpeggio' : 'Triad arpeggio',
    target: next?.name ?? '',
  };
  const offered = MOVE_IDS.filter(id => next || !isWalk(id));
  return offered.map(id => ({ id, ...MOVE_TEXTS[id](words) }));
}

function showMove(
  move: SheetMove,
  { window, windows }: NeckLayout,
  place: (first: number, last: number) => MoveNote[] | null,
  describe: (note: MoveNote) => string,
): ShownMove {
  const notes = window ? place(window.first, window.last) : place(FIRST_FRET, LAST_FRET);
  if (notes) return { ...move, notes, fits: null, text: `${move.name}: ${notes.map(describe).join(', ')}` };
  if (!window) return { ...move, notes: null, fits: null, text: `${move.name} does not fit frets ${FIRST_FRET} to ${LAST_FRET}.` };
  const fittingWindows = windows.filter(w => place(w.first, w.last) !== null);
  const fits = nearestWindow(fittingWindows, window.first);
  const offer = fits ? ` It fits ${lowerWindowLabel(fits)}.` : '';
  return { ...move, notes: null, fits, text: `${move.name} does not fit ${lowerWindowLabel(window)}.${offer}` };
}

const markKey = (mark: { stringIndex: number; fret: number }) => `${mark.stringIndex}:${mark.fret}`;

/** Labels the move notes 1, 2, 3 in playing order, adds those outside the scale, and dims every other mark. */
function numberMoveNotes(marks: readonly FretMark[], notes: readonly MoveNote[]): FretMark[] {
  const marked = new Set(marks.map(markKey));
  const missing = notes.filter(note => !marked.has(markKey(note)));
  const added = missing.map((note): FretMark => ({ stringIndex: note.stringIndex, fret: note.fret, label: '', role: 'scale' }));
  const noteAt = new Map(notes.map(note => [markKey(note), note]));
  return [...marks, ...added].map(mark => {
    const note = noteAt.get(markKey(mark));
    if (!note) return { ...mark, dimmed: true };
    return { ...mark, label: String(note.order), order: note.order, dimmed: false };
  });
}

/** Clears a saved move the sheet no longer offers, such as a walk after picking a chord outside the progressions. */
export function withOfferedMove(choice: FretboardChoice): FretboardChoice {
  if (choice.move === null || fretboardSheet(choice).move) return choice;
  return { ...choice, move: null };
}

export const windowLabel = (window: FretWindow) => `Frets ${window.first} to ${window.last}`;

export function nearestWindow(windows: readonly FretWindow[], position: number | null): FretWindow | null {
  if (position === null || !windows.length) return null;
  return windows.reduce((best, w) => (Math.abs(w.first - position) < Math.abs(best.first - position) ? w : best));
}

export function stepPosition(windows: readonly FretWindow[], position: number | null, direction: 1 | -1): number | undefined {
  const current = nearestWindow(windows, position);
  if (!current) return (direction === 1 ? windows[0] : windows.at(-1))?.first;
  return windows[windows.indexOf(current) + direction]?.first;
}

/** The string's note name, told apart by register when another string has the same name: "low E string". */
function stringName(tuning: readonly number[], index: number, names: readonly string[]): string {
  const name = names[index];
  const sameName = tuning.filter((_, i) => names[i] === name);
  if (sameName.length < 2) return `${name} string`;
  return `${register(tuning[index], sameName)} ${name} string`;
}

function register(midi: number, sameName: readonly number[]): string {
  if (midi === Math.max(...sameName)) return 'high';
  if (midi === Math.min(...sameName)) return 'low';
  return 'middle';
}
