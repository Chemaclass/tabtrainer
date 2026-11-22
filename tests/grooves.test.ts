import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGroove } from '../src/core/groove';
import { BASS_RANGE, KEYS_RANGE, POWER_CHORD_RANGE, buildGrooveTimeline } from '../src/core/grooveTimeline';
import { OWN_PROGRESSION, PROGRESSION_PRESETS, presetProgression } from '../src/core/harmony';
import { jamKeys } from '../src/app/jam';
import { pitchClass } from '../src/core/theory';
import { formatProblem, grooveProblems } from '../src/core/songRules';

const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = MAJOR_KEYS.map(k => `${k}m`);

const files = readdirSync('src/grooves').filter(f => f.endsWith('.txt'));
const read = (file: string) => readFileSync(`src/grooves/${file}`, 'utf8');

describe('bundled grooves', () => {
  it('ships nine grooves, one per genre', () => {
    expect(files.map(f => parseGroove(read(f)).groove.genre)).toEqual(['blues', 'rock', 'reggae', 'funk', 'jazz', 'bossa', 'metal', 'ballad', 'hardrock']);
  });

  it('fails a groove whose grid does not fit its bar', () => {
    const broken = read(files[0]).replace(/^hat:.*$/m, 'hat: xoxoxoxoxo');
    expect(grooveProblems(broken).map(problem => problem.message)).toEqual(expect.arrayContaining([expect.stringMatching(/"hat:".*10 steps/)]));
  });

  for (const file of files) {
    const src = read(file);
    const { groove } = parseGroove(src);

    it(`${file} parses cleanly with a title, genre and about line`, () => {
      expect(grooveProblems(src).map(problem => formatProblem(`src/grooves/${file}`, problem))).toEqual([]);
    });

    it(`${file} keeps bass and keys in range in all 12 keys, with every progression`, () => {
      for (const slug of [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(p => p.slug)]) {
        const progression = presetProgression(slug, groove.progression)!;
        for (const key of [...jamKeys(groove), ...(jamKeys(groove)[0].endsWith('m') ? MAJOR_KEYS : MINOR_KEYS)]) {
          const t = buildGrooveTimeline({ ...groove, progression }, key);
          expect(t.bass.length, `${slug} in ${key}`).toBeGreaterThan(0);
          expect(t.bass.every(h => h.midi[0] >= BASS_RANGE.low && h.midi[0] <= BASS_RANGE.high), `${slug} in ${key}`).toBe(true);
          const range = (bar: number) => (groove.voice === 'drive' || t.bars[bar].chord.intervals.length === 2 ? POWER_CHORD_RANGE : KEYS_RANGE);
          expect(t.keys.every(h => h.midi.every(m => m >= range(h.bar).low && m <= range(h.bar).high)), `${slug} in ${key}`).toBe(true);
        }
      }
    });
  }

  it('drops the reggae kick from beat 1 and lands it with the snare on beat 3', () => {
    const { groove } = parseGroove(read('03-reggae-one-drop.txt'));
    const t = buildGrooveTimeline(groove);
    for (const { bar, start } of t.bars) {
      const on = (drum: string, beat: number) => t.drums.some(h => h.bar === bar && h.drum === drum && Math.abs(h.beat - start - beat) < 1e-9);
      expect(on('kick', 0), `bar ${bar + 1}`).toBe(false);
      expect(on('kick', 2) && on('snare', 2), `bar ${bar + 1}`).toBe(true);
    }
  });
});

describe('jazz, bossa and metal grooves', () => {
  const at = (t: ReturnType<typeof buildGrooveTimeline>, drum: string, bar: number, beat: number) =>
    t.drums.some(h => h.drum === drum && h.bar === bar && Math.abs(h.beat - t.bars[bar].start - beat) < 1e-9);

  it('walks the jazz bass in quarter notes, stepping into the next root at the end of each bar, in all keys and progressions', () => {
    const { groove } = parseGroove(read('05-jazz-swing.txt'));
    for (const slug of [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(p => p.slug)]) {
      for (const key of [...MAJOR_KEYS, ...MINOR_KEYS]) {
        const t = buildGrooveTimeline({ ...groove, progression: presetProgression(slug, groove.progression)! }, key);
        for (const { bar, start } of t.bars) {
          const notes = t.bass.filter(h => h.bar === bar);
          expect(notes.map(h => h.beat - start), `${slug} in ${key}, bar ${bar + 1}`).toEqual([0, 1, 2, 3]);
          const next = t.bars[(bar + 1) % t.bars.length];
          const nextRoot = t.bass.find(h => h.bar === next.bar)!.midi[0];
          expect(pitchClass(nextRoot)).toBe(next.chord.root);
          expect([1, 2], `${slug} in ${key}, bar ${bar + 1}`).toContain(Math.abs(notes[3].midi[0] - nextRoot));
        }
      }
    }
  });

  for (const file of ['05-jazz-swing.txt', '06-bossa-nova.txt']) {
    it(`${file} never leaps more than an octave, around the whole loop, in all keys and progressions`, () => {
      const { groove } = parseGroove(read(file));
      for (const slug of [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(p => p.slug)]) {
        for (const key of [...MAJOR_KEYS, ...MINOR_KEYS]) {
          const line = buildGrooveTimeline({ ...groove, progression: presetProgression(slug, groove.progression)! }, key).bass.map(h => h.midi[0]);
          const leaps = line.map((note, i) => Math.abs(line[(i + 1) % line.length] - note));
          expect(Math.max(...leaps), `${slug} in ${key}`).toBeLessThanOrEqual(12);
        }
      }
    });
  }

  it('leads the bossa bass into the next bar from a half step away, in all keys', () => {
    const { groove } = parseGroove(read('06-bossa-nova.txt'));
    for (const key of MAJOR_KEYS) {
      const t = buildGrooveTimeline(groove, key);
      const last = t.bass.filter(h => h.bar === 3).at(-1)!.midi[0];
      expect(Math.abs(last - t.bass[0].midi[0]), key).toBe(1);
    }
  });

  it('plays the jazz ride on every beat with hats on 2 and 4', () => {
    const t = buildGrooveTimeline(parseGroove(read('05-jazz-swing.txt')).groove);
    for (const { bar } of t.bars) {
      expect([0, 1, 2, 3].every(beat => at(t, 'ride', bar, beat))).toBe(true);
      expect([0, 1, 2, 3].map(beat => at(t, 'hat', bar, beat))).toEqual([false, true, false, true]);
    }
  });

  it('plays the bossa on the rim and never on the snare', () => {
    const t = buildGrooveTimeline(parseGroove(read('06-bossa-nova.txt')).groove);
    expect(t.drums.some(h => h.drum === 'rim')).toBe(true);
    expect(t.drums.some(h => h.drum === 'snare')).toBe(false);
  });

  it('plays the metal chords as root and fifth power chords on the driven voice, over a double kick', () => {
    const { groove } = parseGroove(read('07-metal-gallop.txt'));
    for (const key of MINOR_KEYS) {
      const t = buildGrooveTimeline(groove, key);
      expect(t.voice).toBe('drive');
      for (const hit of t.keys) {
        const root = t.bars[hit.bar].chord.root;
        expect(hit.midi.map(m => pitchClass(m - root))).toEqual([0, 7, 0]);
      }
      expect(t.drums.filter(h => h.drum === 'kick' && h.bar === 0)).toHaveLength(12);
    }
  });
});

describe('groove format docs', () => {
  it('shows the same groove example in the groove docs and the help dialog', () => {
    const docs = /## Groove format[\s\S]*?```text\n([\s\S]*?)```/.exec(readFileSync('docs/grooves.md', 'utf8'))?.[1];
    const help = /<h2>Writing a groove<\/h2>[\s\S]*?<pre>([\s\S]*?)<\/pre>/.exec(readFileSync('index.html', 'utf8'))?.[1];
    expect(docs).toBeTruthy();
    expect(help?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trimEnd()).toBe(docs?.trimEnd());
  });
});
