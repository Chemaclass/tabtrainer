import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { Jam, bundledGrooves } from '../../src/app/jam';
import { jamFretboard } from '../../src/app/jamFretboard';
import { chordsChoice, grooveGroups, heroTitle, keyLabel, moodBars, moodLegend, moodStage, nowText, scaleGroups, tempoNote } from '../../src/app/jamMood';
import { progressionChoices, progressionName } from '../../src/app/jamSummary';
import { chordAt, numerals } from '../../src/core/harmony';
import { INSTRUMENTS } from '../../src/core/instruments';
import { moodById } from '../../src/core/moods';

const files = Object.fromEntries(readdirSync('src/grooves').filter(name => name.endsWith('.txt')).map(name => [`./grooves/${name}`, readFileSync(`src/grooves/${name}`, 'utf8')]));

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

function sadOnRock() {
  const jam = new Jam(bundledGrooves(files));
  jam.choose('rock-straight-eighths');
  jam.applyMood('sad');
  return jam;
}

describe('mood stage', () => {
  it('says nothing with no mood on', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(moodStage(jam)).toBeNull();
    expect(moodBars(jam)).toBeNull();
  });
  it('gives the title, the why sentence and the usual tempo for Sad', () => {
    expect(moodStage(sadOnRock())).toEqual({
      name: 'Sad',
      why: moodById('sad').why,
      tempoHint: 'Usual for Sad: 56 to 88',
      tempoOutside: false,
    });
  });
  it('notes when the tempo leaves the mood range, under the slider', () => {
    const sad = moodById('sad');
    expect([tempoNote(sad, 56), tempoNote(sad, 88), tempoNote(sad, 89), tempoNote(sad, 40)]).toEqual(['', '', 'Faster than usual for Sad', 'Slower than usual for Sad']);
    const jam = sadOnRock();
    jam.setTempo(120);
    expect(moodStage(jam)).toMatchObject({ tempoHint: 'Faster than usual for Sad: 56 to 88', tempoOutside: true });
  });
  it('titles the page with the mood, or the groove with Free', () => {
    const jam = sadOnRock();
    expect(heroTitle(jam)).toBe('Sad');
    jam.clearMood();
    expect(heroTitle(jam)).toBe('Straight eighths rock in E');
  });
  it('names the chords by the loop and its place among the mood loops, or by the progression with Free', () => {
    const jam = sadOnRock();
    expect(chordsChoice(jam)).toEqual({ short: 'Sink and rise', count: '1/3' });
    jam.setProgression(moodById('sad').loops[1].slug);
    expect(chordsChoice(jam)).toEqual({ short: 'Deeper each time', count: '2/3' });
    jam.clearMood();
    expect(chordsChoice(jam)).toEqual({ short: "Groove's own", count: '' });
    jam.setProgression('ii-v-i');
    expect(chordsChoice(jam)).toEqual({ short: 'ii V I', count: '' });
  });
  it('gives the job of the bar that plays, and the next chord with Free', () => {
    const jam = sadOnRock();
    expect(nowText(jam, 0)).toEqual({ job: 'Home. Minor, so it starts low.', showNext: false });
    expect(nowText(jam, 15)).toEqual({ job: 'A soft pull back home.', showNext: false });
    jam.clearMood();
    expect(nowText(jam, 0)).toEqual({ job: '', showNext: true });
  });
  it('gives every bar its numeral and its job', () => {
    expect(moodBars(sadOnRock())).toEqual([
      { numeral: 'i', job: 'Home. Minor, so it starts low.' },
      { numeral: 'bVI', job: 'A major chord that sinks below home.' },
      { numeral: 'bIII', job: 'A moment of light.' },
      { numeral: 'bVII', job: 'Leads back home.' },
      { numeral: 'i', job: 'Home again.' },
      { numeral: 'bVI', job: 'Sinks below home again.' },
      { numeral: 'iv', job: 'Sinks deeper.' },
      { numeral: 'v', job: 'A soft pull back home.' },
    ]);
  });
  it('shows an eight bar loop in two rows of four, with a job for every bar', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.choose('rock-straight-eighths');
    jam.applyMood('exciting');
    expect(chordsChoice(jam)).toEqual({ short: 'Drive and climb', count: '1/3' });
    const bars = moodBars(jam)!;
    expect(bars).toHaveLength(8);
    expect(bars.at(-1)).toEqual({ numeral: 'bVII', job: 'One step below, climbing home.' });
  });
  it('spells the key out', () => {
    expect([keyLabel('Am'), keyLabel('Eb')]).toEqual(['A minor', 'Eb major']);
  });
});

describe('mood note legend', () => {
  const marked = (input: { key: string; scale: Parameters<typeof jamFretboard>[0]['scale']; bars: string; bar: number; moodNote: number | null }) => {
    const progression = numerals(input.bars);
    const chord = chordAt(progression, input.key, input.bar);
    const drawing = jamFretboard({ instrument: INSTRUMENTS.guitar6, key: input.key, scale: input.scale, labels: 'names', chord, nextChord: chord, moodNote: input.moodNote });
    return [...new Set(drawing.marks.filter(mark => mark.mood).map(mark => mark.label))];
  };

  it('names the mood note of the chosen scale and marks it on the board', () => {
    const legend = moodLegend(moodById('sad'), 'Am', 'minor');
    expect(legend?.sentence).toBe('C is the sad note. Three frets above A, not four.');
    expect(marked({ key: 'Am', scale: 'minor', bars: 'i bVI bIII bVII', bar: 0, moodNote: legend!.pitchClass })).toEqual(['C']);
  });
  it('says which note the chosen scale leaves out, and marks nothing on the board', () => {
    expect(moodLegend(moodById('exciting'), 'E', 'major-pentatonic')).toEqual({ pitchClass: null, name: 'D', sentence: 'This scale leaves out D, the exciting note.' });
    expect(moodLegend(moodById('dark'), 'Em', 'minor-pentatonic')?.sentence).toBe('This scale leaves out F, the dark note.');
    expect(moodLegend(null, 'E', 'major')).toBeNull();
  });
  it('groups the scales: those that carry the mood first, then the others', () => {
    expect(scaleGroups(null, ['major', 'major-pentatonic'])).toEqual([{ label: null, scales: ['major', 'major-pentatonic'] }]);
    expect(scaleGroups(moodById('happy'), ['major', 'major-pentatonic', 'lydian'])).toEqual([
      { label: 'Carries the mood', scales: ['major', 'major-pentatonic'] },
      { label: 'Also fits these chords', scales: ['lydian'] },
    ]);
    expect(scaleGroups(moodById('exciting'), ['mixolydian'])).toEqual([{ label: 'Carries the mood', scales: ['mixolydian'] }]);
  });
  it('lists the bundled grooves that fit the mood first, in the order of its genres', () => {
    const jam = new Jam(bundledGrooves(files));
    const slugs = (entries: readonly { slug: string }[]) => entries.map(entry => entry.slug);
    const sad = grooveGroups(jam.list, moodById('sad'));
    expect(slugs(sad.fitting)).toEqual(['slow-ballad', 'rock-straight-eighths']);
    expect(slugs(grooveGroups(jam.list, moodById('exciting')).fitting)).toEqual(['driving-hard-rock', 'rock-straight-eighths', 'metal-gallop']);
    expect(sad.other).toHaveLength(jam.list.length - 2);
    expect(grooveGroups(jam.list, null)).toEqual({ fitting: [], other: jam.list });
  });
  it('marks the borrowed Melancholic note only while the minor chord holds it', () => {
    const legend = moodLegend(moodById('melancholic'), 'C', 'major')!;
    expect(legend.sentence).toBe('Ab is the melancholic note. Four frets below C, not three, and it comes with the minor chord.');
    const at = (bar: number) => marked({ key: 'C', scale: 'major', bars: 'I IV iv I', bar, moodNote: legend.pitchClass });
    expect([at(0), at(1), at(2), at(3)]).toEqual([[], [], ['Ab'], []]);
  });
});

describe('mood progressions in the list', () => {
  it('keeps a chosen mood loop listed after its mood turns off', () => {
    const melancholic = moodById('melancholic').loops[1].slug;
    const dark = moodById('dark').loops[0].slug;
    expect(progressionChoices(null, melancholic).at(-1)).toBe(melancholic);
    expect(progressionChoices(null, 'i-v-vi-iv').filter(slug => slug === 'i-v-vi-iv')).toHaveLength(1);
    expect(progressionChoices(null, 'nope')).not.toContain('nope');
    expect(progressionChoices(moodById('dark'), dark).filter(slug => slug === dark)).toHaveLength(1);
  });
  it('lists only the loops of the mood that is on, by name and chords', () => {
    const sad = moodById('sad');
    const [, second] = sad.loops;
    expect(progressionChoices(sad, 'groove')).toEqual(sad.loops.map(loop => loop.slug));
    expect(progressionChoices(moodById('bluesy'), '12-bar-blues')).toEqual(['12-bar-blues', 'minor-blues']);
    expect(progressionName(second.slug, sad)).toBe('Deeper each time: i iv i v, bVI bIII iv v');
    expect(progressionName('12-bar-blues', moodById('bluesy'))).toBe('12 bar blues: I7 IV7 I7 I7, IV7 IV7 I7 I7, V7 IV7 I7 V7');
  });
  it('lists the groove own chords and the presets with no mood, and no mood loop', () => {
    const choices = progressionChoices(null, 'groove');
    expect(choices[0]).toBe('groove');
    expect(choices).toContain('i-v-vi-iv');
    expect(choices).not.toContain(moodById('sad').loops[0].slug);
    expect(progressionName('12-bar-blues')).toBe('12 bar blues');
    expect(progressionName(moodById('sad').loops[1].slug)).toBe('Deeper each time: i iv i v, bVI bIII iv v');
  });
});
