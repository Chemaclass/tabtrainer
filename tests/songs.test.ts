import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseSong } from '../src/core/parser';
import { serializeSong } from '../src/core/serialize';

describe('bundled demo songs', () => {
  for (const f of readdirSync('src/songs').filter(f => f.endsWith('.txt'))) {
    it(`${f} parses cleanly and round-trips`, () => {
      const { song, issues } = parseSong(readFileSync(`src/songs/${f}`, 'utf8'));
      expect(issues).toEqual([]);
      expect(song.bars.length).toBeGreaterThan(3);
      const again = parseSong(serializeSong(song));
      expect(again.issues).toEqual([]);
      expect(again.song.bars.map(b => b.events)).toEqual(song.bars.map(b => b.events));
    });
  }
});
