import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { APPROACH, HOLD, REST, parseGroove, type Groove } from '../../src/core/groove';
import { buildGrooveTimeline } from '../../src/core/grooveTimeline';
import { isMinorProgression, keyTonic, numerals, type Chord } from '../../src/core/harmony';
import { MOODS, jamProgression, moodById, moodFits, type Mood, type MoodLoop } from '../../src/core/moods';
import { scaleNotes } from '../../src/core/scales';
import { MAJOR_SIXTH, MINOR_SEVENTH, pitchClass } from '../../src/core/theory';

const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

const grooves: Groove[] = readdirSync('src/grooves')
  .filter(f => f.endsWith('.txt'))
  .map(f => parseGroove(readFileSync(`src/grooves/${f}`, 'utf8')).groove);
const grooveOf = (genre: string) => grooves.find(g => g.genre === genre)!;

// The boogie walk climbs through the major sixth of every seventh chord in a blues: a blues sound, not a clash
const isBoogieSixth = (mood: Mood, chord: Chord, pc: number) =>
  mood.id === 'bluesy' && chord.intervals.includes(MINOR_SEVENTH) && pc === pitchClass(chord.root + MAJOR_SIXTH);

/** Bass notes, approach steps aside, that are neither a tone of their chord nor a note of the mood scale. */
function strayBassNotes(mood: Mood, groove: Groove, loop: MoodLoop, key: string): string[] {
  const progression = jamProgression(loop.slug, groove.progression)!;
  const timeline = buildGrooveTimeline({ ...groove, progression }, key);
  const grid = groove.grids.find(g => g.part === 'bass')!;
  const scale = scaleNotes(keyTonic(key)!, mood.scale).map(n => n.pitchClass);
  return timeline.bars.flatMap(({ bar, chord }) => {
    const steps = grid.bars[bar % grid.bars.length].filter(step => step !== REST && step !== HOLD);
    const hits = timeline.bass.filter(h => h.bar === bar);
    expect(hits).toHaveLength(steps.length);
    return steps.flatMap((step, i) => {
      if (step.startsWith(APPROACH)) return [];
      const pc = pitchClass(hits[i].midi[0]);
      const fits = chord.tones.includes(pc) || scale.includes(pc) || isBoogieSixth(mood, chord, pc);
      return fits ? [] : [`bar ${bar + 1} ${chord.name}: ${step}`];
    });
  });
}

const keysFor = (loop: MoodLoop) => (isMinorProgression(numerals(loop.bars)) ? MINOR_KEYS : MAJOR_KEYS);

describe('grooves that fit a mood', () => {
  for (const mood of MOODS) {
    for (const genre of mood.genres) {
      it(`${mood.name} fits the bundled ${genre} groove: every bass note is a chord tone or in the scale, every loop, every key`, () => {
        const groove = grooveOf(genre);
        expect(moodFits(mood, groove.genre)).toBe(true);
        for (const loop of mood.loops) {
          for (const key of keysFor(loop)) expect(strayBassNotes(mood, groove, loop, key), `${loop.bars} in ${key}`).toEqual([]);
        }
      });
    }
  }

  it('catches the grooves left out of a mood', () => {
    const stray = (id: Mood['id'], genre: string) => moodById(id).loops.flatMap(loop => strayBassNotes(moodById(id), grooveOf(genre), loop, keysFor(loop)[0]));
    expect(stray('happy', 'reggae')).toContain('bar 1 C: b7');
    expect(stray('sad', 'funk')).toContain('bar 4 Gm: 6');
    expect(stray('bluesy', 'jazz')).toContain('bar 1 C7: 2');
    expect(stray('bluesy', 'blues')).toEqual([]);
  });
});
