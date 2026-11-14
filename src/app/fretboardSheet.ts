import { fretboardPositions, positionWindows, type FretMark, type FretWindow, type MarkRole } from '../core/fretboard';
import { INSTRUMENTS, type Instrument } from '../core/instruments';
import { isScaleId, scaleById, scaleChords, scaleNotes, scaleTitle, usesFlats, type ScaleChord, type ScaleId, type ScaleNote } from '../core/scales';
import { spellPitchClass } from '../core/theory';

export type FretLabels = 'names' | 'degrees';

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
}

export const DEFAULT_FRETBOARD_CHOICE: FretboardChoice = { root: 0, scale: 'major', instrument: 'bass4', labels: 'names', chord: null, sevenths: false, position: null };

export const FIRST_FRET = 0, LAST_FRET = 12;

const isIntegerBetween = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

export const isFretboardChoice = (value: unknown): value is FretboardChoice =>
  !!value && typeof value === 'object'
  && 'root' in value && Number.isInteger(value.root) && (value.root as number) >= 0 && (value.root as number) <= 11
  && 'scale' in value && isScaleId(value.scale)
  && 'instrument' in value && typeof value.instrument === 'string' && Object.hasOwn(INSTRUMENTS, value.instrument)
  && 'labels' in value && (value.labels === 'names' || value.labels === 'degrees')
  && 'chord' in value && (value.chord === null || isIntegerBetween(value.chord, 0, 6))
  && 'sevenths' in value && typeof value.sevenths === 'boolean'
  && 'position' in value && (value.position === null || isIntegerBetween(value.position, FIRST_FRET, LAST_FRET));

export const withFretboardDefaults = (value: unknown): unknown =>
  value && typeof value === 'object' && !Array.isArray(value) ? { chord: null, sevenths: false, position: null, ...value } : value;

export const ROOT_OPTIONS = Array.from({ length: 12 }, (_, pc) => {
  const sharp = spellPitchClass(pc, false), flat = spellPitchClass(pc, true);
  return { value: pc, label: sharp === flat ? sharp : `${sharp} / ${flat}` };
});

export interface StringNotes { name: string; text: string }

export interface FretboardSheet {
  instrument: Instrument;
  title: string;
  summary: string;
  openNames: string[];
  chords: ScaleChord[];
  chord: ScaleChord | null;
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
  const chord = choice.chord === null ? null : chords[choice.chord] ?? null;
  const byPitch = new Map<number, ScaleNote>([...chord?.tones.map(t => [t.pitchClass, t] as const) ?? [], ...notes.map(n => [n.pitchClass, n] as const)]);
  const tones = new Set(chord?.tones.map(t => t.pitchClass));
  const flats = usesFlats(choice.root, scaleById(choice.scale));
  const title = scaleTitle(choice.root, choice.scale);
  const openNames = instrument.tuning.map(open => spellPitchClass(open, flats));
  const windows = positionWindows(instrument.tuning, notes.map(n => n.pitchClass), FIRST_FRET, LAST_FRET - 1)
    .map(w => ({ first: w.first, last: Math.min(w.last, LAST_FRET) }));
  const window = nearestWindow(windows, choice.position);
  const inWindow = (fret: number) => !window || (fret >= window.first && fret <= window.last);
  const roleOf = (pc: number): MarkRole => chord
    ? (pc === chord.root.pitchClass ? 'root' : tones.has(pc) ? 'tone' : 'scale')
    : (byPitch.get(pc)!.root ? 'root' : 'scale');
  const positions = fretboardPositions(instrument.tuning, [...byPitch.keys()], FIRST_FRET, LAST_FRET);
  const marks = positions.map(({ stringIndex, fret, pitchClass: pc }): FretMark => {
    const note = byPitch.get(pc)!;
    return { stringIndex, fret, label: choice.labels === 'degrees' ? note.degree : note.name, role: roleOf(pc), dimmed: !inWindow(fret) };
  });
  const roleText: Record<MarkRole, string> = { root: chord ? ' chord root' : ' root', tone: ' chord tone', scale: '' };
  const strings = instrument.tuning.map((_, stringIndex) => {
    const name = stringName(instrument.tuning, stringIndex, openNames);
    const frets = positions.filter(p => p.stringIndex === stringIndex && inWindow(p.fret)).map(p => {
      const note = byPitch.get(p.pitchClass)!;
      const where = p.fret === 0 ? 'open' : `fret ${p.fret}`;
      const degree = choice.labels === 'degrees' ? ` (${note.degree})` : '';
      return `${where} ${note.name}${degree}${roleText[roleOf(p.pitchClass)]}`;
    });
    return { name, text: `${name}: ${frets.length ? frets.join(', ') : window ? 'no notes in this position' : 'no scale notes'}` };
  });
  const chordText = chord ? `, the tones of ${chord.name} stronger` : '';
  const windowText = window ? `, ${windowLabel(window).toLowerCase()} at full strength and the rest dimmed` : '';
  return {
    instrument,
    title,
    summary: (chord ? `${chord.name} in ${title}: ${chord.tones.map(t => t.name).join(' ')}` : `${title}: ${notes.map(n => n.name).join(' ')}`)
      + (window ? `; ${windowLabel(window).toLowerCase()}` : ''),
    openNames,
    chords,
    chord,
    windows,
    window,
    marks,
    strings,
    description: `Fretboard of the ${instrument.name}, frets ${FIRST_FRET} to ${LAST_FRET}, with the notes of ${title} marked${chordText}${windowText}`,
  };
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

function stringName(tuning: readonly number[], index: number, names: readonly string[]): string {
  const name = names[index];
  const same = tuning.filter((_, i) => names[i] === name);
  if (same.length < 2) return `${name} string`;
  const midi = tuning[index];
  return `${midi === Math.max(...same) ? 'high' : midi === Math.min(...same) ? 'low' : 'middle'} ${name} string`;
}
