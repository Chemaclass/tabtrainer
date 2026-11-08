/** A fretted instrument: strings listed from string 1 (highest pitch) downwards. */
export interface Instrument {
  id: string;
  name: string;
  /** MIDI note of each open string as WRITTEN in notation, string 1 first. */
  tuning: number[];
  clef: 'bass' | 'treble';
  /** Semitones between written and sounding pitch (bass & guitar sound an octave lower: -12). */
  transpose: number;
  maxFret: number;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const m = (name: string): number => noteToMidi(name);

export const INSTRUMENTS: Record<string, Instrument> = {
  bass4: { id: 'bass4', name: 'Bass (4-string, E A D G)', tuning: [m('G3'), m('D3'), m('A2'), m('E2')], clef: 'bass', transpose: -12, maxFret: 24 },
  bass5: { id: 'bass5', name: 'Bass (5-string, B E A D G)', tuning: [m('G3'), m('D3'), m('A2'), m('E2'), m('B1')], clef: 'bass', transpose: -12, maxFret: 24 },
  bass6: { id: 'bass6', name: 'Bass (6-string, B E A D G C)', tuning: [m('C4'), m('G3'), m('D3'), m('A2'), m('E2'), m('B1')], clef: 'bass', transpose: -12, maxFret: 24 },
  guitar6: { id: 'guitar6', name: 'Guitar (6-string, standard)', tuning: [m('E5'), m('B4'), m('G4'), m('D4'), m('A3'), m('E3')], clef: 'treble', transpose: -12, maxFret: 24 },
  ukulele: { id: 'ukulele', name: 'Ukulele (G C E A)', tuning: [m('A4'), m('E4'), m('C4'), m('G4')], clef: 'treble', transpose: 0, maxFret: 15 },
};

/** "Eb3" -> 51, "F#2" -> 42. Octave numbering: C4 = 60. */
export function noteToMidi(name: string): number {
  const r = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!r) throw new Error(`Bad note name "${name}"`);
  const acc = r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0;
  return 12 * (parseInt(r[3], 10) + 1) + PC[r[1].toUpperCase()] + acc;
}

/** Build a custom instrument from a tuning line such as "E2 A2 D3 G3" (low to high, as musicians write it). */
export function customInstrument(tuningLowToHigh: string, clef?: 'bass' | 'treble'): Instrument {
  const notes = tuningLowToHigh.split(/[\s,]+/).filter(Boolean).map(noteToMidi);
  if (notes.length < 1 || notes.length > 12) throw new Error('A tuning needs between 1 and 12 strings');
  const lowest = Math.min(...notes);
  const c = clef ?? (lowest < noteToMidi('C3') ? 'bass' : 'treble');
  return { id: 'custom', name: `Custom (${tuningLowToHigh.trim()})`, tuning: [...notes].reverse(), clef: c, transpose: -12, maxFret: 24 };
}
