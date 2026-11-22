import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { Jam, bundledGrooves } from '../../src/app/jam';
import { jamFretboard } from '../../src/app/jamFretboard';
import { keyLabel, moodBars, moodLegend, moodStage, tempoNote } from '../../src/app/jamMood';
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
  it('gives the recipe for Sad on the rock groove', () => {
    expect(moodStage(sadOnRock())).toEqual({
      name: 'Sad',
      why: moodById('sad').why,
      scale: { value: 'E minor', helper: 'Shown on the fretboard below' },
      chords: { value: 'i bVI bIII bVII', helper: '2 more loops for Sad', more: true },
      tempo: { value: 'Slow, 56 to 88', helper: 'Faster and it turns restless' },
      groove: { value: 'Straight eighths rock in E', helper: '1 groove fits Sad' },
      summary: 'E minor · slow, 56 to 88 · Straight eighths rock in E groove',
      tempoHint: 'Usual for Sad: 56 to 88',
    });
  });
  it('says when the groove the player chose does not fit the mood', () => {
    const jam = sadOnRock();
    jam.choose('funk-sixteenths');
    expect(moodStage(jam)?.groove.helper).toBe('1 groove fits Sad, not this one');
    jam.applyMood('happy');
    expect(moodStage(jam)?.groove.helper).toBe('2 grooves fit Happy, not this one');
  });
  it('notes when the tempo leaves the mood range, in the recipe and under the slider', () => {
    const sad = moodById('sad');
    expect([tempoNote(sad, 56), tempoNote(sad, 88), tempoNote(sad, 89), tempoNote(sad, 40)]).toEqual(['', '', 'Faster than usual for Sad', 'Slower than usual for Sad']);
    const jam = sadOnRock();
    jam.setTempo(120);
    expect(moodStage(jam)).toMatchObject({ tempo: { helper: 'Faster than usual for Sad' }, tempoHint: 'Faster than usual for Sad: 56 to 88' });
  });
  it('gives every bar its numeral and its job', () => {
    expect(moodBars(sadOnRock())).toEqual([
      { numeral: 'i', job: 'Home. Minor, so it starts low.' },
      { numeral: 'bVI', job: 'A major chord that sinks below home.' },
      { numeral: 'bIII', job: 'A moment of light.' },
      { numeral: 'bVII', job: 'Leads back home.' },
    ]);
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
  it('says nothing when the chosen scale lacks the mood note', () => {
    expect(moodLegend(moodById('dark'), 'Em', 'minor-pentatonic')).toBeNull();
    expect(moodLegend(moodById('exciting'), 'E', 'major-pentatonic')).toBeNull();
    expect(moodLegend(null, 'E', 'major')).toBeNull();
  });
  it('marks the borrowed Melancholic note only while the minor chord holds it', () => {
    const legend = moodLegend(moodById('melancholic'), 'C', 'major')!;
    expect(legend.sentence).toBe('Ab is the melancholic note. Four frets below C, not three, and it comes with the minor chord.');
    const at = (bar: number) => marked({ key: 'C', scale: 'major', bars: 'I IV iv I', bar, moodNote: legend.pitchClass });
    expect([at(0), at(1), at(2), at(3)]).toEqual([[], [], ['Ab'], []]);
  });
});

describe('mood progressions in the list', () => {
  it('adds the mood loops and names them after the mood', () => {
    const sad = moodById('sad');
    expect(progressionChoices(null)).not.toContain('sad-i-iv-i-v');
    expect(progressionChoices(sad).slice(-3)).toEqual(['sad-i-bvi-biii-bvii', 'sad-i-iv-i-v', 'sad-i-iv-bvi-v']);
    expect(progressionName('sad-i-iv-i-v', sad)).toBe('Sad: i iv i v');
    expect(progressionName('sad-i-iv-i-v')).toBe('i iv i v');
    expect(progressionChoices(moodById('happy')).filter(slug => slug === 'i-v-vi-iv')).toHaveLength(1);
    expect(progressionName('i-v-vi-iv', moodById('happy'))).toBe('Happy: I V vi IV');
    expect(progressionName('i-v-vi-iv')).toBe('I V vi IV');
  });
});
