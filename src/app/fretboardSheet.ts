import { fretboardPositions, type FretMark } from '../core/fretboard';
import { INSTRUMENTS, type Instrument } from '../core/instruments';
import { isScaleId, scaleById, scaleNotes, scaleTitle, usesFlats, type ScaleId } from '../core/scales';
import { spellPitchClass } from '../core/theory';

export type FretLabels = 'names' | 'degrees';

export interface FretboardChoice { root: number; scale: ScaleId; instrument: string; labels: FretLabels }

export const DEFAULT_FRETBOARD_CHOICE: FretboardChoice = { root: 0, scale: 'major', instrument: 'bass4', labels: 'names' };

export const FIRST_FRET = 0, LAST_FRET = 12;

export const isFretboardChoice = (value: unknown): value is FretboardChoice =>
  !!value && typeof value === 'object'
  && 'root' in value && Number.isInteger(value.root) && (value.root as number) >= 0 && (value.root as number) <= 11
  && 'scale' in value && isScaleId(value.scale)
  && 'instrument' in value && typeof value.instrument === 'string' && Object.hasOwn(INSTRUMENTS, value.instrument)
  && 'labels' in value && (value.labels === 'names' || value.labels === 'degrees');

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
  marks: FretMark[];
  strings: StringNotes[];
  description: string;
}

export function fretboardSheet(choice: FretboardChoice): FretboardSheet {
  const instrument = INSTRUMENTS[choice.instrument];
  const notes = scaleNotes(choice.root, choice.scale);
  const byPitch = new Map(notes.map(note => [note.pitchClass, note]));
  const flats = usesFlats(choice.root, scaleById(choice.scale));
  const title = scaleTitle(choice.root, choice.scale);
  const openNames = instrument.tuning.map(open => spellPitchClass(open, flats));
  const positions = fretboardPositions(instrument.tuning, notes.map(n => n.pitchClass), FIRST_FRET, LAST_FRET);
  const marks = positions.map(({ stringIndex, fret, pitchClass: pc }): FretMark => {
    const note = byPitch.get(pc)!;
    return { stringIndex, fret, label: choice.labels === 'degrees' ? note.degree : note.name, role: note.root ? 'root' : 'scale' };
  });
  const strings = instrument.tuning.map((_, stringIndex) => {
    const name = stringName(instrument.tuning, stringIndex, openNames);
    const frets = positions.filter(p => p.stringIndex === stringIndex).map(p => {
      const note = byPitch.get(p.pitchClass)!;
      const where = p.fret === 0 ? 'open' : `fret ${p.fret}`;
      const degree = choice.labels === 'degrees' ? ` (${note.degree})` : '';
      return `${where} ${note.name}${degree}${note.root ? ' root' : ''}`;
    });
    return { name, text: `${name}: ${frets.length ? frets.join(', ') : 'no scale notes'}` };
  });
  return {
    instrument,
    title,
    summary: `${title}: ${notes.map(n => n.name).join(' ')}`,
    openNames,
    marks,
    strings,
    description: `Fretboard of the ${instrument.name}, frets ${FIRST_FRET} to ${LAST_FRET}, with the notes of ${title} marked`,
  };
}

function stringName(tuning: readonly number[], index: number, names: readonly string[]): string {
  const name = names[index];
  const same = tuning.filter((_, i) => names[i] === name);
  if (same.length < 2) return `${name} string`;
  const midi = tuning[index];
  return `${midi === Math.max(...same) ? 'high' : midi === Math.min(...same) ? 'low' : 'middle'} ${name} string`;
}
