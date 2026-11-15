import { BASS_DEGREES, parseNumeral, type Numeral } from './harmony';
import { NO_TOKEN, hinted, spanOf, valueSpan, type GrooveIssueCode, type IssueSpan, type ParseIssue } from './parseIssue';
import { isKey } from './theory';

export const DRUMS = ['kick', 'snare', 'rim', 'hat', 'halfhat', 'openhat', 'pedalhat', 'ride', 'bell', 'crash', 'hightom', 'midtom', 'lowtom'] as const;
export type Drum = typeof DRUMS[number];
export const HAT_DRUMS: readonly Drum[] = ['hat', 'halfhat', 'openhat', 'pedalhat'];
export const FILL_BEATS = 2;
export const DRUM_KITS = ['rock', 'blues', 'funk', 'reggae', 'jazz', 'metal', 'electronic'] as const;
export type DrumKitName = typeof DRUM_KITS[number];
export type GroovePart = Drum | 'bass' | 'keys';
export const KEYS_VOICES = ['keys', 'organ', 'drive'] as const;
export type KeysVoice = typeof KEYS_VOICES[number];
export const BACKING_PARTS = ['drums', 'bass', 'keys'] as const;
export type BackingPart = typeof BACKING_PARTS[number];
export const APPROACH = '>';
export const HALF_STEP_BELOW = 'b1';
export const REST = '.';
export const HOLD = '-';
const QUARTERS_PER_WHOLE_NOTE = 4;

/** Beats in a bar, counted in quarter notes: 6/8 has three. */
export const barLength = ([beats, beatValue]: [number, number]) => (beats * QUARTERS_PER_WHOLE_NOTE) / beatValue;

/** A meter counted in eighth or sixteenth notes, such as 6/8 or 7/16. */
export const hasShortBeats = ([, beatValue]: [number, number]) => beatValue >= 8;

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
const COMMENT_LINE = /^\s*#/;
// "#IV" is a numeral, so later on a line only "#" followed by a space starts a comment
const TRAILING_COMMENT = /\s#(\s.*)?$/;
const TIME_SIGNATURE = /^(\d+)\/(2|4|8|16)$/;
const NUMERAL_TOKEN = /[^\s|]+/g;
const TEXT_HEADERS = ['title', 'genre', 'about'] as const;
const HEADERS = [...TEXT_HEADERS, 'tempo', 'key', 'time', 'swing', 'progression', 'voice', 'kit', 'fill'];
const PARTS: readonly string[] = [...DRUMS, 'bass', 'keys'];
const DRUM_STEPS = ['x', 'X', 'o', REST];
const KEYS_STEPS = ['x', 'X', REST, HOLD];
const APPROACH_STEPS = [...BASS_DEGREES, HALF_STEP_BELOW].map(degree => APPROACH + degree);
const BASS_STEPS: readonly string[] = [...BASS_DEGREES, ...APPROACH_STEPS, REST, HOLD];
const TEMPO_RANGE = { min: 20, max: 400 };
const SWING_RANGE = { straight: 50, max: 75 };
const MAX_BEATS = 32;
const STEPS_PER_SHORT_BEAT = [1, 2];
const STEPS_PER_BEAT = [2, 3, 4];
const FILL_SWITCH: Record<string, boolean> = { on: true, off: false };

const isTextHeader = (name: string): name is typeof TEXT_HEADERS[number] => (TEXT_HEADERS as readonly string[]).includes(name);
const isPart = (name: string): name is GroovePart => PARTS.includes(name);
const isVoice = (name: string): name is KeysVoice => (KEYS_VOICES as readonly string[]).includes(name);
const isDrumKit = (name: string): name is DrumKitName => (DRUM_KITS as readonly string[]).includes(name);

function stepsOf(part: GroovePart): readonly string[] {
  if (part === 'bass') return BASS_STEPS;
  if (part === 'keys') return KEYS_STEPS;
  return DRUM_STEPS;
}

interface Step { text: string; col: number }
interface RawBar { steps: Step[]; at: IssueSpan }

/** Bass steps are words split by spaces; every other part is one character per step. */
function stepsAt(part: GroovePart, bar: string, col: number): Step[] {
  const step = part === 'bass' ? /\S+/g : /\S/g;
  return [...bar.matchAll(step)].map(found => ({ text: found[0], col: col + found.index }));
}

function barsAt(part: GroovePart, grid: string, at: IssueSpan): RawBar[] {
  let col = at.col;
  const bars = grid.split('|').map(bar => {
    const steps = stepsAt(part, bar, col);
    const raw = { steps, at: { line: at.line, col, length: bar.length } };
    col += bar.length + 1;
    return raw;
  });
  if (bars.length > 1 && !bars[bars.length - 1].steps.length) bars.pop();
  return bars;
}

const emptyHold = (steps: readonly Step[]) => steps.find((step, i) => step.text === HOLD && (i === 0 || steps[i - 1].text === REST));

function defaultGroove(): Groove {
  return { title: 'Untitled', genre: '', tempo: 90, key: 'C', time: [4, 4], swing: SWING_RANGE.straight, progression: [], voice: 'keys', kit: 'rock', fill: false, grids: [] };
}

interface RawGrid { part: GroovePart; text: string; at: IssueSpan }

class GrooveReader {
  readonly groove = defaultGroove();
  readonly issues: ParseIssue[] = [];
  private rawGrids: RawGrid[] = [];
  private progressionLine = 0;
  private fillAt = NO_TOKEN;

  warn(code: GrooveIssueCode, at: IssueSpan, details: Pick<ParseIssue, 'message' | 'hint'> | string) {
    this.issues.push({ ...at, code, severity: 'warning', ...(typeof details === 'string' ? { message: details } : details) });
  }

  readLine(raw: string, line: number) {
    if (COMMENT_LINE.test(raw)) return;
    const text = raw.replace(TRAILING_COMMENT, '');
    if (!text.trim()) return;
    const match = LINE.exec(text);
    if (!match) {
      this.warn('line-unreadable', { line, col: text.search(/\S/) + 1, length: text.trim().length }, `Expected a line like "kick: x...x..." (got "${text.trim()}")`);
      return;
    }
    const [, written, value] = match;
    this.readField(written, value, valueSpan(text, line, value), valueSpan(text, line, ''));
  }

  private readField(written: string, value: string, at: IssueSpan, keyAt: IssueSpan) {
    const name = written.toLowerCase();
    if (isTextHeader(name)) {
      this.groove[name] = value;
      return;
    }
    switch (name) {
      case 'tempo': return this.readTempo(value, at);
      case 'key': return this.readKey(value, at);
      case 'time': return this.readTime(value, at);
      case 'swing': return this.readSwing(value, at);
      case 'progression': return this.readProgression(value, at, keyAt);
      case 'voice': return this.readVoice(value, at);
      case 'kit': return this.readKit(value, at);
      case 'fill': return this.readFill(value, at);
    }
    if (isPart(name)) return this.readGrid(name, value, at, keyAt);
    this.warn('line-unknown', keyAt, hinted(`Unknown line "${written}:":`, `use a header (${HEADERS.join(', ')}) or a part (${PARTS.join(', ')})`));
  }

  private readTempo(value: string, at: IssueSpan) {
    const tempo = parseFloat(value);
    if (tempo >= TEMPO_RANGE.min && tempo <= TEMPO_RANGE.max) this.groove.tempo = tempo;
    else this.warn('tempo-range', at, `Tempo must be between ${TEMPO_RANGE.min} and ${TEMPO_RANGE.max} (got "${value}")`);
  }

  private readKey(value: string, at: IssueSpan) {
    if (isKey(value)) this.groove.key = value;
    else this.warn('key-unknown', at, hinted(`Unknown key "${value}":`, 'use a key like A, Bb or F#m'));
  }

  private readTime(value: string, at: IssueSpan) {
    const match = TIME_SIGNATURE.exec(value);
    const beats = match ? Number(match[1]) : 0;
    if (match && beats >= 1 && beats <= MAX_BEATS) this.groove.time = [beats, Number(match[2])];
    else this.warn('time-signature', at, `Time signature like 4/4 expected (got "${value}")`);
  }

  private readSwing(value: string, at: IssueSpan) {
    const swing = /^\d+$/.test(value) ? Number(value) : NaN;
    if (swing >= SWING_RANGE.straight && swing <= SWING_RANGE.max) this.groove.swing = swing;
    else this.warn('swing-range', at, `Swing must be a whole number from ${SWING_RANGE.straight} (straight) to ${SWING_RANGE.max} (got "${value}")`);
  }

  private readProgression(value: string, at: IssueSpan, keyAt: IssueSpan) {
    if (this.progressionLine) {
      this.warn('progression-duplicate', keyAt, `There is already a "progression:" line (line ${this.progressionLine})`);
      return;
    }
    this.progressionLine = at.line;
    for (const token of value.matchAll(NUMERAL_TOKEN)) {
      const result = parseNumeral(token[0]);
      if ('error' in result) this.warn('numeral-unknown', { line: at.line, col: at.col + token.index, length: token[0].length }, result.error);
      else this.groove.progression.push(result.numeral);
    }
  }

  private readVoice(value: string, at: IssueSpan) {
    if (isVoice(value)) this.groove.voice = value;
    else this.warn('voice-unknown', at, hinted(`Unknown voice "${value}":`, `use ${KEYS_VOICES.join(', ')}`));
  }

  private readKit(value: string, at: IssueSpan) {
    if (isDrumKit(value)) this.groove.kit = value;
    else this.warn('kit-unknown', at, hinted(`Unknown kit "${value}":`, `use ${DRUM_KITS.join(', ')}`));
  }

  private readFill(value: string, at: IssueSpan) {
    if (!Object.hasOwn(FILL_SWITCH, value)) {
      this.warn('fill-switch', at, `Fill must be on or off (got "${value}")`);
      return;
    }
    this.groove.fill = FILL_SWITCH[value];
    this.fillAt = at;
  }

  private readGrid(part: GroovePart, text: string, at: IssueSpan, keyAt: IssueSpan) {
    if (this.rawGrids.some(grid => grid.part === part)) this.warn('grid-duplicate', keyAt, `There is already a "${part}:" line`);
    else this.rawGrids.push({ part, text, at: text ? at : keyAt });
  }

  finish(): GrooveResult {
    const { groove } = this;
    if (!groove.progression.length) this.warn('progression-missing', NO_TOKEN, hinted('No progression yet.', 'Add a line like:  progression: I7 IV7 I7 V7'));
    const [beats, beatValue] = groove.time;
    if (groove.fill && barLength(groove.time) < FILL_BEATS) {
      this.warn('fill-short', this.fillAt, `A fill needs a bar of at least ${FILL_BEATS} beats, so this ${beats}/${beatValue} groove plays none`);
    }
    for (const rawGrid of this.rawGrids) this.addGrid(rawGrid);
    return { groove, issues: this.issues };
  }

  private addGrid({ part, text, at }: RawGrid) {
    const rawBars = barsAt(part, text, at);
    const before = this.issues.length;
    rawBars.forEach((bar, index) => this.checkBar(part, bar, rawBars.length > 1 ? index + 1 : null));
    if (!rawBars.some(bar => bar.steps.length)) this.warn('grid-empty', at, `"${part}:" has no steps`);
    if (this.issues.length > before) return;
    const bars = rawBars.map(bar => bar.steps.map(step => step.text));
    this.groove.grids.push({ part, bars, line: at.line });
    const chords = this.groove.progression.length;
    if (chords && bars.length > chords) this.warn('grid-long', at, `"${part}:" has ${bars.length} bars, but the progression has only ${chords}`);
  }

  /** barNumber is null when the grid has a single bar, which then goes unnamed. */
  private checkBar(part: GroovePart, { steps, at }: RawBar, barNumber: number | null) {
    const where = barNumber === null ? `"${part}:"` : `"${part}:" bar ${barNumber}`;
    if (!steps.length) {
      if (barNumber !== null) this.warn('bar-empty', at, `${where} is empty`);
      return;
    }
    const barAt = { line: at.line, col: steps[0].col, length: steps[steps.length - 1].col + steps[steps.length - 1].text.length - steps[0].col };
    const [beats, beatValue] = this.groove.time;
    const stepCounts = (hasShortBeats(this.groove.time) ? STEPS_PER_SHORT_BEAT : STEPS_PER_BEAT).map(perBeat => perBeat * beats);
    if (!stepCounts.includes(steps.length)) {
      this.warn('bar-steps', barAt, hinted(`${where} has ${steps.length} steps, which do not fit a ${beats}/${beatValue} bar:`, `use ${stepCounts.join(', ')}`));
    }
    const allowed = stepsOf(part);
    const unknown = steps.find(step => !allowed.includes(step.text));
    const hold = emptyHold(steps);
    if (unknown) this.warn('step-unknown', spanOf({ ...unknown, line: at.line }), hinted(`${where} has an unknown step "${unknown.text}":`, `use ${allowed.join(' ')}`));
    else if (hold) this.warn('hold-empty', spanOf({ ...hold, line: at.line }), `${where} has a "${HOLD}" with no note before it to hold`);
  }
}

export function parseGroove(src: string): GrooveResult {
  const reader = new GrooveReader();
  src.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => reader.readLine(raw, index + 1));
  return reader.finish();
}
