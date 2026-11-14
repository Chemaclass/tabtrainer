import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGroove, type Groove } from '../../src/core/groove';
import { serializeGroove } from '../../src/core/grooveSerialize';

const files = readdirSync('src/grooves').filter(file => file.endsWith('.txt'));
const read = (file: string) => readFileSync(`src/grooves/${file}`, 'utf8');

/** Grid line numbers say where a part was written, which serializing is free to change. */
function withoutLines(groove: Groove) {
  const grids = groove.grids.map(({ part, bars }) => ({ part, bars }));
  return { ...groove, grids };
}

function roundTrip(text: string) {
  const first = parseGroove(text).groove;
  const written = serializeGroove(first);
  const again = parseGroove(written);
  return { first, written, again };
}

describe('serializeGroove', () => {
  for (const file of files) {
    it(`round trips ${file}`, () => {
      const { first, again } = roundTrip(read(file));
      expect(again.issues).toEqual([]);
      expect(withoutLines(again.groove)).toEqual(withoutLines(first));
    });
  }

  it('writes the same text when it serializes its own output', () => {
    const { written } = roundTrip(read(files[0]));
    expect(serializeGroove(parseGroove(written).groove)).toBe(written);
  });

  it('writes headers, a grouped progression and aligned part lines', () => {
    const text = 'title: Tiny\ntempo: 100\nkey: Em\ntime: 4/4\nprogression: i7 i7 iv7 i7 V7\nkick: X... x...\nbass: 1 - . 5 8 . b7 .\n';
    expect(roundTrip(text).written).toBe([
      'title: Tiny',
      'tempo: 100',
      'key: Em',
      'time: 4/4',
      'swing: 50',
      'progression: i7 i7 iv7 i7 | V7',
      'voice: keys',
      'kit: rock',
      'fill: off',
      '',
      'kick: X...x...',
      'bass: 1 - . 5 8 . b7 .',
      '',
    ].join('\n'));
  });

  it('keeps several bars, an empty progression and the optional headers', () => {
    const text = 'title: Bars\ngenre: funk\nabout: Two bars.\ntempo: 90\nkey: C\ntime: 6/8\nswing: 60\nvoice: organ\nkit: jazz\nfill: on\nhat: xxxxxx | xx.xx.\n';
    const { first, again } = roundTrip(text);
    expect(withoutLines(again.groove)).toEqual(withoutLines(first));
    expect(again.groove).toMatchObject({ genre: 'funk', about: 'Two bars.', voice: 'organ', kit: 'jazz', fill: true, progression: [] });
  });
});
