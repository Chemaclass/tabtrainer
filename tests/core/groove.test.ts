import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGroove } from '../../src/core/groove';
import type { GrooveIssueCode, ParseIssue } from '../../src/core/parseIssue';

const head = 'title: Test\ntempo: 100\nkey: C\ntime: 4/4\nprogression: I IV V I\n';

describe('parseGroove', () => {
  it('reads the groove docs example without warnings', () => {
    const docs = readFileSync('docs/grooves.md', 'utf8');
    const example = /## Groove format[\s\S]*?```text\n([\s\S]*?)```/.exec(docs)?.[1] ?? '';
    const { groove, issues } = parseGroove(example);
    expect(issues).toEqual([]);
    expect(groove.grids.map(g => g.part)).toEqual(['hat', 'snare', 'kick', 'keys', 'bass']);
  });
  it('reads the blues shuffle as 12 bars in A with a shuffle', () => {
    const { groove } = parseGroove(readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8'));
    expect(groove.progression).toHaveLength(12);
    expect(groove.progression.map(n => n.text).join(' ')).toBe('I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7');
    expect(groove).toMatchObject({ title: 'Blues shuffle in A', genre: 'blues', tempo: 80, key: 'A', time: [4, 4], swing: 66 });
    expect(groove.grids.map(g => g.part).sort()).toEqual(['bass', 'crash', 'hat', 'keys', 'kick', 'snare']);
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
      [8, expect.stringContaining('"4"')],
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
  it('reads approach steps into the next chord in the bass', () => {
    const { groove, issues } = parseGroove(`${head}bass: 1 - 3 - 5 - >b1 - | 1 - 2 - >5 - >2 -\n`);
    expect(issues).toEqual([]);
    expect(groove.grids[0].bars[1]).toEqual(['1', '-', '2', '-', '>5', '-', '>2', '-']);
    expect(parseGroove(`${head}bass: 1 - >4 - >b2 - > -\n`).issues.map(i => i.message)).toEqual([expect.stringContaining('">4"')]);
  });
  it('reads the keys voice and warns about an unknown one', () => {
    expect(parseGroove(head).groove.voice).toBe('keys');
    expect(parseGroove(`${head}voice: drive\n`).groove.voice).toBe('drive');
    const { groove, issues } = parseGroove(`${head}voice: banjo\n`);
    expect(groove.voice).toBe('keys');
    expect(issues).toEqual([expect.objectContaining({ line: 6, message: expect.stringMatching(/"banjo".*keys, organ, drive/) })]);
  });
  it('reads the drum kit and warns about an unknown one', () => {
    expect(parseGroove(head).groove.kit).toBe('rock');
    expect(parseGroove(`${head}kit: jazz\n`).groove.kit).toBe('jazz');
    const { groove, issues } = parseGroove(`${head}kit: toy\n`);
    expect(groove.kit).toBe('rock');
    expect(issues).toEqual([expect.objectContaining({ line: 6, message: expect.stringMatching(/"toy".*rock, blues, funk, reggae, jazz, metal, electronic/) })]);
  });
  it('leaves fills off unless the groove turns them on', () => {
    expect(parseGroove(head).groove.fill).toBe(false);
    expect(parseGroove(`${head}fill: on\n`).groove.fill).toBe(true);
    expect(parseGroove(`${head}fill: off\n`).groove.fill).toBe(false);
    expect(parseGroove('time: 3/8\nfill: on\nprogression: I\n').issues).toEqual([expect.objectContaining({ line: 2, message: expect.stringContaining('at least 2 beats') })]);
    const { groove, issues } = parseGroove(`${head}fill: yes\n`);
    expect(groove.fill).toBe(false);
    expect(issues).toEqual([expect.objectContaining({ line: 6, message: expect.stringContaining('on or off') })]);
  });
  it('reads toms, the bell and every hi-hat state as drum lines', () => {
    const { groove, issues } = parseGroove(`${head}halfhat: x.......\npedalhat: ..x.....\nbell: ....x...\nhightom: x.......\nmidtom: ..x.....\nlowtom: ....x...\n`);
    expect(issues).toEqual([]);
    expect(groove.grids.map(g => g.part)).toEqual(['halfhat', 'pedalhat', 'bell', 'hightom', 'midtom', 'lowtom']);
  });
  it('warns when there is no progression', () => {
    expect(parseGroove('title: Empty\n').issues).toEqual([expect.objectContaining({ message: expect.stringContaining('No progression') })]);
  });
});

describe('groove issue codes', () => {
  const chords = 'progression: I IV\n';
  const CASES: Record<GrooveIssueCode, [string, Partial<ParseIssue>]> = {
    'line-unreadable': [`${chords}what is this`, { line: 2, col: 1, length: 12 }],
    'line-unknown': [`${chords}cowbell: x...x...`, { line: 2, col: 1, length: 8 }],
    'tempo-range': [`${chords}tempo: 5`, { line: 2, col: 8, length: 1 }],
    'key-unknown': [`${chords}key: H`, { line: 2, col: 6, length: 1, hint: 'use a key like A, Bb or F#m' }],
    'time-signature': [`${chords}time: 4/5`, { line: 2, col: 7, length: 3 }],
    'swing-range': [`${chords}swing: 80  # too much`, { line: 2, col: 8, length: 2 }],
    'progression-duplicate': [`${chords}progression: V`, { line: 2, col: 1, length: 12 }],
    'progression-missing': ['title: T\n', { line: 1, col: 1, length: 0 }],
    'numeral-unknown': ['progression: I IX', { line: 1, col: 16, length: 2 }],
    'voice-unknown': [`${chords}voice: banjo`, { line: 2, col: 8, length: 5 }],
    'kit-unknown': [`${chords}kit: toy`, { line: 2, col: 6, length: 3 }],
    'fill-switch': [`${chords}fill: yes`, { line: 2, col: 7, length: 3 }],
    'fill-short': ['time: 3/8\nfill: on\nprogression: I', { line: 2, col: 7, length: 2 }],
    'grid-duplicate': [`${chords}kick: x...x...\nkick: x...x...`, { line: 3, col: 1, length: 5 }],
    'grid-empty': [`${chords}kick:`, { line: 2, col: 1, length: 5 }],
    'grid-long': [`${chords}kick: x...x... | x...x... | x...x...`, { line: 2, col: 7, length: 30 }],
    'bar-empty': [`${chords}kick: x...x... | | x...x...`, { line: 2, col: 17, length: 1 }],
    'bar-steps': [`${chords}snare: ..x..x..x.`, { line: 2, col: 8, length: 10, hint: 'use 8, 12, 16' }],
    'step-unknown': [`${chords}hat: x.y.x.x.`, { line: 2, col: 8, length: 1 }],
    'hold-empty': [`${chords}keys: x.-.x...`, { line: 2, col: 9, length: 1 }],
  };
  it.each(Object.entries(CASES))('points %s at its token', (code, [src, where]) => {
    expect(parseGroove(src).issues).toEqual([expect.objectContaining({ code, severity: 'warning', ...where })]);
  });
  it('points a bar with no characters at the "|" that closes it', () => {
    expect(parseGroove(`${head}kick: | x...x...`).issues).toEqual([expect.objectContaining({ code: 'bar-empty', line: 6, col: 7, length: 1 })]);
    expect(parseGroove(`${head}kick: x...x...||x...x...`).issues).toEqual([expect.objectContaining({ code: 'bar-empty', line: 6, col: 16, length: 1 })]);
  });
  it('points an unknown bass step at its word', () => {
    expect(parseGroove(`${head}bass: 1 2 3 4 5 . . .`).issues).toEqual([expect.objectContaining({ code: 'step-unknown', line: 6, col: 13, length: 1 })]);
  });
  it('ends each message with its hint', () => {
    for (const issue of Object.values(CASES).flatMap(([src]) => parseGroove(src).issues)) {
      if (issue.hint) expect(issue.message.endsWith(` ${issue.hint}`)).toBe(true);
    }
  });
});

it('keeps the groove core free of browser APIs', () => {
  for (const file of ['groove.ts', 'harmony.ts', 'grooveTimeline.ts']) {
    expect(readFileSync(`src/core/${file}`, 'utf8'), file).not.toMatch(/\b(document|window|AudioContext|AudioNode)\b/);
  }
});
