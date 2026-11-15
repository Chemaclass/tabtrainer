import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseSong } from '../src/core/parser';
import { parseGroove } from '../src/core/groove';
import { formatProblem, grooveProblems, songFileAt, songProblems, type SongProblem } from '../src/core/songRules';

interface Check { problems: SongProblem[]; summary: string }

const SONGS = 'src/songs';
const GROOVES = 'src/grooves';

const listed = (folder: string) =>
  readdirSync(folder, { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.txt')).map(file => `${folder}/${file}`).sort();
const count = (amount: number, word: string) => `${amount} ${word}${amount === 1 ? '' : 's'}`;
const catalogue = listed(SONGS);

function checkGroove(text: string): Check {
  const bars = Math.max(0, ...parseGroove(text).groove.grids.map(grid => grid.bars.length));
  return { problems: grooveProblems(text), summary: count(bars, 'bar') };
}

function checkSong(path: string, text: string): Check {
  const { song } = parseSong(text);
  const summary = `${count(song.versions.length, 'version')}, ${count(song.versions.reduce((bars, version) => bars + version.bars.length, 0), 'bar')}`;
  const file = songFileAt(path);
  if (!file) return { problems: [{ message: `Put the file at ${SONGS}/<bass|guitar>/<exercises|songs>/NN-name.txt.` }], summary };
  return { problems: songProblems(text, file, catalogue), summary };
}

function check(path: string): Check {
  if (!existsSync(path)) return { problems: [{ message: 'No such file.' }], summary: 'not checked' };
  const text = readFileSync(path, 'utf8');
  return /(^|\/)grooves\//.test(path) ? checkGroove(text) : checkSong(path, text);
}

const named = process.argv.slice(2).map(path => path.replace(/\\/g, '/').replace(/^\.\//, ''));
const grooves = listed(GROOVES);
const paths = named.length > 0 ? named : [...catalogue, ...grooves];
let problems = 0;
for (const path of paths) {
  const result = check(path);
  for (const problem of result.problems) console.log(formatProblem(path, problem));
  if (named.length > 0) console.log(`${path}: ${result.summary}, ${count(result.problems.length, 'problem')}`);
  problems += result.problems.length;
}
if (named.length === 0) console.log(`Checked ${count(catalogue.length, 'song')} and ${count(grooves.length, 'groove')}: ${count(problems, 'problem')}`);
process.exitCode = problems > 0 ? 1 : 0;
