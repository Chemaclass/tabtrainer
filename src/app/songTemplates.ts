import { INSTRUMENTS, familyOf, isFamily, noteToMidi, type Family } from '../core/instruments';

export type SongTemplateId = 'groove' | 'blues' | 'levels' | 'blank';
export interface SongTemplate { id: SongTemplateId; name: string; summary: string; sample: (instrument: TemplateInstrument) => string }
export const TEMPLATE_INSTRUMENTS = ['bass4', 'bass5', 'bass6', 'guitar6'] as const;
export type TemplateInstrument = typeof TEMPLATE_INSTRUMENTS[number];

export const PLACEHOLDER_TITLE = 'New song';

// The templates are written for the four strings E A D G, which every template instrument has.
function stringNumbers(instrument: TemplateInstrument) {
  const { tuning } = INSTRUMENTS[instrument];
  const lowE = tuning.lastIndexOf(Math.min(...tuning.filter(note => note % 12 === noteToMidi('E2') % 12))) + 1;
  return { E: lowE, A: lowE - 1, D: lowE - 2, G: lowE - 3 };
}

export const SONG_TEMPLATES: readonly SongTemplate[] = [
  { id: 'groove', name: 'Four bar groove', summary: 'Roots and eighths. The quickest way in.', sample: instrument => { const { A, D } = stringNumbers(instrument); return `:q 3.${A} 3.${A} :8 5.${D} 5.${D}`; } },
  { id: 'blues', name: 'Twelve bar blues', summary: 'Chords laid out, bars ready to fill.', sample: () => '"A7" | "D7" | "A7" |' },
  { id: 'levels', name: 'Exercise with levels', summary: 'Learn, Develop and Challenge versions.', sample: () => '== Learn == Challenge' },
  { id: 'blank', name: 'Blank', summary: 'Header lines and four empty bars, for those who know the format.', sample: () => `title: ${PLACEHOLDER_TITLE}` },
];
export const DEFAULT_TEMPLATE: SongTemplateId = 'groove';

export const templateInstruments = (family: Family) => TEMPLATE_INSTRUMENTS.filter(id => familyOf(INSTRUMENTS[id]) === family);

export type TemplateInstrumentChoice = Partial<Record<Family, TemplateInstrument>>;
export const isTemplateInstrumentChoice = (value: unknown): value is TemplateInstrumentChoice =>
  !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.entries(value).every(([family, id]) => isFamily(family) && templateInstruments(family).some(choice => choice === id));

const header = (instrument: TemplateInstrument, about: string, tempo: number, key: string) =>
  [`title: ${PLACEHOLDER_TITLE}`, 'artist: TabTrainer', `about: ${about}`, 'level: easy', `instrument: ${instrument}`, `tempo: ${tempo}`, `key: ${key}`, 'time: 4/4', ''];
const twoPerLine = (bars: string[]) => bars.flatMap((bar, index) => index % 2 ? [] : [`${bar} | ${bars[index + 1]} |`]);

export function templateText(id: SongTemplateId, instrument: TemplateInstrument): string {
  const { E, A, D, G } = stringNumbers(instrument);
  const teach = [`# Notes are fret.string. 3.${E} is fret 3 on string ${E}, your low E string.`, '# Change a number and listen.'];
  const roots = { C: `3.${A}`, Am: `0.${A}`, F: `1.${E}`, G: `3.${E}` };
  const fifths = { C: `5.${D}`, Am: `2.${D}`, F: `3.${A}`, G: `5.${A}` };
  const octaves = { C: `5.${G}`, Am: `2.${G}`, F: `3.${D}`, G: `5.${D}` };
  type Chord = keyof typeof roots;
  const rootBar = (chord: Chord) => `"${chord}" :h ${roots[chord]} ${roots[chord]}`;
  const fifthBar = (chord: Chord) => `"${chord}" :q ${roots[chord]} ${roots[chord]} :8 ${fifths[chord]} ${fifths[chord]} ${roots[chord]} ${fifths[chord]}`;
  const octaveBar = (chord: Chord) => `"${chord}" :8 ${`${roots[chord]} ${roots[chord]} ${octaves[chord]} ${roots[chord]} `.repeat(2).trim()}`;
  const progression: Chord[] = ['C', 'Am', 'F', 'G'], ending: Chord[] = ['C', 'Am', 'G'];
  switch (id) {
    case 'groove':
      return [...header(instrument, 'Roots and fifths in eighth notes over four chords.', 90, 'C'), ...teach,
        '# ":q" makes the notes after it quarter notes, ":8" eighth notes. A "|" ends the bar.', '@Groove', ...twoPerLine(progression.map(fifthBar)), ''].join('\n');
    case 'blues': {
      const boogie = { A7: `0.${A} 2.${D} 4.${D} 2.${D}`, D7: `0.${D} 2.${G} 4.${G} 2.${G}`, E7: `0.${E} 2.${A} 4.${A} 2.${A}` };
      const form: (keyof typeof boogie)[] = ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'];
      return [...header(instrument, 'The twelve bar blues form, with root, fifth and sixth in every bar.', 100, 'A'), ...teach,
        '# Each bar is one chord in quotes. Keep the chords and write your own line under them.', '@Twelve bars', ...twoPerLine(form.map(chord => `"${chord}" :q ${boogie[chord]}`)), ''].join('\n');
    }
    case 'levels':
      return [...header(instrument, 'Roots, then fifths, then octaves over four chords, one step at a time.', 80, 'C'), ...teach,
        '# Each "==" line starts a version. Players pick Learn, Develop or Challenge.',
        '== Learn', 'level: easy', '@Roots', ...twoPerLine(progression.map(rootBar)), '',
        '== Develop', 'level: medium', '@Roots and fifths', ...twoPerLine(progression.map(fifthBar)), '',
        '== Challenge', 'level: hard', '# A Challenge needs at least 16 bars.', '@Octaves',
        ...twoPerLine([...progression, ...progression, ...progression, ...ending].map(octaveBar).concat(`"C" :w ${roots.C}`)), ''].join('\n');
    case 'blank':
      return [...header(instrument, 'Say in one sentence what this song trains.', 90, 'C'), ':w r | r | r | r |', ''].join('\n');
  }
}

/** Where the title sits in a template, so the editor can select it. */
export function titleRange(text: string): { start: number; end: number } | null {
  const found = /^title:[ \t]*(.*)$/m.exec(text);
  if (!found) return null;
  const start = found.index + found[0].length - found[1].length;
  return { start, end: start + found[1].length };
}
