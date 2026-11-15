import type { PassEnd } from '../audio/practicePasses';
import { CLEAN_SPEED, type BarLoop } from './practiceLog';

export interface Climb { enabled: boolean; startingSpeed: number | null; target: number }
export interface ClearedLoop { loop: BarLoop | null; startSpeed: number; speed: number; steps: number[]; passes: number; seconds: number; next: BarLoop | null }

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

const counted = (count: number, one: string, many: string) => `${NUMBER_WORDS[count] ?? count} ${count === 1 ? one : many}`;
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function barsLabel([first, last]: BarLoop): string {
  return first === last ? `bar ${first}` : `bars ${first} to ${last}`;
}

export function nextLoop([first, last]: BarLoop, barCount: number): BarLoop | null {
  if (last >= barCount) return null;
  return [last + 1, Math.min(barCount, last + 1 + last - first)];
}

export function clearedTitle({ loop, speed }: ClearedLoop): string {
  const what = loop ? capitalized(barsLabel(loop)) : 'The whole song';
  return `${what} at ${speed >= CLEAN_SPEED ? 'full speed' : `${speed}%`}.`;
}

export function clearedSummary({ startSpeed, speed, passes, seconds }: ClearedLoop): string {
  const effort = `${counted(passes, 'pass', 'passes')} and ${counted(Math.max(1, Math.round(seconds / 60)), 'minute', 'minutes')}`;
  return startSpeed < speed ? `You started at ${startSpeed}%. ${capitalized(effort)} later, it sits at ${speed}%.` : `${capitalized(effort)} in, it sits at ${speed}%.`;
}

export function clockTime(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The passes and playing time since the player last started a climb or a song, and the moment a loop is cleared. */
export class PracticeSession {
  private loopKey: string | null = null;
  private speeds: number[] = [];
  private seconds = 0;
  private since: number | null = null;
  private cleared = false;

  restart(now: number) {
    this.loopKey = null; this.speeds = []; this.seconds = 0; this.cleared = false;
    if (this.since !== null) this.since = now;
  }

  playing(playing: boolean, now: number) {
    if (this.since !== null) { this.seconds += Math.max(0, now - this.since) / 1000; this.since = null; }
    if (playing) this.since = now;
  }

  passEnded(pass: PassEnd, climb: Climb, barCount: number, now: number): ClearedLoop | null {
    const loop: BarLoop | null = pass.whole ? null : [pass.firstBar, pass.lastBar], key = loop?.join('-') ?? 'whole';
    if (key !== this.loopKey) { this.loopKey = key; this.speeds = []; this.cleared = false; }
    this.speeds.push(pass.speed);
    const done = climb.enabled ? pass.speed >= climb.target : pass.whole && pass.speed >= CLEAN_SPEED;
    if (!done || this.cleared) return null;
    this.cleared = true;
    const steps = this.speeds.filter((speed, i) => speed !== this.speeds[i - 1]);
    return {
      loop,
      startSpeed: climb.enabled ? climb.startingSpeed ?? steps[0] : steps[0],
      speed: pass.speed,
      steps,
      passes: this.speeds.length,
      seconds: this.seconds + (this.since === null ? 0 : Math.max(0, now - this.since) / 1000),
      next: loop ? nextLoop(loop, barCount) : null,
    };
  }
}
