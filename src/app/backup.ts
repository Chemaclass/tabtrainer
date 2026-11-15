import { dayKey, isPracticeRecord, type PracticeLog, type PracticeRecord } from './practiceLog';
import { isSaved, type Saved, type SavedTexts } from './storage';

export interface Backup { app: 'tabtrainer'; version: 1; songs: Saved[]; practice: PracticeRecord }
export type Restore = 'restored' | 'songs-only' | 'not-a-backup' | 'failed';

export function readBackup(text: string): Backup | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const { app, version, songs, practice } = value as Partial<Record<keyof Backup, unknown>>;
  if (app !== 'tabtrainer' || version !== 1 || !Array.isArray(songs) || !songs.every(isSaved) || !isPracticeRecord(practice)) return null;
  return { app, version, songs, practice };
}

/** One file with the saved songs and the practice record, to move them to another browser. */
export class Backups {
  constructor(private readonly songs: SavedTexts, private readonly log: PracticeLog) {}

  fileName(now: number) { return `tabtrainer-backup-${dayKey(now)}.json`; }

  text(): string {
    const backup: Backup = { app: 'tabtrainer', version: 1, songs: this.songs.list(), practice: this.log.record };
    return JSON.stringify(backup, null, 2);
  }

  restore(text: string): Restore {
    const backup = readBackup(text);
    if (!backup) return 'not-a-backup';
    if (!this.songs.merge(backup.songs)) return 'failed';
    return this.log.merge(backup.practice) ? 'restored' : 'songs-only';
  }
}
