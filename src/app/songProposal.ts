import { parseSong } from '../core/parser';
import { familyOf, type Family } from '../core/instruments';
import { headerLine, songName, songProblems, type SongGroup, type SongRule } from '../core/songRules';
import { savedRef } from './songRef';
import type { Saved } from './storage';

export type ProposalGroup = SongGroup;
export type ProposalCheck = SongRule | 'composer';
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
const CHECK_LABELS: Record<ProposalCheck, string> = {
  header: 'The header lines are filled in',
  lines: 'Every line reads',
  bars: 'Enough bars to practise',
  title: 'A title of its own',
  composer: 'A public domain composer',
};

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

// An unpaired surrogate cannot be encoded, so such a text has to be pasted.
function encoded(text: string): string | null {
  try { return encodeURIComponent(text); } catch { return null; }
}

// Bundled songs from before the catalogue opened keep their artists, so only a proposal is held to this.
function composerProblems(text: string, artist: string | undefined, group: ProposalGroup): ProposalProblem[] {
  if (group !== 'songs' || artist?.includes('(public domain)')) return [];
  return [{ check: 'composer', message: 'A song needs "artist: <Composer> (public domain)" or "artist: Traditional (public domain)".', line: headerLine(text, 'artist') }];
}

function checklist(problems: readonly ProposalProblem[], group: ProposalGroup): ProposalCheckResult[] {
  const checks: ProposalCheck[] = group === 'songs' ? ['header', 'lines', 'bars', 'title', 'composer'] : ['header', 'lines', 'bars', 'title'];
  return checks.map(check => ({ check, label: CHECK_LABELS[check], problems: problems.filter(problem => problem.check === check) }));
}

export const withOpenDraft = (songs: readonly Saved[], picked: string, draft: string | null): Saved[] =>
  songs.map(song => draft !== null && savedRef(song.title) === picked ? { ...song, text: draft } : song);

export function proposeSong(text: string, group: ProposalGroup, paths: readonly string[]): Proposal {
  const sent = text.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  const parsed = parseSong(sent);
  const family = familyOf(parsed.song.meta.instrument);
  const name = songName(parsed.song.meta.title);
  const folder = `src/songs/${family}/${group}`;
  const number = nextNumber(paths, family, group);
  const fileName = name ? `${number}-${name}.txt` : '';
  const page = `${REPOSITORY}/new/${BRANCH}/${folder}?filename=${encodeURIComponent(fileName)}`;
  const value = encoded(sent);
  const filled = value === null ? '' : `${page}&value=${value}`;
  const carriesText = filled !== '' && filled.length <= MAX_PROPOSAL_URL;
  const problems: ProposalProblem[] = [
    ...songProblems(sent, { family, group, number, name }, paths).map(({ rule, message, line }) => ({ check: rule, message, line: line ?? null })),
    ...composerProblems(sent, parsed.song.meta.artist, group),
  ];
  return { title: parsed.song.meta.title, folder, fileName, text: sent, problems, checks: checklist(problems, group), url: carriesText ? filled : page, carriesText };
}
