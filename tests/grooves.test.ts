import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGroove } from '../src/core/groove';
import { BASS_RANGE, KEYS_RANGE, buildGrooveTimeline } from '../src/core/grooveTimeline';
import { OWN_PROGRESSION, PROGRESSION_PRESETS, presetProgression } from '../src/core/harmony';
import { jamKeys } from '../src/app/jam';

const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = MAJOR_KEYS.map(k => `${k}m`);

function grooveProblems(src: string): string[] {
  const { groove, issues } = parseGroove(src);
  const problems = issues.map(i => `line ${i.line}: ${i.message}`);
  if (!src.split('\n').some(line => /^title\s*:\s*\S/.test(line))) problems.push('no title');
  if (!groove.genre) problems.push('no genre');
  if (!groove.about) problems.push('no about');
  return problems;
}

const files = readdirSync('src/grooves').filter(f => f.endsWith('.txt'));
const read = (file: string) => readFileSync(`src/grooves/${file}`, 'utf8');

describe('bundled grooves', () => {
  it('ships the blues, rock, reggae and funk grooves', () => {
    expect(files.map(f => parseGroove(read(f)).groove.genre)).toEqual(expect.arrayContaining(['blues', 'rock', 'reggae', 'funk']));
  });

  it('fails a groove whose grid does not fit its bar', () => {
    const broken = read(files[0]).replace(/^hat:.*$/m, 'hat: xoxoxoxoxo');
    expect(grooveProblems(broken)).toEqual(expect.arrayContaining([expect.stringMatching(/"hat:".*10 steps/)]));
  });

  for (const file of files) {
    const src = read(file);
    const { groove } = parseGroove(src);

    it(`${file} parses cleanly with a title, genre and about line`, () => {
      expect(grooveProblems(src)).toEqual([]);
    });

    it(`${file} keeps bass and keys in range in all 12 keys, with every progression`, () => {
      for (const slug of [OWN_PROGRESSION, ...PROGRESSION_PRESETS.map(p => p.slug)]) {
        const progression = presetProgression(slug, groove.progression)!;
        for (const key of [...jamKeys(groove), ...(jamKeys(groove)[0].endsWith('m') ? MAJOR_KEYS : MINOR_KEYS)]) {
          const t = buildGrooveTimeline({ ...groove, progression }, key);
          expect(t.bass.length, `${slug} in ${key}`).toBeGreaterThan(0);
          expect(t.bass.every(h => h.midi[0] >= BASS_RANGE.low && h.midi[0] <= BASS_RANGE.high), `${slug} in ${key}`).toBe(true);
          expect(t.keys.every(h => h.midi.every(m => m >= KEYS_RANGE.low && m <= KEYS_RANGE.high)), `${slug} in ${key}`).toBe(true);
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

describe('groove format docs', () => {
  it('shows the same groove example in the README and the help dialog', () => {
    const readme = /## Groove format[\s\S]*?```text\n([\s\S]*?)```/.exec(readFileSync('README.md', 'utf8'))?.[1];
    const help = /<h2>Writing a groove<\/h2>[\s\S]*?<pre>([\s\S]*?)<\/pre>/.exec(readFileSync('index.html', 'utf8'))?.[1];
    expect(readme).toBeTruthy();
    expect(help?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trimEnd()).toBe(readme?.trimEnd());
  });
});
