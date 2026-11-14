import { describe, expect, it } from 'vitest';
import { PracticePasses } from '../../src/audio/practicePasses';

const passage = { from: 0, to: 8, tempo: 60 };
const config = { repetitions: 2, increase: 10, target: 120 };
const started = (eligible = true, from = 0) => {
  const passes = new PracticePasses();
  passes.begin({ start: 0, end: 8 - from, from, speed: 1, eligible, progress: { speed: 100, completed: 0 } });
  return passes;
};
const finishAll = (passes: PracticePasses, now: number) => [...passes.finish(now)];

describe('practice passes', () => {
  it('starts with one pass and numbers each new pass', () => {
    const passes = started();
    expect(passes.current).toMatchObject({ start: 0, end: 8, id: 1 });
    passes.begin({ start: 2, end: 10, from: 0, speed: 1, eligible: true, progress: { speed: 100, completed: 0 } });
    expect(passes.current?.id).toBe(2);
  });
  it('adds passes from the passage start until they cover the time', () => {
    const passes = started(true, 4);
    passes.extend(4, passage, config);
    const ids = finishAll(passes, 4).map(({ finished, next }) => [finished.id, next.id]);
    expect(ids).toEqual([[1, 2]]);
    expect(passes.current).toMatchObject({ start: 4, end: 12, from: 0, eligible: true, progress: { speed: 100, completed: 1 } });
  });
  it('speeds up after the set repetitions and shortens the pass', () => {
    const passes = started();
    passes.extend(16, passage, config);
    finishAll(passes, 16);
    expect(passes.current).toMatchObject({ start: 16, speed: 1.1, progress: { speed: 110, completed: 0 } });
    expect(passes.current!.end).toBeCloseTo(16 + 8 / 1.1);
  });
  it('does not count a pass that started mid passage', () => {
    const passes = started(false, 4);
    passes.extend(4, passage, config);
    finishAll(passes, 4);
    expect(passes.current?.progress).toEqual({ speed: 100, completed: 0 });
  });
  it('skips ahead in whole passes once the target is held', () => {
    const passes = new PracticePasses();
    passes.begin({ start: 0, end: 8, from: 0, speed: 1.2, eligible: true, progress: { speed: 120, completed: 0 } });
    passes.extend(100, passage, config);
    const finished = finishAll(passes, 100);
    expect(finished).toHaveLength(2);
    expect(passes.current!.start).toBeLessThanOrEqual(100);
    expect(passes.current!.end).toBeGreaterThan(100);
  });
  it('keeps the last pass when nothing follows it', () => {
    const passes = started();
    expect(finishAll(passes, 50)).toEqual([]);
    expect(passes.current?.id).toBe(1);
  });
  it('stays on a finished pass until its end, then reports the next one', () => {
    const passes = started();
    passes.extend(8, passage, config);
    finishAll(passes, 8);
    expect(passes.at(7)?.id).toBe(1);
    expect(passes.at(9)?.id).toBe(2);
    expect(passes.at(99)?.id).toBe(2);
  });
  it('lists the passes that overlap a time window', () => {
    const passes = started();
    passes.extend(8, passage, config);
    expect(passes.overlapping(7, 9).map(p => p.id)).toEqual([1, 2]);
    expect(passes.overlapping(8, 9).map(p => p.id)).toEqual([2]);
  });
  it('adds no passes for an empty passage or once cleared', () => {
    const passes = started();
    passes.extend(20, { ...passage, to: 0 }, config);
    expect(passes.overlapping(0, 100)).toHaveLength(1);
    passes.clear();
    expect(passes.isEmpty).toBe(true);
    passes.extend(20, passage, config);
    expect(passes.isEmpty).toBe(true);
  });
  it('stops finishing passes when they are cleared mid loop', () => {
    const passes = started();
    passes.extend(24, passage, config);
    const ids: number[] = [];
    for (const { finished } of passes.finish(24)) { ids.push(finished.id); if (ids.length === 2) passes.clear(); }
    expect(ids).toEqual([1, 2]);
  });
  it('lets a nested finish drain the remaining passes', () => {
    const passes = started();
    passes.extend(24, passage, config);
    const outer: number[] = [], inner: number[] = [];
    for (const { finished } of passes.finish(24)) {
      outer.push(finished.id);
      if (outer.length === 1) inner.push(...finishAll(passes, 24).map(({ finished }) => finished.id));
    }
    expect(outer).toEqual([1]);
    expect(inner).toEqual([2, 3]);
    expect(passes.current?.id).toBe(4);
  });
  it('keeps numbering passes after a clear', () => {
    const passes = started();
    passes.clear();
    passes.begin({ start: 0, end: 8, from: 0, speed: 1, eligible: true, progress: { speed: 100, completed: 0 } });
    expect(passes.current?.id).toBe(2);
  });
  it('forgets the finished pass when a new one begins', () => {
    const passes = started();
    passes.extend(8, passage, config);
    finishAll(passes, 8);
    passes.begin({ start: 5, end: 13, from: 0, speed: 1, eligible: true, progress: { speed: 100, completed: 0 } });
    expect(passes.at(6)?.id).toBe(passes.current?.id);
  });
  it('makes passes after a partial one eligible', () => {
    const passes = started(false, 4);
    passes.extend(4, passage, config);
    finishAll(passes, 4);
    expect(passes.current?.eligible).toBe(true);
  });
  it('treats a pass end as the start of the next pass', () => {
    const passes = started();
    passes.extend(8, passage, config);
    expect(passes.at(8)?.id).toBe(2);
    expect(passes.overlapping(0, 8).map(p => p.id)).toEqual([1]);
  });
});
