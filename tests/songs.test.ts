import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseSong } from '../src/core/parser';
import { serializeSong } from '../src/core/serialize';

describe('bundled demo songs', () => {
  const files = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt'));
  it('ships at least one demo per instrument folder', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${f} parses cleanly and round-trips`, () => {
      const { song, issues } = parseSong(readFileSync(`src/songs/${f}`, 'utf8'));
      expect(issues).toEqual([]);
      expect(song.meta.about, 'every demo says what it trains').toBeTruthy();
      expect(song.meta.level, 'every demo says how hard it is').toBeTruthy();
      expect(song.bars.length).toBeGreaterThan(3);
      const again = parseSong(serializeSong(song));
      expect(again.issues).toEqual([]);
      expect(again.song.bars.map(b => b.events)).toEqual(song.bars.map(b => b.events));
    });
  }
});
