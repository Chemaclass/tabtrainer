import { headerKeys, parseSong, type ParseResult } from '../core/parser';
import { serializeSong } from '../core/serialize';
import { familyOf, type Family } from '../core/instruments';
import type { Song } from '../core/model';
import { findBySlug } from './songLink';

export type ProposalGroup = 'exercises' | 'songs';
export interface Proposal {
  folder: string;
  fileName: string;
  text: string;
  problems: string[];
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

function songProblems(text: string, { song, issues }: ParseResult, group: ProposalGroup, paths: readonly string[], family: Family, name: string): string[] {
  const keys = headerKeys(text);
  const problems = CATALOGUE_HEADERS.filter(key => !keys.has(key)).map(key => `Add ${/^[aeiou]/.test(key) ? 'an' : 'a'} "${key}:" line at the top.`);
  if (keys.has('title') && PLACEHOLDER_TITLES.includes(song.meta.title.toLowerCase())) problems.push('Give the song its own title.');
  problems.push(...issues.map(issue => `Line ${issue.line}: ${issue.message}`));
  for (const version of song.versions) {
    if (version.bars.length < MIN_BARS) problems.push(song.versions.length > 1 ? `"${version.name}" needs at least ${MIN_BARS} bars.` : `The song needs at least ${MIN_BARS} bars.`);
    if (group === 'exercises' && version.name === 'Challenge' && version.bars.length < MIN_CHALLENGE_BARS) problems.push(`"Challenge" needs at least ${MIN_CHALLENGE_BARS} bars.`);
  }
  if (issues.length === 0 && !readsBack(song)) problems.push('This song does not read back the same. Please report it with the song text.');
  if (group === 'songs' && !song.meta.artist?.includes('(public domain)')) problems.push('A song needs "artist: <Composer> (public domain)" or "artist: Traditional (public domain)".');
  if (!keys.has('title')) return problems;
  if (!name) problems.push('The title needs letters or numbers.');
  else if (findBySlug(paths, `${family}/${name}`)) problems.push('A bundled song already has this name. Change the title.');
  return problems;
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
  return { folder, fileName, text: sent, problems: songProblems(sent, parsed, group, paths, family, name), url: carriesText ? filled : page, carriesText };
}
