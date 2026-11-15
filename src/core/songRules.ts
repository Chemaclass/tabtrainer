import { headerKeys, headerLines, parseSong } from './parser';
import { serializeSong } from './serialize';
import { parseGroove } from './groove';
import { familyOf, isFamily, type Family } from './instruments';
import type { Song } from './model';

export type SongGroup = 'exercises' | 'songs';
export interface SongFile { family: Family; group: SongGroup; number: string; name: string }
export type SongRule = 'header' | 'lines' | 'bars' | 'title';
export interface SongProblem { rule: SongRule; message: string; line?: number; col?: number }

export const HEADER_ORDER = ['title', 'artist', 'about', 'level', 'listen', 'instrument', 'tempo', 'key', 'time'];
const OPTIONAL_HEADERS = ['listen'];
const PLACEHOLDER_TITLES = ['new song', 'untitled'];
const MIN_BARS = 4;
const MIN_CHALLENGE_BARS = 16;
const TOP_LINE = 1;
const SONG_PATH = /(?:^|\/)songs\/([^/]+)\/(exercises|songs)\/(\d+)-([^/]+)\.txt$/;

// "Ólafur's  Tune!" -> "olafur-s-tune"
export const songName = (title: string) =>
  title.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "src/songs/bass/songs/09-orion.txt" or "./songs/bass/songs/09-orion.txt"
export function songFileAt(path: string): SongFile | null {
  const match = SONG_PATH.exec(path);
  if (!match || !isFamily(match[1])) return null;
  return { family: match[1], group: match[2] as SongGroup, number: match[3], name: match[4] };
}

const sameEvents = (a: Song, b: Song) => JSON.stringify(a.versions.map(v => v.bars.map(bar => bar.events))) === JSON.stringify(b.versions.map(v => v.bars.map(bar => bar.events)));

function readsBack(song: Song) {
  const again = parseSong(serializeSong(song));
  return again.issues.length === 0 && sameEvents(song, again.song);
}

function headerOrderProblems(text: string): SongProblem[] {
  const problems: SongProblem[] = [];
  let latest = -1;
  for (const { key, line } of headerLines(text)) {
    const place = HEADER_ORDER.indexOf(key);
    if (place === -1) continue;
    if (place < latest) problems.push({ rule: 'header', line, col: 1, message: `Move "${key}:" above "${HEADER_ORDER[latest]}:". The header goes ${HEADER_ORDER.join(', ')}.` });
    else latest = place;
  }
  return problems;
}

// A bundled file name may leave words of its title out: renaming it would break the song's links.
const namedAfter = (name: string, title: string) => {
  const words = new Set(songName(title).split('-'));
  return name.split('-').every(word => words.has(word));
};

// The line of a header, even one left empty, or the top line when it is missing.
export function headerLine(text: string, key: string): number {
  const index = text.split('\n').findIndex(line => new RegExp(`^\\s*${key}\\s*:`, 'i').test(line));
  return index < 0 ? TOP_LINE : index + 1;
}

function placeProblems(text: string, song: Song, file: SongFile, catalogue: readonly string[]): SongProblem[] {
  const atTitle = (message: string): SongProblem => ({ rule: 'title', message, line: headerLine(text, 'title') });
  const title = songName(song.meta.title);
  if (!title) return [atTitle('The title needs letters or numbers.')];
  const problems: SongProblem[] = [];
  const family = familyOf(song.meta.instrument);
  if (family !== file.family) problems.push({ rule: 'header', message: `The "instrument:" line is a ${family}, so the file goes in src/songs/${family}/${file.group}.`, line: headerLine(text, 'instrument') });
  if (!namedAfter(file.name, song.meta.title)) problems.push(atTitle(`Name the file after the title, such as ${file.number}-${title}.txt.`));
  const others = catalogue.flatMap(path => songFileAt(path) ?? []).filter(other => other.group !== file.group || other.number !== file.number || other.name !== file.name);
  if (others.some(other => other.family === file.family && other.name === file.name)) problems.push(atTitle('A bundled song already has this name. Change the title.'));
  const sameNumber = others.find(other => other.family === file.family && other.group === file.group && Number(other.number) === Number(file.number));
  if (sameNumber) problems.push(atTitle(`Number ${file.number} is taken by ${sameNumber.number}-${sameNumber.name}.txt. Use a free number.`));
  return problems;
}

export function songProblems(text: string, file: SongFile, catalogue: readonly string[]): SongProblem[] {
  const { song, issues } = parseSong(text);
  const keys = headerKeys(text);
  const problems: SongProblem[] = HEADER_ORDER.filter(key => !OPTIONAL_HEADERS.includes(key) && !keys.has(key))
    .map(key => ({ rule: 'header', message: `Add ${/^[aeiou]/.test(key) ? 'an' : 'a'} "${key}:" line at the top.`, line: headerLine(text, key) }));
  problems.push(...headerOrderProblems(text));
  if (keys.has('title') && PLACEHOLDER_TITLES.includes(song.meta.title.toLowerCase())) problems.push({ rule: 'title', message: 'Give the song its own title.', line: headerLine(text, 'title') });
  problems.push(...issues.map(({ line, col, message }): SongProblem => ({ rule: 'lines', line, col, message })));
  for (const version of song.versions) {
    if (version.bars.length < MIN_BARS) problems.push({ rule: 'bars', message: song.versions.length > 1 ? `"${version.name}" needs at least ${MIN_BARS} bars.` : `The song needs at least ${MIN_BARS} bars.` });
    if (file.group === 'exercises' && version.name === 'Challenge' && version.bars.length < MIN_CHALLENGE_BARS) problems.push({ rule: 'bars', message: `"Challenge" needs at least ${MIN_CHALLENGE_BARS} bars.` });
  }
  if (issues.length === 0 && !readsBack(song)) problems.push({ rule: 'lines', message: 'This song does not read back the same. Please report it with the song text.' });
  if (keys.has('title')) problems.push(...placeProblems(text, song, file, catalogue));
  return problems;
}

export function grooveProblems(text: string): SongProblem[] {
  const { groove, issues } = parseGroove(text);
  const problems = issues.map(({ line, col, message }): SongProblem => ({ rule: 'lines', line, col, message }));
  const missing = (key: string): SongProblem => ({ rule: 'header', message: `Add ${/^[aeiou]/.test(key) ? 'an' : 'a'} "${key}:" line at the top.`, line: headerLine(text, key) });
  if (!text.split('\n').some(line => /^title\s*:\s*\S/.test(line))) problems.push(missing('title'));
  if (!groove.genre) problems.push(missing('genre'));
  if (!groove.about) problems.push(missing('about'));
  return problems;
}

// "src/songs/bass/songs/10-my-song.txt:13:17 error Can't read ..."
export const formatProblem = (path: string, { line, col, message }: SongProblem) =>
  `${line ? `${path}:${line}:${col ?? 1}` : `${path}:`} error ${message}`;
