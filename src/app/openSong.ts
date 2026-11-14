import { parseSong, type ParseIssue } from '../core/parser';
import { withVersion, type Song, type Version } from '../core/model';
import { versionSlug } from './songLink';

export class OpenSong {
  private whole: Song | null = null;
  private shown: Song | null = null;
  private index = 0;

  get song() { return this.shown; }
  get versions(): Version[] { return this.whole?.versions ?? []; }
  get versionIndex() { return this.index; }

  read(text: string, reset: boolean): { song: Song; issues: ParseIssue[] } {
    const { song, issues } = parseSong(text);
    this.whole = song;
    if (reset) this.index = 0;
    this.index = Math.min(this.index, song.versions.length - 1);
    this.shown = withVersion(song, this.index);
    return { song: this.shown, issues };
  }

  choose(index: number): boolean {
    if (!this.whole || index === this.index) return false;
    this.index = index;
    this.shown = withVersion(this.whole, index);
    return true;
  }

  chooseNamed(slug: string | null): boolean {
    const index = this.versions.findIndex(v => versionSlug(v.name) === slug);
    return index >= 0 && this.choose(index);
  }

  versionSlug(): string | null {
    return this.whole && this.whole.versions.length > 1 ? versionSlug(this.whole.versions[this.index].name) : null;
  }
}
