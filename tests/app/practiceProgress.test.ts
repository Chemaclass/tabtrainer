import { describe, expect, it } from 'vitest';
import type { CatalogueEntry } from '../../src/app/catalogue';
import type { PracticeDay, SongRecord, Win } from '../../src/app/practiceLog';
import { daysAgo, doneHint, doneWhen, fullDate, levelMarks, minutesLabel, nextSpeed, recentWins, weekSummary, weekUnit, pickUp, pickUpAction, pickUpState, pickUpTitle, progressSummary, rowProgress, speedLadder } from '../../src/app/practiceProgress';

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
  it('climbs one default step and stops at full speed', () => {
    expect(nextSpeed(75)).toBe(80);
    expect(nextSpeed(73)).toBe(78);
    expect(nextSpeed(98)).toBe(100);
    expect(nextSpeed(100)).toBe(100);
    expect(nextSpeed(110)).toBe(110);
  });
  it('follows the saved climb increase', () => {
    expect(nextSpeed(75, 10)).toBe(85);
    expect(nextSpeed(95, 10)).toBe(100);
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
  it('climbs by the saved increase', () => {
    const plan = pickUp({ ladder: song() }, entries, 'bass', 10)!;
    expect(plan.nextSpeed).toBe(85);
    expect(pickUpAction(plan)).toBe('Continue at 85%');
    expect(speedLadder(plan)).toEqual(['done', 'done', 'done', 'done', 'done', 'current', 'todo', 'todo', 'todo', 'todo']);
  });
  it('marks the first step next when the speed is below the ladder', () => {
    const plan = pickUp({ ladder: song({ bestSpeed: 40, lastSpeed: 40 }) }, entries, 'bass')!;
    expect(plan.nextSpeed).toBe(45);
    expect(speedLadder(plan)).toEqual(['current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });
  it('never claims a pass faster than the best one', () => {
    const plan = pickUp({ ladder: song({ bestSpeed: 70, lastSpeed: 100 }) }, entries, 'bass')!;
    expect(plan.passSpeed).toBe(70);
    expect(pickUpState(plan, at(15))).toBe('Played through at 70% yesterday. Next step is 75%.');
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
    const none = { share: null, date: null };
    expect(rowProgress(null, at(15))).toEqual({ progress: 'not-started', label: 'Not started', when: null, best: null, ...none });
    expect(rowProgress(song({ bestSpeed: 85 }), at(15))).toEqual({ progress: 'in-progress', label: 'Best 85%', when: null, best: 85, ...none });
    expect(rowProgress(song({ bestSpeed: 120 }), at(15)).best).toBe(100);
    expect(rowProgress(song({ bestSpeed: 0 }), at(15))).toEqual({ progress: 'in-progress', label: 'Started', when: 'yesterday', best: null, ...none });
    expect(rowProgress(song({ cleanAt: at(13) }), at(15))).toEqual({ progress: 'done', label: 'Clean at 100%', when: '2 days ago', best: null, share: null, date: '13 Nov 2026' });
  });
  it('sums up a row on one line', () => {
    expect(progressSummary(rowProgress(song({ cleanAt: at(13) }), at(15)))).toBe('Clean at 100% · 2 days ago');
    expect(progressSummary(rowProgress(song({ bestSpeed: 85 }), at(15)))).toBe('Best 85%');
  });
});

describe('level progress', () => {
  const levels = ['Learn', 'Develop', 'Challenge'];
  it('names the one level done and fills a third of the ring', () => {
    const row = rowProgress(song({ cleanAt: at(12), levels: { learn: at(12) } }), at(15), levels);
    expect(row).toMatchObject({ progress: 'in-progress', label: 'Learn done', when: '3 days ago', share: 1 / 3, date: '12 Nov 2026' });
    expect(progressSummary(row)).toBe('Learn done · 3 days ago');
  });
  it('counts levels and names the latest', () => {
    const row = rowProgress(song({ levels: { learn: at(10), develop: at(15) } }), at(15), levels);
    expect(progressSummary(row)).toBe('2 of 3 levels · Develop done · today');
    expect(row.share).toBeCloseTo(2 / 3);
  });
  it('is done once every level is', () => {
    const row = rowProgress(song({ levels: { learn: at(1), develop: at(2), challenge: at(3) } }), at(15), levels);
    expect(row).toMatchObject({ progress: 'done', label: 'All 3 levels done', when: '3 Nov', share: 1 });
  });
  it('credits the level an older record last played clean', () => {
    expect(rowProgress(song({ cleanAt: at(14), version: 'develop', lastLoop: null, lastSpeed: 100 }), at(15), levels).label).toBe('Develop done');
    expect(rowProgress(song({ cleanAt: at(14), version: 'develop', lastLoop: [1, 2], lastSpeed: 70, bestSpeed: 100 }), at(15), levels).label).toBe('Best 100%');
    expect(rowProgress(song({ cleanAt: at(14), version: null }), at(15), levels).label).toBe('Learn done');
  });
  it('falls back to the best speed before any level is done', () => {
    expect(rowProgress(song({ bestSpeed: 85, version: 'learn' }), at(15), levels)).toMatchObject({ label: 'Best 85%', share: null, progress: 'in-progress' });
  });
});

describe('hand marks', () => {
  it('says done with the day it was marked', () => {
    const row = rowProgress(song({ doneAt: at(13), bestSpeed: 0, cleanAt: null }), at(15));
    expect(row).toMatchObject({ progress: 'done', label: 'Done', when: '2 days ago', date: '13 Nov 2026' });
    expect(rowProgress(song({ doneAt: at(13), cleanAt: at(10) }), at(15)).label).toBe('Clean at 100%');
  });
  it('lists each level with its date', () => {
    expect(levelMarks(song({ levels: { develop: at(12) }, markedLevels: { challenge: at(13) } }), ['Learn', 'Develop', 'Challenge'])).toEqual([
      { slug: 'learn', name: 'Learn', date: null, clean: false },
      { slug: 'develop', name: 'Develop', date: '12 Nov 2026', clean: true },
      { slug: 'challenge', name: 'Challenge', date: '13 Nov 2026', clean: false },
    ]);
    expect(levelMarks(null, ['Learn']).map(mark => mark.date)).toEqual([null]);
  });
  it('dates a level played clean by its clean pass, even when it was marked first', () => {
    const [learn] = levelMarks(song({ levels: { learn: at(3) }, markedLevels: { learn: at(1) } }), ['Learn']);
    expect(learn).toEqual({ slug: 'learn', name: 'Learn', date: '3 Nov 2026', clean: true });
  });
  it('explains the toggle', () => {
    expect(doneHint('Learn', null, false)).toBe('Click to mark Learn done.');
    expect(doneHint('Learn', '12 Nov 2026', false)).toBe('Marked done on 12 Nov 2026. Click to undo.');
    expect(doneHint('Learn', '12 Nov 2026', true)).toBe('Played clean on 12 Nov 2026.');
  });
  it('says not started, not decades ago, for a song only marked whose shape changed', () => {
    expect(rowProgress(song({ lastPlayed: 0, bestSpeed: 0, version: null, markedLevels: { learn: at(2) } }), at(15))).toMatchObject({ label: 'Not started', when: null });
  });
  it('never picks up a song that was only marked', () => {
    expect(pickUp({ ladder: song({ lastPlayed: 0 }) }, entries, 'bass')).toBeNull();
  });
});

describe('done dates', () => {
  it('uses words for the last week and a date after', () => {
    expect(doneWhen(at(14), at(15))).toBe('yesterday');
    expect(doneWhen(at(9), at(15))).toBe('6 days ago');
    expect(doneWhen(at(8), at(15))).toBe('8 Nov');
    expect(doneWhen(new Date(2025, 11, 30).getTime(), at(15))).toBe('30 Dec 2025');
    expect(fullDate(at(8))).toBe('8 Nov 2026');
  });
});

describe('week summary', () => {
  const week = (seconds: number[]): PracticeDay[] => seconds.map((s, i) => ({ day: `2026-11-${String(9 + i).padStart(2, '0')}`, seconds: s }));

  it('words practice time', () => {
    expect(minutesLabel(0)).toBe('none');
    expect(minutesLabel(20)).toBe('under a minute');
    expect(minutesLabel(60)).toBe('1 minute');
    expect(minutesLabel(12 * 60 + 10)).toBe('12 minutes');
  });
  it('adds up the minutes and the days with practice, Monday first', () => {
    const summary = weekSummary(week([720, 0, 1200, 480, 0, 600, 0]), at(14, 20));
    expect(summary.minutes).toBe(50);
    expect(summary.days).toBe(4);
    expect(summary.bars.map(bar => bar.letter).join('')).toBe('MTWTFSS');
    expect(summary.bars.map(bar => bar.share)).toEqual([0.6, 0, 1, 0.4, 0, 0.5, 0]);
    expect(summary.bars.map(bar => bar.today)).toEqual([false, false, false, false, false, true, false]);
    expect(summary.spoken).toBe('Monday 12 minutes, Tuesday none, Wednesday 20 minutes, Thursday 8 minutes, Friday none, Saturday 10 minutes, Sunday none');
    expect(summary.hint).toBe('Played 10 minutes today.');
    expect(weekUnit(summary)).toEqual(['minutes on', '4 days']);
  });
  it('invites a short session on a day with no practice yet', () => {
    const summary = weekSummary(week([0, 0, 0, 0, 0, 0, 0]), at(15, 9));
    expect(summary.bars.every(bar => bar.share === 0)).toBe(true);
    expect(summary.bars[6].today).toBe(true);
    expect(summary.hint).toBe('Ten minutes today keeps the week going.');
    expect(weekUnit(summary)).toEqual(['minutes on', '0 days']);
    expect(weekUnit(weekSummary(week([60, 0, 0, 0, 0, 0, 0]), at(9)))).toEqual(['minute on', '1 day']);
  });
  it('counts any practice this week as at least one minute', () => {
    expect(weekSummary(week([20, 0, 0, 0, 0, 0, 0]), at(9)).minutes).toBe(1);
    expect(weekSummary(week([0, 0, 0, 0, 0, 0, 0]), at(9)).minutes).toBe(0);
  });
});

describe('recent wins', () => {
  const win = (song: string, speed: number, loop: Win['loop'], day: number): Win => ({ song, speed, loop, at: at(day) });

  it('words the last three wins of songs still in the catalogue', () => {
    const wins = [win('ladder', 75, [5, 8], 14), win('gone', 80, null, 13), win('steps', 100, null, 12), win('riff', 85, null, 11), win('ladder', 70, [5, 5], 10)];
    expect(recentWins(wins, [...entries, entry('riff')], 'bass', at(14, 20))).toEqual([
      { when: 'Today', text: 'ladder title, bars 5 to 8 played through at 75%' },
      { when: 'Thu', text: 'steps title clean at 100%' },
      { when: 'Wed', text: 'riff title played through at 85%' },
    ]);
  });
  it('keeps only the latest win per song and loop', () => {
    const wins = [win('ladder', 80, [5, 8], 14), win('ladder', 75, [5, 8], 13), win('ladder', 90, null, 12), win('ladder', 70, [5, 8], 11), win('steps', 100, null, 10)];
    expect(recentWins(wins, entries, 'bass', at(14, 20)).map(w => w.text)).toEqual([
      'ladder title, bars 5 to 8 played through at 80%',
      'ladder title played through at 90%',
      'steps title clean at 100%',
    ]);
  });
  it('shows wins of the current instrument only', () => {
    const wins = [win('riff', 85, null, 14), win('steps', 100, null, 13)];
    expect(recentWins(wins, entries, 'bass', at(14)).map(w => w.text)).toEqual(['steps title clean at 100%']);
    expect(recentWins(wins, entries, 'guitar', at(14)).map(w => w.text)).toEqual(['riff title played through at 85%']);
  });
  it('dates wins older than a week', () => {
    expect(recentWins([win('steps', 90, [3, 3], 2)], entries, 'bass', at(14))).toEqual([{ when: '2 Nov', text: 'steps title, bar 3 played through at 90%' }]);
  });
});
