import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_PROPOSAL_URL, guessGroup, nextNumber, proposeSong, shareLabel, shareState, withOpenDraft } from '../../src/app/songProposal';
import { templateText } from '../../src/app/songTemplates';

const paths = [
  './songs/bass/exercises/01-first-steps.txt',
  './songs/bass/exercises/15-beacon-fire.txt',
  './songs/bass/songs/09-orion.txt',
  './songs/bass/songs/01-ode-to-joy.txt',
  './songs/guitar/songs/03-greensleeves.txt',
];
const bars = ':q 3.3 3.3 3.3 3.3 |\n'.repeat(4);
const header = (title = 'My Walking Line', artist = 'TabTrainer', extra = '') =>
  `title: ${title}\nartist: ${artist}\nabout: Roots on every beat.\nlevel: easy\ninstrument: bass4\ntempo: 90\nkey: C\ntime: 4/4\n${extra}`;
const exercise = header() + '\n' + bars;
const problems = (text: string, group: 'exercises' | 'songs' = 'exercises') => proposeSong(text, group, paths).problems.map(problem => problem.message);

describe('songs to propose', () => {
  const songs = [{ title: 'A', text: 'saved a', updated: 1 }, { title: 'B', text: 'saved b', updated: 2 }];
  it('checks the open draft instead of the saved text of the same song', () => {
    expect(withOpenDraft(songs, 'lib:B', 'draft b').map(song => song.text)).toEqual(['saved a', 'draft b']);
  });
  it('keeps the saved texts without a draft or when another song is open', () => {
    expect(withOpenDraft(songs, 'lib:B', null)).toEqual(songs);
    expect(withOpenDraft(songs, 'demo:./songs/bass/exercises/01-first-steps.txt', 'draft')).toEqual(songs);
  });
});

describe('next number', () => {
  it('follows the highest number in the instrument and group folder', () => {
    expect(nextNumber(paths, 'bass', 'exercises')).toBe('16');
    expect(nextNumber(paths, 'bass', 'songs')).toBe('10');
    expect(nextNumber(paths, 'guitar', 'songs')).toBe('04');
  });
  it('starts at 01 in an empty folder', () => {
    expect(nextNumber(paths, 'guitar', 'exercises')).toBe('01');
  });
  it('keeps two digits', () => {
    expect(nextNumber(['./songs/bass/songs/08-a.txt'], 'bass', 'songs')).toBe('09');
    expect(nextNumber(['./songs/bass/songs/09-a.txt'], 'bass', 'songs')).toBe('10');
  });
});

describe('guessed group', () => {
  it('picks exercises without a composer, and songs with one', () => {
    expect(guessGroup('title: A\n:q 3.3 |\n')).toBe('exercises');
    expect(guessGroup(exercise)).toBe('exercises');
    expect(guessGroup(header('A', 'Traditional (public domain)'))).toBe('songs');
  });
});

describe('song proposal', () => {
  it('fills the GitHub new file page for a complete exercise', () => {
    const proposal = proposeSong(exercise.replace(/\n$/, '\n\n\n'), 'exercises', paths);
    expect(proposal).toMatchObject({ folder: 'src/songs/bass/exercises', fileName: '16-my-walking-line.txt', problems: [], carriesText: true });
    expect(proposal.url.startsWith('https://github.com/Chemaclass/tabtrainer/new/main/src/songs/bass/exercises?filename=16-')).toBe(true);
    expect(proposal.url).not.toContain('+');
    expect(new URL(proposal.url).searchParams.get('value')).toBe(exercise);
    expect(new URL(proposal.url).searchParams.get('template')).toBe('song.md');
  });
  it('takes the instrument folder from the song', () => {
    expect(proposeSong(exercise.replace('bass4', 'guitar6'), 'exercises', paths).folder).toBe('src/songs/guitar/exercises');
    expect(proposeSong(exercise.replace('bass4', 'bass5'), 'exercises', paths).folder).toBe('src/songs/bass/exercises');
  });
  it('lists what a new song from a template still needs', () => {
    expect(problems(templateText('groove', 'bass4'))).toEqual(['Give the song its own title.']);
  });
  it('names each missing header line, but not the optional listen line', () => {
    expect(problems(exercise.replace('key: C\n', '').replace('tempo: 90\n', ''))).toEqual(['Add a "tempo:" line at the top.', 'Add a "key:" line at the top.']);
    expect(problems(exercise)).toEqual([]);
  });
  it('passes on parser issues with their line numbers', () => {
    expect(proposeSong(exercise.replace('level: easy', 'level: expert'), 'exercises', paths).problems).toEqual([{ check: 'lines', message: expect.stringMatching(/expert/), line: 4 }]);
    expect(proposeSong(exercise + ':q 3.3 3.3 3.3 |\n', 'exercises', paths).problems).toEqual([{ check: 'lines', message: 'Bar 5 has 3 of 4 beats; filled with a rest', line: 14 }]);
  });
  it('asks for 16 bars in the Challenge version of an exercise only', () => {
    const text = header('A', 'Traditional (public domain)') + '\n' + bars + '== Challenge\n' + bars.repeat(2) + bars.slice(0, 42);
    expect(problems(text)).toEqual(['"Challenge" needs at least 16 bars.']);
    expect(problems(text, 'songs')).toEqual([]);
  });
  it('names the version that is too short when there are several', () => {
    expect(problems(exercise + '== Easy\n:q 3.3 3.3 3.3 3.3 |\n')).toEqual(['"Easy" needs at least 4 bars.']);
  });
  it('asks a song for a public domain composer', () => {
    expect(problems(exercise.replace('TabTrainer', 'Me'), 'songs')).toEqual(['A song needs "artist: <Composer> (public domain)" or "artist: Traditional (public domain)".']);
    expect(problems(exercise.replace('TabTrainer', 'Traditional (public domain)'), 'songs')).toEqual([]);
  });
  it('refuses a name a bundled song of the same instrument already has', () => {
    expect(problems(exercise.replace('My Walking Line', 'Orion'))).toEqual(['A bundled song already has this name. Change the title.']);
    expect(problems(exercise.replace('My Walking Line', 'Orion').replace('bass4', 'guitar6'))).toEqual([]);
  });
  it('refuses a title without letters or numbers', () => {
    const proposal = proposeSong(exercise.replace('My Walking Line', '???'), 'exercises', paths);
    expect(proposal.fileName).toBe('');
    expect(proposal.problems).toEqual([{ check: 'title', message: 'The title needs letters or numbers.', line: 1 }]);
  });
  it('leaves the text out of a link that would be too long', () => {
    const proposal = proposeSong(readFileSync('src/songs/bass/songs/07-a-dawning.txt', 'utf8'), 'songs', paths);
    expect(proposal.carriesText).toBe(false);
    expect(proposal.url).toBe('https://github.com/Chemaclass/tabtrainer/new/main/src/songs/bass/songs?filename=10-a-dawning.txt&template=song.md');
    expect(proposal.url.length).toBeLessThanOrEqual(MAX_PROPOSAL_URL);
  });
  it('keeps the text in a link just under the limit', () => {
    const base = proposeSong(exercise + '#\n', 'exercises', paths).url.length;
    const text = exercise + `#${'a'.repeat(MAX_PROPOSAL_URL - base)}\n`;
    const proposal = proposeSong(text, 'exercises', paths);
    expect(proposal.url.length).toBe(MAX_PROPOSAL_URL);
    expect(proposal.carriesText).toBe(true);
    expect(proposeSong(exercise + `#${'a'.repeat(MAX_PROPOSAL_URL - base + 1)}\n`, 'exercises', paths).carriesText).toBe(false);
  });
  it('sends Windows line endings as plain newlines', () => {
    const proposal = proposeSong(exercise.replace(/\n/g, '\r\n'), 'exercises', paths);
    expect(new URL(proposal.url).searchParams.get('value')).toBe(exercise);
    expect(proposal.text).toBe(exercise);
  });
  it('asks to paste a text the link cannot encode', () => {
    const proposal = proposeSong(exercise + '# \uD800\n', 'exercises', paths);
    expect(proposal.carriesText).toBe(false);
    expect(proposal.url).toBe('https://github.com/Chemaclass/tabtrainer/new/main/src/songs/bass/exercises?filename=16-my-walking-line.txt&template=song.md');
  });
  it('points each problem at the line to fix', () => {
    const lines = (text: string, group: 'exercises' | 'songs' = 'exercises') => proposeSong(text, group, paths).problems.map(problem => problem.line);
    expect(lines(exercise.replace('level: easy', 'level: expert'))).toEqual([4]);
    expect(lines(exercise.replace('about: Roots on every beat.\n', ''))).toEqual([1]);
    expect(lines(exercise.replace('TabTrainer', 'Me'), 'songs')).toEqual([2]);
    expect(lines(exercise.replace('My Walking Line', 'Orion'))).toEqual([1]);
    expect(lines(header() + '\n' + bars.slice(0, 21))).toEqual([null]);
  });
  it('groups the problems into a checklist, with the composer for songs only', () => {
    const checks = (text: string, group: 'exercises' | 'songs') => proposeSong(text, group, paths).checks.map(({ check, problems }) => [check, problems.length]);
    expect(checks(exercise, 'exercises')).toEqual([['header', 0], ['lines', 0], ['bars', 0], ['title', 0]]);
    expect(checks(exercise.replace('key: C\n', '').replace('TabTrainer', 'Me'), 'songs')).toEqual([['header', 1], ['lines', 0], ['bars', 0], ['title', 0], ['composer', 1]]);
  });
  it('names an empty title once', () => {
    expect(problems(exercise.replace('title: My Walking Line', 'title:'))).toEqual(['Add a "title:" line at the top.']);
  });
});

describe('share state', () => {
  it('is ready when every checklist row is clear, without the rights tick', () => {
    expect(shareState(exercise, paths)).toEqual({ ready: true, left: 0, longEnough: true });
    expect(shareLabel(shareState(exercise, paths))).toBe('Ready to share');
  });
  it('counts the checklist rows left, not each problem', () => {
    const text = exercise.replace('about: Roots on every beat.\n', '').replace('level: easy\n', '').replace(bars, bars.slice(0, 42));
    const state = shareState(text, paths);
    expect(state).toEqual({ ready: false, left: 2, longEnough: false });
    expect(shareLabel(state)).toBe('2 things left to share');
    expect(proposeSong(text, 'exercises', paths).checks.filter(check => check.problems.length > 0).map(check => check.check)).toEqual(['header', 'bars']);
  });
  it('is not ready for a song by a composer who is not in the public domain', () => {
    const state = shareState(header('Enter Sandman', 'Metallica') + '\n' + bars, paths);
    expect(state).toEqual({ ready: false, left: 1, longEnough: true });
    expect(shareLabel(state)).toBe('1 thing left to share');
  });
});
