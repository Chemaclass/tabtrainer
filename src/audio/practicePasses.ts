import { advanceSpeedPractice, type SpeedPracticeConfig, type SpeedPracticeProgress } from '../core/speedPractice';
import type { BarSpan } from '../core/timeline';

export interface PracticePass { start: number; end: number; from: number; speed: number; eligible: boolean; id: number; progress: SpeedPracticeProgress }
export interface LoopedPassage { from: number; to: number; tempo: number; seconds?: number }
export interface PassEnd { firstBar: number; lastBar: number; whole: boolean; speed: number }

const EPSILON = 1e-6;

export function passEnd(bars: readonly BarSpan[], total: number, from: number, to: number, speed: number): PassEnd | null {
  const first = bars.find(bar => from >= bar.start - EPSILON && from < bar.start + bar.length - EPSILON);
  const last = [...bars].reverse().find(bar => to > bar.start + EPSILON && to <= bar.start + bar.length + EPSILON);
  if (!first || !last || to - from <= EPSILON) return null;
  return { firstBar: first.bar, lastBar: last.bar, whole: from <= EPSILON && to >= total - EPSILON, speed: Math.round(speed * 100) };
}

export class PracticePasses {
  private passes: PracticePass[] = [];
  private previous: PracticePass | null = null;
  private nextId = 1;

  get current(): PracticePass | undefined { return this.passes[0]; }
  get isEmpty() { return this.passes.length === 0; }

  begin(pass: Omit<PracticePass, 'id'>) {
    this.previous = null;
    this.passes = [{ ...pass, id: this.nextId++ }];
  }
  clear() { this.passes = []; }
  extend(until: number, passage: LoopedPassage, config: SpeedPracticeConfig) {
    if (this.isEmpty) return;
    let pass = this.passes[this.passes.length - 1];
    while (pass.end <= until && passage.to > passage.from) {
      const progress = pass.eligible ? advanceSpeedPractice(pass.progress, config) : pass.progress;
      const speed = progress.speed / 100, duration = (passage.seconds ?? (passage.to - passage.from) * 60 / passage.tempo) / speed;
      let start = pass.end;
      if (progress.speed >= config.target && until - start > duration * 2) start += Math.floor((until - start) / duration - 1) * duration;
      pass = { start, end: start + duration, from: passage.from, speed, eligible: true, id: this.nextId++, progress };
      this.passes.push(pass);
    }
  }
  *finish(now: number): Generator<{ finished: PracticePass; next: PracticePass }> {
    while (this.passes.length > 1 && this.passes[0].end <= now) {
      const finished = this.passes.shift()!;
      this.previous = finished;
      yield { finished, next: this.passes[0] };
    }
  }
  at(now: number): PracticePass | undefined {
    if (this.previous && now < this.previous.end) return this.previous;
    return this.passes.find(p => now < p.end) ?? this.passes[this.passes.length - 1];
  }
  overlapping(start: number, end: number) { return this.passes.filter(p => p.end > start && p.start < end); }
}
