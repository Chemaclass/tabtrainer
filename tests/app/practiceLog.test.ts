import { describe, expect, it, vi } from 'vitest';
import { PlayTime, PracticeLog, dayKey, doneLevels, hasPractice, isPracticeRecord, levelsDone, songProgress, type PracticeRecord, type PracticeStore } from '../../src/app/practiceLog';

const at = (day: number, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const whole = (speed: number) => ({ firstBar: 1, lastBar: 8, whole: true, speed });
const loop = (speed: number) => ({ firstBar: 5, lastBar: 8, whole: false, speed });

function memory(initial: PracticeRecord | null = null) {
  let stored = initial;
  const store: PracticeStore = { read: () => stored, write: record => { stored = structuredClone(record); return true; } };
  return { log: new PracticeLog(store), stored: () => stored };
}

describe('practice log passes', () => {
  it('records the first pass of a song', () => {
    const { log } = memory();
    expect(log.passEnded('demo:a', null, loop(70), at(2))).toEqual({ best: true, clean: false });
    expect(log.song('demo:a')).toEqual({ bestSpeed: 70, cleanAt: null, lastPlayed: at(2), seconds: 0, lastLoop: [5, 8], lastSpeed: 70, version: null });
    expect(log.progress('demo:a')).toBe('in-progress');
    expect(log.progress('demo:b')).toBe('not-started');
    expect(log.wins()).toEqual([{ song: 'demo:a', speed: 70, loop: [5, 8], at: at(2) }]);
  });
  it('raises the best speed on a faster pass', () => {
    const { log } = memory();
    log.passEnded('demo:a', null, loop(70), at(2));
    expect(log.passEnded('demo:a', 'slow', whole(80), at(3))).toEqual({ best: true, clean: false });
    expect(log.song('demo:a')).toMatchObject({ bestSpeed: 80, lastLoop: null, lastSpeed: 80, version: 'slow' });
    expect(log.wins().map(win => win.speed)).toEqual([80, 70]);
  });
  it('keeps the best speed on a slower pass but remembers where the player left off', () => {
    const { log } = memory();
    log.passEnded('demo:a', null, whole(90), at(2));
    expect(log.passEnded('demo:a', null, loop(60), at(3))).toEqual({ best: false, clean: false });
    expect(log.song('demo:a')).toMatchObject({ bestSpeed: 90, lastPlayed: at(3), lastLoop: [5, 8], lastSpeed: 60 });
    expect(log.wins()).toHaveLength(1);
  });
  it('marks a song done once the whole song is played through at full speed', () => {
    const { log } = memory();
    expect(log.passEnded('demo:a', null, loop(100), at(2))).toEqual({ best: true, clean: false });
    expect(log.passEnded('demo:a', null, whole(100), at(3))).toEqual({ best: false, clean: true });
    expect(log.passEnded('demo:a', null, whole(110), at(4))).toEqual({ best: true, clean: false });
    expect(log.song('demo:a')?.cleanAt).toBe(at(3));
    expect(log.progress('demo:a')).toBe('done');
  });
  it('names the song played most recently', () => {
    const { log } = memory();
    expect(log.latest()).toBeNull();
    log.passEnded('demo:a', null, loop(70), at(3));
    log.passEnded('lib:Mine', null, loop(70), at(2));
    expect(log.latest()?.ref).toBe('demo:a');
  });
});

describe('practice levels', () => {
  const levels = ['learn', 'develop', 'challenge'];
  it('keeps each level done on its own', () => {
    const { log } = memory();
    expect(log.passEnded('demo:a', 'learn', whole(100), at(2))).toEqual({ best: true, clean: true });
    expect(log.song('demo:a')!.levels).toEqual({ learn: at(2) });
    expect(songProgress(log.song('demo:a'), levels)).toBe('in-progress');
    expect(log.passEnded('demo:a', 'learn', whole(100), at(3))).toEqual({ best: false, clean: false });
    expect(log.passEnded('demo:a', 'develop', whole(100), at(4))).toEqual({ best: false, clean: true });
    log.passEnded('demo:a', 'challenge', whole(100), at(5));
    expect(log.song('demo:a')!.levels).toEqual({ learn: at(2), develop: at(4), challenge: at(5) });
    expect(songProgress(log.song('demo:a'), levels)).toBe('done');
    expect(log.wins().map(win => win.at)).toEqual([at(5), at(4), at(2)]);
  });
  it('credits an older record with the level it last played, and keeps it', () => {
    const old = { bestSpeed: 100, cleanAt: at(1), lastPlayed: at(1), seconds: 0, lastLoop: null, lastSpeed: 100, version: 'learn' };
    expect(levelsDone(old)).toEqual({ learn: at(1) });
    const { log } = memory({ songs: { 'demo:a': old }, days: {}, wins: [] });
    log.passEnded('demo:a', 'develop', loop(80), at(2));
    expect(log.song('demo:a')!.levels).toEqual({ learn: at(1) });
  });
  it('treats a song without practice levels as done once any version is', () => {
    const { log } = memory();
    log.passEnded('demo:a', 'duet', whole(100), at(2));
    expect(log.progress('demo:a')).toBe('done');
  });
  it('rejects levels that are not times', () => {
    const song = { bestSpeed: 0, cleanAt: null, lastPlayed: 0, seconds: 0, lastLoop: null, lastSpeed: 100, version: null };
    expect(isPracticeRecord({ songs: { a: { ...song, levels: { learn: 1 } } }, days: {}, wins: [] })).toBe(true);
    expect(isPracticeRecord({ songs: { a: { ...song, levels: { learn: 'x' } } }, days: {}, wins: [] })).toBe(false);
  });
  it('merges levels, keeping the first time each was done', () => {
    const base = { bestSpeed: 100, cleanAt: at(2), lastPlayed: at(5), seconds: 0, lastLoop: null, lastSpeed: 100, version: 'develop' };
    const { log } = memory({ songs: { 'demo:a': { ...base, levels: { learn: at(3), develop: at(5) } } }, days: {}, wins: [] });
    log.merge({ songs: { 'demo:a': { ...base, version: 'learn', levels: undefined } }, days: {}, wins: [] });
    expect(log.song('demo:a')!.levels).toEqual({ learn: at(2), develop: at(5) });
  });
});

describe('marking done by hand', () => {
  it('marks a played song done without counting practice', () => {
    const { log, stored } = memory();
    log.played('demo:a', 30, at(2));
    expect(log.setDone('demo:a', null, true, at(3))).toBe(true);
    expect(log.song('demo:a')).toMatchObject({ doneAt: at(3), cleanAt: null, lastPlayed: at(2), seconds: 30 });
    expect(log.progress('demo:a')).toBe('done');
    expect(stored()!.days).toEqual({ [dayKey(at(2))]: 30 });
    expect(log.wins()).toEqual([]);
  });
  it('marks a song never played, and is not practice', () => {
    const { log } = memory();
    log.setDone('demo:a', null, true, at(3));
    expect(log.song('demo:a')).toMatchObject({ lastPlayed: 0, seconds: 0, doneAt: at(3) });
    expect(hasPractice(log.record)).toBe(false);
  });
  it('keeps the first date when marked twice', () => {
    const { log } = memory();
    log.setDone('demo:a', null, true, at(3));
    log.setDone('demo:a', null, true, at(4));
    expect(log.song('demo:a')!.doneAt).toBe(at(3));
  });
  it('takes back a hand mark but keeps a clean pass, which was earned', () => {
    const { log } = memory();
    log.played('demo:a', 30, at(1));
    log.setDone('demo:a', null, true, at(2));
    log.setDone('demo:a', null, false, at(3));
    expect(log.song('demo:a')).toMatchObject({ doneAt: null });
    expect(log.progress('demo:a')).toBe('in-progress');
    log.passEnded('demo:a', null, whole(100), at(4));
    log.setDone('demo:a', null, false, at(5));
    expect(log.song('demo:a')!.cleanAt).toBe(at(4));
    expect(log.progress('demo:a')).toBe('done');
  });
  it('forgets a song that was only marked', () => {
    const { log } = memory();
    log.setDone('demo:a', null, true, at(3));
    log.setDone('demo:a', null, false, at(4));
    expect(log.song('demo:a')).toBeNull();
  });
  it('marks and unmarks one level by hand, apart from the levels played clean', () => {
    const { log } = memory();
    const levels = ['learn', 'develop', 'challenge'];
    log.passEnded('demo:a', 'learn', whole(100), at(2));
    log.setDone('demo:a', 'develop', true, at(3));
    log.setDone('demo:a', 'challenge', true, at(3));
    expect(doneLevels(log.song('demo:a')!)).toEqual({ learn: at(2), develop: at(3), challenge: at(3) });
    expect(songProgress(log.song('demo:a'), levels)).toBe('done');
    log.setDone('demo:a', 'learn', false, at(4));
    log.setDone('demo:a', 'challenge', false, at(4));
    expect(doneLevels(log.song('demo:a')!)).toEqual({ learn: at(2), develop: at(3) });
    expect(songProgress(log.song('demo:a'), levels)).toBe('in-progress');
  });
  it('still counts a clean pass on a level marked by hand', () => {
    const { log } = memory();
    log.setDone('demo:a', 'learn', true, at(2));
    expect(log.passEnded('demo:a', 'learn', whole(100), at(3))).toEqual({ best: true, clean: true });
    expect(log.wins()).toHaveLength(1);
  });
  it('keeps hand marks through a merge, the earlier one winning', () => {
    const song = { bestSpeed: 0, cleanAt: null, lastPlayed: 0, seconds: 0, lastLoop: null, lastSpeed: 100, version: null };
    const { log } = memory({ songs: { 'demo:a': { ...song, doneAt: at(5) } }, days: {}, wins: [] });
    log.merge({ songs: { 'demo:a': { ...song, doneAt: at(3) }, 'demo:b': song }, days: {}, wins: [] });
    expect(log.song('demo:a')!.doneAt).toBe(at(3));
    expect(log.song('demo:b')).not.toHaveProperty('doneAt');
  });
  it('accepts records with or without a hand mark, and rejects a bad one', () => {
    const song = { bestSpeed: 0, cleanAt: null, lastPlayed: 0, seconds: 0, lastLoop: null, lastSpeed: 100, version: null };
    expect(isPracticeRecord({ songs: { a: song, b: { ...song, doneAt: null }, c: { ...song, doneAt: 5 } }, days: {}, wins: [] })).toBe(true);
    expect(isPracticeRecord({ songs: { a: { ...song, doneAt: 'x' } }, days: {}, wins: [] })).toBe(false);
  });
  it('reports a failed write', () => {
    const log = new PracticeLog({ read: () => null, write: () => false });
    expect(log.setDone('demo:a', null, true, at(3))).toBe(false);
  });
});

describe('practice log time', () => {
  it('adds seconds to the song and to the local day', () => {
    const { log } = memory();
    expect(log.played('demo:a', 30, at(2))).toBe(true);
    log.played('demo:a', 15, at(2, 18));
    expect(log.song('demo:a')?.seconds).toBe(45);
    expect(log.record.days).toEqual({ '2026-11-02': 45 });
    expect(log.played('demo:a', 0, at(2))).toBe(false);
  });
  it('knows whether there is any practice record', () => {
    const { log } = memory();
    expect(hasPractice(log.record)).toBe(false);
    log.played('demo:a', 30, at(2));
    expect(hasPractice(log.record)).toBe(true);
    expect(hasPractice({ songs: {}, days: { '2026-11-02': 30 }, wins: [] })).toBe(true);
  });
  it('starts a new day at local midnight', () => {
    const { log } = memory();
    log.played('demo:a', 60, at(2, 23, 59));
    log.played('demo:a', 20, at(3, 0, 1));
    expect(log.record.days).toEqual({ '2026-11-02': 60, '2026-11-03': 20 });
    expect(dayKey(at(3, 0, 1))).toBe('2026-11-03');
  });
  it('lists the week from Monday and counts days in a row', () => {
    const { log } = memory();
    for (const day of [8, 10, 11, 12]) log.played('demo:a', 60 * day, at(day));
    const week = log.week(at(12));
    expect(week.map(d => d.day)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(week.map(d => d.seconds)).toEqual([0, 600, 660, 720, 0, 0, 0]);
    expect(log.week(at(15))[0].day).toBe('2026-11-09');
    expect(log.daysInARow(at(12))).toBe(3);
    expect(log.daysInARow(at(13))).toBe(3);
    expect(log.daysInARow(at(14))).toBe(0);
  });
  it('saves play time when audio stops, the song changes or the interval passes', () => {
    const { log } = memory();
    const time = new PlayTime(log, 15_000);
    time.update('demo:a', true, at(2));
    time.update('demo:a', true, at(2) + 5_000);
    expect(log.song('demo:a')).toBeNull();
    time.update('demo:a', true, at(2) + 15_000);
    expect(log.song('demo:a')?.seconds).toBe(15);
    time.update('demo:a', false, at(2) + 20_000);
    time.update('demo:a', false, at(2) + 60_000);
    expect(log.song('demo:a')?.seconds).toBe(20);
    time.update('demo:b', true, at(2) + 70_000);
    time.update('demo:c', true, at(2) + 72_000);
    expect(log.song('demo:b')?.seconds).toBe(2);
    time.update(null, true, at(2) + 80_000);
    expect(log.song('demo:c')?.seconds).toBe(8);
  });
  it('counts nothing for a gap longer than twice the interval, as when the computer sleeps', () => {
    const { log } = memory();
    const time = new PlayTime(log, 15_000);
    time.update('demo:a', true, at(2));
    time.update('demo:a', true, at(2) + 8 * 3600_000);
    expect(log.song('demo:a')).toBeNull();
    time.update('demo:a', false, at(2) + 8 * 3600_000 + 10_000);
    expect(log.song('demo:a')?.seconds).toBe(10);
  });
});

describe('practice log storage', () => {
  it('keeps a song named __proto__ as an ordinary entry', () => {
    const { log, stored } = memory();
    const other = JSON.parse('{"songs":{"__proto__":{"bestSpeed":1,"cleanAt":null,"lastPlayed":1,"seconds":1,"lastLoop":null,"lastSpeed":1,"version":null}},"days":{},"wins":[]}');
    expect(log.merge(other)).toBe(true);
    expect(log.passEnded('__proto__', null, whole(90), at(2))).toEqual({ best: true, clean: false });
    const saved = JSON.parse(JSON.stringify(stored()));
    expect(Object.keys(saved.songs)).toEqual(['__proto__']);
    expect(isPracticeRecord(saved)).toBe(true);
    expect(log.song('__proto__')?.bestSpeed).toBe(90);
  });
  it('falls back to empty and never overwrites a record it could not read', () => {
    const write = vi.fn(() => true);
    const log = new PracticeLog({ read: () => { throw Error('corrupt'); }, write });
    expect(log.record).toEqual({ songs: {}, days: {}, wins: [] });
    expect(log.song('demo:a')).toBeNull();
    expect(log.passEnded('demo:a', null, whole(100), at(2))).toBeNull();
    expect(log.played('demo:a', 10, at(2))).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  it('reports a failed write', () => {
    const log = new PracticeLog({ read: () => null, write: () => false });
    expect(log.passEnded('demo:a', null, whole(100), at(2))).toBeNull();
    expect(log.played('demo:a', 10, at(2))).toBe(false);
  });
  it('merges another record without counting the same practice twice', () => {
    const { log, stored } = memory();
    log.passEnded('demo:a', null, loop(80), at(2));
    log.played('demo:a', 100, at(2));
    const other = structuredClone(stored()!);
    other.songs['demo:a'] = { ...other.songs['demo:a'], bestSpeed: 90, lastPlayed: at(5), lastLoop: [1, 4] };
    other.days['2026-11-05'] = 30;
    expect(log.merge(other)).toBe(true);
    expect(log.merge(other)).toBe(true);
    expect(log.song('demo:a')).toMatchObject({ bestSpeed: 90, seconds: 100, lastPlayed: at(5), lastLoop: [1, 4] });
    expect(log.record.days).toEqual({ '2026-11-02': 100, '2026-11-05': 30 });
    expect(log.wins()).toHaveLength(1);
  });
  it('validates the stored shape', () => {
    const { log, stored } = memory();
    log.passEnded('demo:a', null, loop(80), at(2));
    expect(isPracticeRecord(stored())).toBe(true);
    expect(isPracticeRecord({ songs: {}, days: { yesterday: 3 }, wins: [] })).toBe(false);
    expect(isPracticeRecord({ songs: { a: { bestSpeed: 'fast' } }, days: {}, wins: [] })).toBe(false);
    expect(isPracticeRecord({ songs: {}, days: {} })).toBe(false);
  });
});
