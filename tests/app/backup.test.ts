import { afterEach, describe, expect, it, vi } from 'vitest';
import { Backups, readBackup } from '../../src/app/backup';
import { PracticeLog } from '../../src/app/practiceLog';
import { practiceStore, savedSongs } from '../../src/app/storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  return values;
}
const pass = { firstBar: 1, lastBar: 4, whole: true, speed: 100 };

afterEach(() => vi.unstubAllGlobals());
describe('backups', () => {
  it('moves saved songs and the practice record to another browser', () => {
    memoryStorage();
    const log = new PracticeLog(practiceStore), backups = new Backups(savedSongs, log);
    savedSongs.save('Mine', 'title: Mine');
    log.passEnded('lib:Mine', null, pass, 1000);
    const text = backups.text();
    expect(backups.fileName(new Date(2026, 10, 15).getTime())).toBe('tabtrainer-backup-2026-11-15.json');

    const values = memoryStorage();
    expect(backups.restore(text)).toBe('restored');
    expect(savedSongs.list().map(s => s.title)).toEqual(['Mine']);
    expect(log.song('lib:Mine')).toMatchObject({ bestSpeed: 100, cleanAt: 1000 });
    expect(values.has('tabtrainer:practice')).toBe(true);
  });
  it('keeps the newer copy of a song saved in both places', () => {
    memoryStorage({ 'tabtrainer:library': JSON.stringify({ Mine: { title: 'Mine', text: 'newer', updated: 20 } }) });
    const backups = new Backups(savedSongs, new PracticeLog(practiceStore));
    const backup = { app: 'tabtrainer', version: 1, songs: [{ title: 'Mine', text: 'older', updated: 10 }, { title: 'Other', text: 'other', updated: 5 }], practice: { songs: {}, days: {}, wins: [] } };
    expect(backups.restore(JSON.stringify(backup))).toBe('restored');
    expect(savedSongs.list().map(s => s.text)).toEqual(['newer', 'other']);
  });
  it('treats a song text or a broken file as not a backup', () => {
    expect(readBackup('title: Song')).toBeNull();
    expect(readBackup('{"app":"tabtrainer","version":1,"songs":[],"practice":{"songs":{}}}')).toBeNull();
    memoryStorage();
    expect(new Backups(savedSongs, new PracticeLog(practiceStore)).restore('title: Song')).toBe('not-a-backup');
  });
  it('restores the songs but not over a practice record it could not read', () => {
    const values = memoryStorage({ 'tabtrainer:practice': '{bad' });
    const backups = new Backups(savedSongs, new PracticeLog(practiceStore));
    const backup = { app: 'tabtrainer', version: 1, songs: [{ title: 'Mine', text: 'mine', updated: 1 }], practice: { songs: {}, days: { '2026-11-15': 10 }, wins: [] } };
    expect(backups.restore(JSON.stringify(backup))).toBe('songs-only');
    expect(savedSongs.list().map(s => s.title)).toEqual(['Mine']);
    expect(values.get('tabtrainer:practice')).toBe('{bad');
  });
  it('changes nothing when the saved songs cannot be read', () => {
    const values = memoryStorage({ 'tabtrainer:library': '{bad' });
    const backups = new Backups(savedSongs, new PracticeLog(practiceStore));
    const backup = { app: 'tabtrainer', version: 1, songs: [], practice: { songs: {}, days: { '2026-11-15': 10 }, wins: [] } };
    expect(backups.restore(JSON.stringify(backup))).toBe('failed');
    expect(values.has('tabtrainer:practice')).toBe(false);
  });
});
