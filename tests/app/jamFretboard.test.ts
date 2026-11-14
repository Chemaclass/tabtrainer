import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JamFretboardSettings, barChords, jamFretboard, type JamFretboardInput } from '../../src/app/jamFretboard';
import type { FretMark, MarkRole } from '../../src/core/fretboard';
import { parseGroove } from '../../src/core/groove';
import { buildGrooveTimeline } from '../../src/core/grooveTimeline';
import { chordAt, numerals } from '../../src/core/harmony';
import { INSTRUMENTS } from '../../src/core/instruments';

const BLUES = numerals('I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7');
const A7 = chordAt(BLUES, 'A', 0);
const D7 = chordAt(BLUES, 'A', 1);
const E7 = chordAt(BLUES, 'A', 8);
const BASS_STRING = { G: 0, D: 1, A: 2, E: 3 };

const inA = (change: Partial<JamFretboardInput> = {}) => jamFretboard({
  instrument: INSTRUMENTS.bass4,
  key: 'A',
  scale: 'minor-pentatonic',
  labels: 'names',
  chord: D7,
  nextChord: A7,
  ...change,
});

const markAt = (marks: readonly FretMark[], stringIndex: number, fret: number) =>
  marks.find(mark => mark.stringIndex === stringIndex && mark.fret === fret);

function labelsWith(marks: readonly FretMark[], role: MarkRole): string[] {
  const labels = marks.filter(mark => mark.role === role).map(mark => mark.label);
  return [...new Set(labels)].sort();
}

describe('jam fretboard', () => {
  it('marks D, F#, A and C as chord tones with D as the root while D7 plays in A', () => {
    const { marks } = inA();
    expect(labelsWith(marks, 'root')).toEqual(['D']);
    expect(labelsWith(marks, 'tone')).toEqual(['A', 'C', 'F#']);
    expect(labelsWith(marks, 'scale')).toEqual(['E', 'G']);
    expect(markAt(marks, BASS_STRING.E, 10)?.role).toBe('root');
    expect(markAt(marks, BASS_STRING.D, 4)).toMatchObject({ label: 'F#', role: 'tone' });
  });
  it('keeps the A minor pentatonic at fret 5 of the E string and fret 7 of the A and D strings', () => {
    const { marks } = inA({ chord: A7 });
    expect(markAt(marks, BASS_STRING.E, 5)).toMatchObject({ label: 'A', role: 'root' });
    expect(markAt(marks, BASS_STRING.A, 7)).toMatchObject({ label: 'E', role: 'tone' });
    expect(markAt(marks, BASS_STRING.D, 7)).toMatchObject({ label: 'A', role: 'root' });
  });
  it('labels the marks with degrees of the key on request', () => {
    const { marks } = inA({ labels: 'degrees' });
    expect(labelsWith(marks, 'root')).toEqual(['4']);
    expect(labelsWith(marks, 'tone')).toEqual(['1', '6', 'b3']);
  });
  it('states the chord, its tones, the scale and the next chord', () => {
    const drawing = inA({ nextChord: E7 });
    expect(drawing.chordText).toBe('D7: D F# A C');
    expect(drawing.scaleText).toBe('Scale: A minor pentatonic, A C D E G');
    expect(drawing.nextChordText).toBe('Next: E7');
    expect(drawing.description).toBe('Fretboard of the Bass (4-string, E A D G), frets 0 to 12, with the notes of A minor pentatonic marked, the tones of D7 stronger');
  });
  it('draws six guitar strings with their notes', () => {
    const drawing = inA({ instrument: INSTRUMENTS.guitar6 });
    expect(drawing.openNames).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
    expect(markAt(drawing.marks, 1, 3)).toMatchObject({ label: 'D', role: 'root' });
    expect(markAt(drawing.marks, 5, 5)).toMatchObject({ label: 'A', role: 'tone' });
  });
  it('redraws the scale for a new key, with flats in a flat key', () => {
    const fMajorSeventh = chordAt(numerals('Imaj7'), 'F', 0);
    const drawing = inA({ key: 'F', scale: 'major', chord: fMajorSeventh, nextChord: fMajorSeventh });
    expect(drawing.chordText).toBe('Fmaj7: F A C E');
    expect(drawing.scaleText).toBe('Scale: F major, F G A Bb C D E');
    expect(markAt(drawing.marks, BASS_STRING.A, 1)).toMatchObject({ label: 'Bb', role: 'scale' });
  });
  it('spells a Db blues with flats, from the name of the key', () => {
    const dFlatSeventh = chordAt(BLUES, 'Db', 0);
    const drawing = inA({ key: 'Db', chord: dFlatSeventh, nextChord: dFlatSeventh, labels: 'degrees' });
    expect(drawing.chordText).toBe('Db7: Db F Ab Cb');
    expect(drawing.scaleText).toBe('Scale: Db minor pentatonic, Db Fb Gb Ab Cb');
    expect(drawing.openNames).toEqual(['G', 'D', 'A', 'E']);
    expect(labelsWith(drawing.marks, 'tone')).toEqual(['3', '5', 'b7']);
  });
});

describe('bar chords', () => {
  const groove = parseGroove('title: Blues\nkey: A\nprogression: I7 IV7 I7 V7\nkick: x...').groove;
  const { bars } = buildGrooveTimeline(groove, 'A');

  it('pairs the playing chord with the chord one bar ahead', () => {
    expect(barChords(bars, 1)).toEqual({ chord: bars[1].chord, nextChord: bars[2].chord });
    expect(barChords(bars, 0).nextChord.name).toBe('D7');
  });
  it('wraps the next chord round to the first bar', () => {
    expect(barChords(bars, 3).nextChord.name).toBe('A7');
  });
});

describe('jam fretboard settings', () => {
  let stored: Map<string, string>;
  beforeEach(() => {
    stored = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('plays a 4 string bass with note names until told otherwise', () => {
    const settings = new JamFretboardSettings();
    expect(settings.instrumentFor('bass').id).toBe('bass4');
    expect(settings.instrumentFor('guitar').id).toBe('guitar6');
    expect(settings.labels).toBe('names');
  });
  it('remembers the bass and the labels across reloads', () => {
    const settings = new JamFretboardSettings();
    expect(settings.setBass('bass5')).toBe(true);
    expect(settings.setBass('bass5')).toBe(false);
    settings.toggleLabels();
    const reloaded = new JamFretboardSettings();
    expect(reloaded.instrumentFor('bass').tuning).toHaveLength(5);
    expect(reloaded.labels).toBe('degrees');
  });
  it('ignores saved values that do not fit', () => {
    stored.set('tabtrainer:jamFretboard', JSON.stringify({ bass: 'banjo', labels: 'colours' }));
    const settings = new JamFretboardSettings();
    expect([settings.bass, settings.labels]).toEqual(['bass4', 'names']);
  });
});
