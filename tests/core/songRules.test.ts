import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { headerLines } from '../../src/core/parser';
import { formatProblem, grooveProblems, songFileAt, songName, songProblems, type SongFile } from '../../src/core/songRules';

const catalogue = ['src/songs/bass/exercises/01-first-steps.txt', 'src/songs/bass/songs/09-orion.txt', 'src/songs/guitar/songs/03-greensleeves.txt'];
const bars = ':q 3.3 3.3 3.3 3.3 |\n'.repeat(4);
const song = (title = 'My Walking Line') =>
  `title: ${title}\nartist: TabTrainer\nabout: Roots on every beat.\nlevel: easy\ninstrument: bass4\ntempo: 90\nkey: C\ntime: 4/4\n\n${bars}`;
const file = (name = 'my-walking-line', number = '02', group: SongFile['group'] = 'exercises'): SongFile => ({ family: 'bass', group, number, name });
const messages = (text: string, at = file()) => songProblems(text, at, catalogue).map(problem => problem.message);

describe('song name', () => {
  it('turns the title into a plain file name', () => {
    expect(songName('My Walking Line')).toBe('my-walking-line');
    expect(songName("Ólafur's  Tune!")).toBe('olafur-s-tune');
    expect(songName('???')).toBe('');
  });
});

describe('song file', () => {
  it('reads the family, group, number and name from a bundled path', () => {
    expect(songFileAt('src/songs/bass/songs/09-orion.txt')).toEqual({ family: 'bass', group: 'songs', number: '09', name: 'orion' });
    expect(songFileAt('./songs/guitar/exercises/01-open-string-picking.txt')).toEqual({ family: 'guitar', group: 'exercises', number: '01', name: 'open-string-picking' });
  });
  it('refuses a path outside the catalogue folders', () => {
    expect(songFileAt('my-song.txt')).toBeNull();
    expect(songFileAt('src/songs/ukulele/songs/01-a.txt')).toBeNull();
    expect(songFileAt('src/songs/bass/songs/a.txt')).toBeNull();
  });
});

describe('song rules', () => {
  it('passes a complete song', () => {
    expect(messages(song())).toEqual([]);
  });
  it('lists header lines in file order with their line numbers', () => {
    expect(headerLines('# note\ntitle: A\nabout:\nlevel: easy\n\n:q 3.3 |\n')).toEqual([{ key: 'title', line: 2 }, { key: 'level', line: 4 }]);
  });
  it('points at a header line out of order', () => {
    const text = song().replace('level: easy\n', '').replace('time: 4/4\n', 'time: 4/4\nlevel: easy\n');
    expect(songProblems(text, file(), catalogue)).toEqual([{ rule: 'header', line: 8, col: 1, message: expect.stringMatching(/^Move "level:" above "time:"/) }]);
  });
  it('points a missing header at the top, an empty one at its line, and a title problem at the title', () => {
    const text = song('Orion').replace('about: Roots on every beat.', 'about:').replace('key: C\n', '');
    expect(songProblems(text, file('orion'), catalogue).map(({ rule, line }) => [rule, line])).toEqual([['header', 3], ['header', 1], ['title', 1]]);
  });
  it('keeps the line and column of a reading problem', () => {
    const [problem] = songProblems(song().replace(':q 3.3 3.3', ':q 0.9x 3.3'), file(), catalogue);
    expect(problem).toEqual({ rule: 'lines', line: 10, col: 4, message: expect.stringContaining('"0.9x"') });
  });
  it('asks for at least 4 bars in each version', () => {
    expect(messages(song().replace(bars, bars.slice(21)))).toEqual(['The song needs at least 4 bars.']);
  });
  it('accepts a file name that leaves words of the title out, but not one with other words', () => {
    expect(messages(song('Shuffle Blues in E'), file('shuffle-blues'))).toEqual([]);
    expect(messages(song('A Minor Pentatonic'), file('minor-pentatonic'))).toEqual([]);
    expect(messages(song(), file('walking-blues'))).toEqual(['Name the file after the title, such as 02-my-walking-line.txt.']);
    expect(messages(song(), file('line-walking-my'))).toEqual(['Name the file after the title, such as 02-my-walking-line.txt.']);
    expect(messages(song(), file('my-line'))).toEqual([]);
  });
  it('refuses a name or a number another bundled song has', () => {
    expect(messages(song('Orion'), file('orion'))).toEqual(['A bundled song already has this name. Change the title.']);
    expect(messages(song(), file('my-walking-line', '01'))).toEqual(['Number 01 is taken by 01-first-steps.txt. Use a free number.']);
    expect(messages(song(), file('my-walking-line', '1'))).toEqual(['Number 1 is taken by 01-first-steps.txt. Use a free number.']);
    expect(messages(song('Greensleeves'), file('greensleeves'))).toEqual([]);
  });
  it('does not count the file against itself', () => {
    expect(messages(song('Orion'), file('orion', '09', 'songs'))).toEqual([]);
  });
  it('asks to move a file in the wrong instrument folder', () => {
    expect(messages(song().replace('bass4', 'guitar6'))).toEqual(['The "instrument:" line is a guitar, so the file goes in src/songs/guitar/exercises.']);
  });
});

describe('groove rules', () => {
  const groove = readFileSync('src/grooves/01-blues-shuffle.txt', 'utf8');
  it('passes a bundled groove', () => {
    expect(grooveProblems(groove)).toEqual([]);
  });
  it('asks for a title, genre and about line', () => {
    expect(grooveProblems(groove.replace(/^(title|genre|about):.*\n/gm, '')).map(problem => problem.message)).toEqual([
      'Add a "title:" line at the top.',
      'Add a "genre:" line at the top.',
      'Add an "about:" line at the top.',
    ]);
  });
});

describe('problem lines', () => {
  it('formats a problem the way editors open it', () => {
    expect(formatProblem('src/songs/bass/songs/10-a.txt', { line: 13, col: 17, message: 'Bad note' })).toBe('src/songs/bass/songs/10-a.txt:13:17 error Bad note');
    expect(formatProblem('src/songs/bass/songs/10-a.txt', { message: 'The song needs at least 4 bars.' })).toBe('src/songs/bass/songs/10-a.txt: error The song needs at least 4 bars.');
  });
});
