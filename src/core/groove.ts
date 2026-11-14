import { BASS_DEGREES, parseNumeral, type Numeral } from './harmony';
import type { ParseIssue } from './parser';
import { isKey } from './theory';

export const DRUMS = ['kick', 'snare', 'rim', 'hat', 'halfhat', 'openhat', 'pedalhat', 'ride', 'bell', 'crash', 'hightom', 'midtom', 'lowtom'] as const;
export type Drum = typeof DRUMS[number];
export const DRUM_KITS = ['rock', 'blues', 'funk', 'reggae', 'jazz', 'metal', 'electronic'] as const;
export type DrumKitName = typeof DRUM_KITS[number];
export type GroovePart = Drum | 'bass' | 'keys';
export const KEYS_VOICES = ['keys', 'organ', 'drive'] as const;
export type KeysVoice = typeof KEYS_VOICES[number];
export const APPROACH = '>';
export const HALF_STEP_BELOW = 'b1';

export interface GrooveGrid { part: GroovePart; bars: string[][]; line: number }

export interface Groove {
  title: string;
  genre: string;
  about?: string;
  tempo: number;
  key: string;
  time: [number, number];
  swing: number;
  progression: Numeral[];
  voice: KeysVoice;
  kit: DrumKitName;
  fill: boolean;
  grids: GrooveGrid[];
}

export interface GrooveResult { groove: Groove; issues: ParseIssue[] }

const LINE = /^\s*([a-z]+)\s*:\s*(.*?)\s*$/i;
const PARTS: readonly string[] = [...DRUMS, 'bass', 'keys'];
const DRUM_STEPS = ['x', 'X', 'o', '.'];
const KEYS_STEPS = ['x', 'X', '.', '-'];
const APPROACH_STEPS = [...BASS_DEGREES, HALF_STEP_BELOW].map(degree => APPROACH + degree);
const BASS_STEPS: readonly string[] = [...BASS_DEGREES, ...APPROACH_STEPS, '.', '-'];

const isPart = (name: string): name is GroovePart => PARTS.includes(name);
const isVoice = (name: string): name is KeysVoice => (KEYS_VOICES as readonly string[]).includes(name);
const isDrumKit = (name: string): name is DrumKitName => (DRUM_KITS as readonly string[]).includes(name);
const FILL_SWITCH: Record<string, boolean> = { on: true, off: false };
const stepsOf = (part: GroovePart): readonly string[] => (part === 'bass' ? BASS_STEPS : part === 'keys' ? KEYS_STEPS : DRUM_STEPS);
const splitSteps = (part: GroovePart, bar: string) => (part === 'bass' ? bar.trim().split(/\s+/).filter(Boolean) : bar.replace(/\s+/g, '').split(''));

export function parseGroove(src: string): GrooveResult {
  const issues: ParseIssue[] = [];
  const warn = (line: number, message: string, col = 1) => issues.push({ line, col, message, severity: 'warning' });
  const groove: Groove = { title: 'Untitled', genre: '', tempo: 90, key: 'C', time: [4, 4], swing: 50, progression: [], voice: 'keys', kit: 'rock', fill: false, grids: [] };
  const rawGrids: { part: GroovePart; text: string; line: number }[] = [];
  let progressionLine = 0;

  src.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const line = i + 1;
    if (/^\s*#/.test(raw)) return;
    // "#IV" is a numeral, so later on a line only "#" followed by a space starts a comment
    const text = raw.replace(/\s#(\s.*)?$/, '');
    if (!text.trim()) return;
    const m = LINE.exec(text);
    if (!m) { warn(line, `Expected a line like "kick: x...x..." (got "${text.trim()}")`); return; }
    const name = m[1].toLowerCase(); const v = m[2];
    if (name === 'title') groove.title = v;
    else if (name === 'genre') groove.genre = v;
    else if (name === 'about') groove.about = v;
    else if (name === 'tempo') { const t = parseFloat(v); if (t >= 20 && t <= 400) groove.tempo = t; else warn(line, `Tempo must be between 20 and 400 (got "${v}")`); }
    else if (name === 'key') { if (isKey(v)) groove.key = v; else warn(line, `Unknown key "${v}": use a key like A, Bb or F#m`); }
    else if (name === 'time') {
      const r = /^(\d+)\/(2|4|8|16)$/.exec(v);
      if (r && +r[1] >= 1 && +r[1] <= 32) groove.time = [+r[1], +r[2]];
      else warn(line, `Time signature like 4/4 expected (got "${v}")`);
    }
    else if (name === 'swing') { const s = /^\d+$/.test(v) ? Number(v) : NaN; if (s >= 50 && s <= 75) groove.swing = s; else warn(line, `Swing must be a whole number from 50 (straight) to 75 (got "${v}")`); }
    else if (name === 'progression') {
      if (progressionLine) { warn(line, `There is already a "progression:" line (line ${progressionLine})`); return; }
      progressionLine = line;
      const re = /[^\s|]+/g; let t: RegExpExecArray | null;
      while ((t = re.exec(v))) {
        const r = parseNumeral(t[0]);
        if ('error' in r) warn(line, r.error, text.indexOf(v) + t.index + 1);
        else groove.progression.push(r.numeral);
      }
    }
    else if (name === 'voice') { if (isVoice(v)) groove.voice = v; else warn(line, `Unknown voice "${v}": use ${KEYS_VOICES.join(', ')}`); }
    else if (name === 'kit') { if (isDrumKit(v)) groove.kit = v; else warn(line, `Unknown kit "${v}": use ${DRUM_KITS.join(', ')}`); }
    else if (name === 'fill') { if (Object.hasOwn(FILL_SWITCH, v)) groove.fill = FILL_SWITCH[v]; else warn(line, `Fill must be on or off (got "${v}")`); }
    else if (isPart(name)) {
      if (rawGrids.some(g => g.part === name)) warn(line, `There is already a "${name}:" line`);
      else rawGrids.push({ part: name, text: v, line });
    }
    else warn(line, `Unknown line "${m[1]}:": use a header (title, genre, about, tempo, key, time, swing, progression, voice, kit, fill) or a part (${PARTS.join(', ')})`);
  });

  if (!groove.progression.length) warn(1, 'No progression yet. Add a line like:  progression: I7 IV7 I7 V7');

  const [beats, beatValue] = groove.time;
  const stepCounts = (beatValue >= 8 ? [1, 2] : [2, 3, 4]).map(n => n * beats);
  for (const { part, text, line } of rawGrids) {
    const bars = text.split('|').map(bar => splitSteps(part, bar));
    if (bars.length > 1 && !bars[bars.length - 1].length) bars.pop();
    const allowed = stepsOf(part);
    const before = issues.length;
    bars.forEach((steps, b) => {
      const where = bars.length > 1 ? `"${part}:" bar ${b + 1}` : `"${part}:"`;
      if (!steps.length) { if (bars.length > 1) warn(line, `${where} is empty`); return; }
      if (!stepCounts.includes(steps.length)) warn(line, `${where} has ${steps.length} steps, which do not fit a ${beats}/${beatValue} bar: use ${stepCounts.join(', ')}`);
      const bad = steps.find(s => !allowed.includes(s));
      if (bad) warn(line, `${where} has an unknown step "${bad}": use ${allowed.join(' ')}`);
      else if (steps.some((s, i) => s === '-' && (i === 0 || steps[i - 1] === '.'))) warn(line, `${where} has a "-" with no note before it to hold`);
    });
    if (!bars.some(steps => steps.length)) warn(line, `"${part}:" has no steps`);
    if (issues.length > before) continue;
    groove.grids.push({ part, bars, line });
    if (groove.progression.length && bars.length > groove.progression.length) warn(line, `"${part}:" has ${bars.length} bars, but the progression has only ${groove.progression.length}`);
  }
  return { groove, issues };
}
