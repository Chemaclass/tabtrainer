import { headerKeys, parseSong, type ParseResult } from '../core/parser';
import { serializeSong } from '../core/serialize';
import { familyOf, type Family } from '../core/instruments';
import type { Song } from '../core/model';
import { findBySlug } from './songLink';

export type ProposalGroup = 'exercises' | 'songs';
export type ProposalCheck = 'header' | 'lines' | 'bars' | 'title' | 'composer';
export interface ProposalProblem { check: ProposalCheck; message: string; line: number | null }
export interface ProposalCheckResult { check: ProposalCheck; label: string; problems: ProposalProblem[] }
export interface Proposal {
  title: string;
  folder: string;
  fileName: string;
  text: string;
  problems: ProposalProblem[];
  checks: ProposalCheckResult[];
  url: string;
  carriesText: boolean;
}

const REPOSITORY = 'https://github.com/Chemaclass/tabtrainer';
const BRANCH = 'main';
// Measured against GitHub: a longer link fails for a signed-out player, whose sign-in redirect carries it.
export const MAX_PROPOSAL_URL = 6000;
const CATALOGUE_HEADERS = ['title', 'artist', 'about', 'level', 'instrument', 'tempo', 'key', 'time'];
const PLACEHOLDER_TITLES = ['new song', 'untitled'];
const MIN_BARS = 4;
const MIN_CHALLENGE_BARS = 16;
const CHECK_LABELS: Record<ProposalCheck, string> = {
  header: 'The header lines are filled in',
  lines: 'Every line reads',
  bars: 'Enough bars to practise',
  title: 'A title of its own',
  composer: 'A public domain composer',
};

// "Ólafur's  Tune!" -> "olafur-s-tune"
export const proposalName = (title: string) =>
  title.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const guessGroup = (text: string): ProposalGroup => {
  const artist = parseSong(text).song.meta.artist;
  return !artist || artist === 'TabTrainer' ? 'exercises' : 'songs';
};

export const nextNumber = (paths: readonly string[], family: Family, group: ProposalGroup) => {
  const folder = `./songs/${family}/${group}/`;
  const numbers = paths.flatMap(path => {
    const number = path.startsWith(folder) ? /^(\d+)-/.exec(path.slice(folder.length)) : null;
    return number ? [Number(number[1])] : [];
  });
  return String(Math.max(0, ...numbers) + 1).padStart(2, '0');
};

const sameEvents = (a: Song, b: Song) => JSON.stringify(a.versions.map(v => v.bars.map(bar => bar.events))) === JSON.stringify(b.versions.map(v => v.bars.map(bar => bar.events)));

function readsBack(song: Song) {
  const again = parseSong(serializeSong(song));
  return again.issues.length === 0 && sameEvents(song, again.song);
}

// An unpaired surrogate cannot be encoded, so such a text has to be pasted.
function encoded(text: string): string | null {
  try { return encodeURIComponent(text); } catch { return null; }
}

const TOP_LINE = 1;

function headerLine(text: string, key: string): number {
  const index = text.split('\n').findIndex(line => new RegExp(`^\\s*${key}\\s*:`, 'i').test(line));
  return index < 0 ? TOP_LINE : index + 1;
}

function songProblems(text: string, { song, issues }: ParseResult, group: ProposalGroup, paths: readonly string[], family: Family, name: string): ProposalProblem[] {
  const keys = headerKeys(text);
  const problem = (check: ProposalCheck, message: string, line: number | null = null): ProposalProblem => ({ check, message, line });
  const problems = CATALOGUE_HEADERS.filter(key => !keys.has(key)).map(key => problem('header', `Add ${/^[aeiou]/.test(key) ? 'an' : 'a'} "${key}:" line at the top.`, headerLine(text, key)));
  if (keys.has('title') && PLACEHOLDER_TITLES.includes(song.meta.title.toLowerCase())) problems.push(problem('title', 'Give the song its own title.', headerLine(text, 'title')));
  problems.push(...issues.map(issue => problem('lines', issue.message, issue.line)));
  for (const version of song.versions) {
    if (version.bars.length < MIN_BARS) problems.push(problem('bars', song.versions.length > 1 ? `"${version.name}" needs at least ${MIN_BARS} bars.` : `The song needs at least ${MIN_BARS} bars.`));
    if (group === 'exercises' && version.name === 'Challenge' && version.bars.length < MIN_CHALLENGE_BARS) problems.push(problem('bars', `"Challenge" needs at least ${MIN_CHALLENGE_BARS} bars.`));
  }
  if (issues.length === 0 && !readsBack(song)) problems.push(problem('lines', 'This song does not read back the same. Please report it with the song text.'));
  if (group === 'songs' && !song.meta.artist?.includes('(public domain)')) problems.push(problem('composer', 'A song needs "artist: <Composer> (public domain)" or "artist: Traditional (public domain)".', headerLine(text, 'artist')));
  if (!keys.has('title')) return problems;
  if (!name) problems.push(problem('title', 'The title needs letters or numbers.', headerLine(text, 'title')));
  else if (findBySlug(paths, `${family}/${name}`)) problems.push(problem('title', 'A bundled song already has this name. Change the title.', headerLine(text, 'title')));
  return problems;
}

function checklist(problems: readonly ProposalProblem[], group: ProposalGroup): ProposalCheckResult[] {
  const checks: ProposalCheck[] = group === 'songs' ? ['header', 'lines', 'bars', 'title', 'composer'] : ['header', 'lines', 'bars', 'title'];
  return checks.map(check => ({ check, label: CHECK_LABELS[check], problems: problems.filter(problem => problem.check === check) }));
}

export function proposeSong(text: string, group: ProposalGroup, paths: readonly string[]): Proposal {
  const sent = text.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  const parsed = parseSong(sent);
  const family = familyOf(parsed.song.meta.instrument);
  const name = proposalName(parsed.song.meta.title);
  const folder = `src/songs/${family}/${group}`;
  const fileName = name ? `${nextNumber(paths, family, group)}-${name}.txt` : '';
  const page = `${REPOSITORY}/new/${BRANCH}/${folder}?filename=${encodeURIComponent(fileName)}`;
  const value = encoded(sent);
  const filled = value === null ? '' : `${page}&value=${value}`;
  const carriesText = filled !== '' && filled.length <= MAX_PROPOSAL_URL;
  const problems = songProblems(sent, parsed, group, paths, family, name);
  return { title: parsed.song.meta.title, folder, fileName, text: sent, problems, checks: checklist(problems, group), url: carriesText ? filled : page, carriesText };
}
