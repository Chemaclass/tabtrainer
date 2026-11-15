import type { BarSpan } from './timeline';

export class TempoMap {
  private points: { beat: number; seconds: number; tempo: number }[];

  constructor(bars: BarSpan[], tempo: number) {
    this.points = [{ beat: 0, seconds: 0, tempo }];
    for (const bar of bars) {
      if (bar.tempo === undefined) continue;
      const seconds = this.secondsAt(bar.start);
      this.points.push({ beat: bar.start, seconds, tempo: bar.tempo });
    }
  }

  tempoAt(beat: number): number {
    return this.atBeat(beat).tempo;
  }

  secondsBetween(from: number, to: number): number {
    return this.secondsAt(to) - this.secondsAt(from);
  }

  advance(from: number, seconds: number): number {
    const target = this.secondsAt(from) + seconds;
    let point = this.points[0];
    for (const next of this.points) {
      if (next.seconds > target) break;
      point = next;
    }
    return point.beat + (target - point.seconds) * point.tempo / 60;
  }

  private atBeat(beat: number) {
    let point = this.points[0];
    for (const next of this.points) {
      if (next.beat > beat) break;
      point = next;
    }
    return point;
  }

  private secondsAt(beat: number): number {
    const point = this.atBeat(beat);
    return point.seconds + (beat - point.beat) * 60 / point.tempo;
  }
}
