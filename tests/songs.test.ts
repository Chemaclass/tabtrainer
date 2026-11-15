import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { formatProblem, songFileAt, songProblems } from '../src/core/songRules';

describe('bundled demo songs', () => {
  const paths = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).map(f => `src/songs/${f.replace(/\\/g, '/')}`);
  it('ships at least one demo per instrument folder', () => expect(paths.length).toBeGreaterThan(0));
  for (const path of paths) {
    it(`${path} follows the catalogue rules`, () => {
      const file = songFileAt(path);
      expect(file, 'lives at src/songs/<bass|guitar>/<exercises|songs>/NN-name.txt').not.toBeNull();
      expect(songProblems(readFileSync(path, 'utf8'), file!, paths).map(problem => formatProblem(path, problem))).toEqual([]);
    });
  }
});
