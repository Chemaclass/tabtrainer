import type { Player } from '../audio/player';
import type { Passage } from './passage';

export interface SelectedNote { key: string; beat: number; bar: number }
type PassagePlayer = Pick<Player, 'bars' | 'range' | 'pausedAt' | 'playing' | 'setRange' | 'barRange' | 'seek' | 'seekNote' | 'noteAtKey' | 'stop'>;

export const beatInBar = (beat: number, barStart: number, beatValue: number) => Number(((beat - barStart) * beatValue / 4 + 1).toFixed(3));

export class PassagePlayback {
  private note: SelectedNote | null = null;

  constructor(private player: PassagePlayer, private passage: Passage) {}

  get selectedNote() { return this.note; }

  selectBar(bar: number): boolean {
    if (!this.passage.select(bar)) return false;
    this.note = null;
    this.syncRange();
    const span = this.player.bars.find(span => span.bar === bar);
    if (span) this.player.seek(span.start);
    return true;
  }

  selectNote(key: string, bar: number): boolean {
    const note = this.player.noteAtKey(key);
    if (!note || note.bar !== bar || !this.passage.select(bar)) return false;
    this.note = { key: note.key, beat: note.beat, bar: note.bar };
    this.syncRange();
    this.player.seekNote(key);
    return true;
  }

  apply() {
    this.syncRange();
    const range = this.player.range;
    if (this.note && range && (this.note.beat < range[0] || this.note.beat >= range[1])) this.note = null;
    const beat = this.player.pausedAt;
    if (!this.player.playing && range && (beat === null || beat < range[0] || beat >= range[1])) {
      this.passage.selectStart(); this.player.seek(range[0]);
    }
  }

  stop() {
    const note = this.note, bar = this.passage.snapshot().selected;
    this.player.stop(); this.passage.deselect();
    if (note) this.selectNote(note.key, note.bar); else if (bar) this.selectBar(bar);
  }

  deselect() { this.note = null; this.passage.deselect(); }

  private syncRange() {
    const range = this.passage.range();
    this.player.setRange(range ? this.player.barRange(...range) : null, this.passage.snapshot().repeat);
  }
}
