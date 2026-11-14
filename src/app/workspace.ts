import { isFamily, type Family } from '../core/instruments';
import { isLibraryKind, type LibraryKind } from './catalogue';
import type { Route } from './navigation';
import { pref, setPref } from './storage';

export type Screen = 'library' | 'practice';

export class Workspace {
  private constructor(private shown: Screen, private libraryKind: LibraryKind, private instrument: Family, private ref = '') {}

  static fromQuery(search: string) {
    const query = new URLSearchParams(search);
    const screen: Screen = query.has('song') || query.get('view') === 'practice' ? 'practice' : 'library';
    const kind = query.get('kind') ?? pref('libraryKind', 'exercises');
    const family = query.get('instrument') ?? pref('family', 'bass');
    return new Workspace(screen, isLibraryKind(kind) ? kind : 'exercises', isFamily(family) ? family : 'bass');
  }

  get screen() { return this.shown; }
  get kind() { return this.libraryKind; }
  get family() { return this.instrument; }
  get picked() { return this.ref; }

  enter(screen: Screen, songFamily: Family | null) {
    if (screen === 'practice' && songFamily) this.saveFamily(songFamily);
    this.shown = screen;
  }

  chooseKind(kind: LibraryKind) { this.libraryKind = kind; setPref('libraryKind', kind); }

  chooseFamily(family: Family): boolean {
    if (family === this.instrument) return false;
    this.saveFamily(family);
    return true;
  }

  visitFamily(family: Family) { this.instrument = family; }

  followSong(family: Family): boolean {
    if (this.shown !== 'practice' || family === this.instrument) return false;
    this.saveFamily(family);
    return true;
  }

  openSong(ref: string, kind: LibraryKind) { this.pick(ref, kind); this.shown = 'practice'; }

  pick(ref: string, kind: LibraryKind) { this.ref = ref; this.libraryKind = kind; setPref('picked', ref); }

  unpick() { this.pick('', 'mine'); }

  restore(ref: string) { this.ref = ref; }

  route(version: string | null): Route {
    return this.shown === 'library' ? { screen: 'library', kind: this.libraryKind, family: this.instrument } : { screen: 'practice', picked: this.ref, version };
  }

  private saveFamily(family: Family) { this.instrument = family; setPref('family', family); }
}
