import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGroove } from '../../src/core/groove';

const head = 'title: Test\ntempo: 100\nkey: C\ntime: 4/4\nprogression: I IV V I\n';

describe('parseGroove', () => {
  it('reads every bundled groove without warnings', () => {
    for (const file of readdirSync('src/grooves')) {
      const { issues } = parseGroove(readFileSync(`src/grooves/${file}`, 'utf8'));
      expect(issues, file).toEqual([]);
    }
  });
  it('reads the README example without warnings', () => {
    const readme = readFileSync('README.md', 'utf8');
    const example = /## Groove format[\s\S]*?```text\n([\s\S]*?)```/.exec(readme)?.[1] ?? '';
    const { groove, issues } = parseGroove(example);
    expect(issues).toEqual([]);
    expect(groove.grids.map(g => g.part)).toEqual(['hat', 'snare', 'kick', 'keys', 'bass']);
  });
  it('reads the blues shuffle as 12 bars in A with a shuffle', () => {
    const { groove } = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8'));
    expect(groove.progression).toHaveLength(12);
    expect(groove.progression.map(n => n.text).join(' ')).toBe('I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7');
    expect(groove).toMatchObject({ title: 'Blues shuffle in A', genre: 'blues', tempo: 80, key: 'A', time: [4, 4], swing: 66 });
    expect(groove.grids.map(g => g.part).sort()).toEqual(['crash', 'hat', 'keys', 'kick', 'snare']);
  });
  it('splits grid lines into bars of steps', () => {
    const { groove, issues } = parseGroove(`${head}kick: x... x... | X.o. x...\nbass: 1 . 3 - 5 . 8 . | 5 b7 8 . 1 - - .\nkeys: X-.x..X.\n`);
    expect(issues).toEqual([]);
    expect(groove.grids).toEqual([
      { part: 'kick', bars: ['x...x...'.split(''), 'X.o.x...'.split('')], line: 6 },
      { part: 'bass', bars: [['1', '.', '3', '-', '5', '.', '8', '.'], ['5', 'b7', '8', '.', '1', '-', '-', '.']], line: 7 },
      { part: 'keys', bars: ['X-.x..X.'.split('')], line: 8 },
    ]);
  });
  it('warns about a grid that does not divide into the bar, naming the line', () => {
    const { groove, issues } = parseGroove(`${head}snare: ..x..x..x.\n`);
    expect(issues).toEqual([expect.objectContaining({ line: 6, message: expect.stringMatching(/"snare:".*10 steps.*4\/4 bar.*8, 12, 16/) })]);
    expect(groove.grids).toEqual([]);
  });
  it('warns about an unknown numeral or quality, naming the line and the token', () => {
    const { groove, issues } = parseGroove('title: Test\nprogression: I IX V13 IV\n');
    expect(issues).toEqual([
      expect.objectContaining({ line: 2, col: 16, message: expect.stringContaining('"IX"') }),
      expect.objectContaining({ line: 2, col: 19, message: expect.stringContaining('"V13"') }),
    ]);
    expect(groove.progression.map(n => n.text)).toEqual(['I', 'IV']);
  });
  it('warns about unknown steps, a hold with nothing before it and unknown lines', () => {
    const { issues } = parseGroove(`${head}hat: x.y.x.x.\nkeys: -x..x...\nbass: 1 2 3 4 5 . . .\ncowbell: x...x...\n`);
    expect([...issues].sort((a, b) => a.line - b.line).map(i => [i.line, i.message])).toEqual([
      [6, expect.stringContaining('"y"')],
      [7, expect.stringContaining('"-" with no note before it')],
      [8, expect.stringContaining('"2"')],
      [9, expect.stringContaining('"cowbell:"')],
    ]);
  });
  it('warns about empty bars, a hold after a rest and step counts that do not fit the meter', () => {
    const { groove, issues } = parseGroove(`${head}kick: x...x... | | x...x...\nkeys: x.-.x...\nhat: xxxx |\n`);
    expect(issues.map(i => [i.line, i.message])).toEqual([
      [6, expect.stringContaining('bar 2 is empty')],
      [7, expect.stringContaining('"-" with no note before it')],
      [8, expect.stringContaining('4 steps')],
    ]);
    expect(groove.grids).toEqual([]);
    expect(parseGroove('time: 6/8\nprogression: I\nkick: x.....\nhat: xxxxxxxxxxxx |\n').issues).toEqual([]);
  });
  it('warns about a second progression line', () => {
    const { groove, issues } = parseGroove('progression: I IV\nprogression: V\n');
    expect(issues).toEqual([expect.objectContaining({ line: 2, message: expect.stringContaining('already a "progression:"') })]);
    expect(groove.progression).toHaveLength(2);
  });
  it('checks header values', () => {
    const { groove, issues } = parseGroove('swing: 80\nkey: H\ntempo: 5\ntime: 4/5\nswing: 0x42\nprogression: I\n');
    expect(issues.map(i => i.line)).toEqual([1, 2, 3, 4, 5]);
    expect(groove).toMatchObject({ swing: 50, key: 'C', tempo: 90, time: [4, 4] });
  });
  it('keeps sharp numerals and strips comments', () => {
    const { groove, issues } = parseGroove('# a comment\n#kick: x...\n  #---\nprogression: I #IVm7b5 # tritone sub\n');
    expect(issues).toEqual([]);
    expect(groove.progression.map(n => n.text)).toEqual(['I', '#IVm7b5']);
  });
  it('warns when there is no progression', () => {
    expect(parseGroove('title: Empty\n').issues).toEqual([expect.objectContaining({ message: expect.stringContaining('No progression') })]);
  });
});

it('keeps the groove core free of browser APIs', () => {
  for (const file of ['groove.ts', 'harmony.ts', 'grooveTimeline.ts']) {
    expect(readFileSync(`src/core/${file}`, 'utf8'), file).not.toMatch(/\b(document|window|AudioContext|AudioNode)\b/);
  }
});
