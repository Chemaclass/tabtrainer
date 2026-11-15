import { describe, expect, it } from 'vitest';
import type { CatalogueEntry } from '../../src/app/catalogue';
import type { SongRecord } from '../../src/app/practiceLog';
import { daysAgo, nextSpeed, pickUp, pickUpAction, pickUpState, pickUpTitle, progressSummary, rowProgress, speedLadder } from '../../src/app/practiceProgress';

const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
const entry = (value: string, family = 'bass'): CatalogueEntry => ({ value, title: `${value} title`, artist: '', kind: 'exercises', family, tempo: 90, versions: 1 });
const song = (change: Partial<SongRecord> = {}): SongRecord => ({ bestSpeed: 75, cleanAt: null, lastPlayed: at(14), seconds: 60, lastLoop: [5, 8], lastSpeed: 75, version: 'slow', ...change });
const entries = [entry('ladder'), entry('steps'), entry('riff', 'guitar')];

describe('days ago', () => {
  it('names today, yesterday and older local days', () => {
    expect(daysAgo(at(15, 1), at(15, 23))).toBe('today');
    expect(daysAgo(at(14, 23), at(15, 1))).toBe('yesterday');
    expect(daysAgo(at(13), at(15))).toBe('2 days ago');
    expect(daysAgo(at(16), at(15))).toBe('today');
  });
});

describe('next speed', () => {
  it('climbs one five percent step and stops at full speed', () => {
    expect(nextSpeed(75)).toBe(80);
    expect(nextSpeed(73)).toBe(75);
    expect(nextSpeed(98)).toBe(100);
    expect(nextSpeed(100)).toBe(100);
    expect(nextSpeed(110)).toBe(110);
  });
});

describe('pick up where you left off', () => {
  it('is absent before any practice in this instrument', () => {
    expect(pickUp({}, entries, 'bass')).toBeNull();
    expect(pickUp({ riff: song() }, entries, 'bass')).toBeNull();
    expect(pickUp({ gone: song() }, entries, 'bass')).toBeNull();
  });
  it('returns the latest song in the instrument with its loop, version and next speed', () => {
    const plan = pickUp({ steps: song({ lastPlayed: at(10) }), ladder: song(), riff: song({ lastPlayed: at(15) }) }, entries, 'bass')!;
    expect(plan).toMatchObject({ loop: [5, 8], version: 'slow', passSpeed: 75, nextSpeed: 80, lastPlayed: at(14) });
    expect(plan.entry.value).toBe('ladder');
    expect(pickUpTitle(plan)).toBe('ladder title, bars 5 to 8');
    expect(pickUpState(plan, at(15))).toBe('Played through at 75% yesterday. Next step is 80%.');
    expect(pickUpAction(plan)).toBe('Continue at 80%');
    expect(speedLadder(plan)).toEqual(['done', 'done', 'done', 'done', 'done', 'current', 'todo', 'todo', 'todo', 'todo']);
  });
  it('names one bar or the whole song', () => {
    const one = pickUp({ ladder: song({ lastLoop: [3, 3] }) }, entries, 'bass')!;
    expect(pickUpTitle(one)).toBe('ladder title, bar 3');
    expect(pickUpTitle({ ...one, loop: null })).toBe('ladder title');
  });
  it('offers no next step at full speed', () => {
    const plan = pickUp({ ladder: song({ lastSpeed: 100, bestSpeed: 100 }) }, entries, 'bass')!;
    expect(pickUpState(plan, at(14))).toBe('Played through at 100% today.');
    expect(pickUpAction(plan)).toBe('Continue at 100%');
    expect(speedLadder(plan).every(mark => mark === 'done')).toBe(true);
  });
  it('keeps the current speed when no pass was played through yet', () => {
    const plan = pickUp({ ladder: song({ bestSpeed: 0, lastSpeed: 100, lastLoop: null }) }, entries, 'bass')!;
    expect(plan.nextSpeed).toBeNull();
    expect(pickUpState(plan, at(16))).toBe('Started 2 days ago.');
    expect(pickUpAction(plan)).toBe('Continue');
    expect(speedLadder(plan).every(mark => mark === 'todo')).toBe(true);
  });
});

describe('row progress', () => {
  it('reads not started, best speed, started and clean', () => {
    expect(rowProgress(null, at(15))).toEqual({ progress: 'not-started', label: 'Not started', when: null, best: null });
    expect(rowProgress(song({ bestSpeed: 85 }), at(15))).toEqual({ progress: 'in-progress', label: 'Best 85%', when: null, best: 85 });
    expect(rowProgress(song({ bestSpeed: 120 }), at(15)).best).toBe(100);
    expect(rowProgress(song({ bestSpeed: 0 }), at(15))).toEqual({ progress: 'in-progress', label: 'Started', when: 'yesterday', best: null });
    expect(rowProgress(song({ cleanAt: at(13) }), at(15))).toEqual({ progress: 'done', label: 'Clean at 100%', when: '2 days ago', best: null });
  });
  it('sums up a row on one line', () => {
    expect(progressSummary(rowProgress(song({ cleanAt: at(13) }), at(15)))).toBe('Clean at 100% · 2 days ago');
    expect(progressSummary(rowProgress(song({ bestSpeed: 85 }), at(15)))).toBe('Best 85%');
  });
});
