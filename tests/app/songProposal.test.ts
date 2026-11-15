import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_PROPOSAL_URL, guessGroup, nextNumber, proposalName, proposeSong } from '../../src/app/songProposal';
import { newSongText } from '../../src/app/songbook';

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
const problems = (text: string, group: 'exercises' | 'songs' = 'exercises') => proposeSong(text, group, paths).problems;

describe('proposal name', () => {
  it('turns the title into a plain file name', () => {
    expect(proposalName('My Walking Line')).toBe('my-walking-line');
    expect(proposalName("Ólafur's  Tune!")).toBe('olafur-s-tune');
    expect(proposalName('???')).toBe('');
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
  });
  it('takes the instrument folder from the song', () => {
    expect(proposeSong(exercise.replace('bass4', 'guitar6'), 'exercises', paths).folder).toBe('src/songs/guitar/exercises');
    expect(proposeSong(exercise.replace('bass4', 'bass5'), 'exercises', paths).folder).toBe('src/songs/bass/exercises');
  });
  it('lists what a new song from the editor still needs', () => {
    expect(problems(newSongText('bass'))).toEqual([
      'Add an "artist:" line at the top.',
      'Add an "about:" line at the top.',
      'Add a "level:" line at the top.',
      'Give the song its own title.',
      'The song needs at least 4 bars.',
    ]);
  });
  it('names each missing header line, but not the optional listen line', () => {
    expect(problems(exercise.replace('key: C\n', '').replace('tempo: 90\n', ''))).toEqual(['Add a "tempo:" line at the top.', 'Add a "key:" line at the top.']);
    expect(problems(exercise)).toEqual([]);
  });
  it('passes on parser issues with their line numbers', () => {
    expect(problems(exercise.replace('level: easy', 'level: expert'))).toEqual([expect.stringMatching(/^Line 4: .*expert/)]);
    expect(problems(exercise + ':q 3.3 3.3 3.3 |\n')).toEqual(['Line 14: Bar 5 has 3 of 4 beats; filled with a rest']);
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
    expect(proposal.problems).toEqual(['The title needs letters or numbers.']);
  });
  it('leaves the text out of a link that would be too long', () => {
    const proposal = proposeSong(readFileSync('src/songs/bass/songs/07-a-dawning.txt', 'utf8'), 'songs', paths);
    expect(proposal.carriesText).toBe(false);
    expect(proposal.url).toBe('https://github.com/Chemaclass/tabtrainer/new/main/src/songs/bass/songs?filename=10-a-dawning.txt');
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
    expect(proposal.url).toBe('https://github.com/Chemaclass/tabtrainer/new/main/src/songs/bass/exercises?filename=16-my-walking-line.txt');
  });
  it('names an empty title once', () => {
    expect(problems(exercise.replace('title: My Walking Line', 'title:'))).toEqual(['Add a "title:" line at the top.']);
  });
});
