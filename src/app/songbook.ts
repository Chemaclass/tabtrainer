import { parseSong } from '../core/parser';
import { familyOf, type Family } from '../core/instruments';
import { artistOf } from './credits';
import { hasPracticeLevels } from './practiceLevels';
import { bundledPath, bundledRef, savedRef } from './songRef';
import type { CatalogueEntry, LibraryKind } from './catalogue';
import type { Saved } from './storage';

// bundled songs live in src/songs/<family>/<kind>/, kind being exercises or songs
const folderFamily = (path: string) => path.split('/')[2];
const folderKind = (path: string): LibraryKind => path.split('/')[3] === 'exercises' ? 'exercises' : 'songs';
const familyOfText = (text: string) => familyOf(parseSong(text).song.meta.instrument);

function entryFor(value: string, text: string, kind: LibraryKind, family: string): CatalogueEntry {
  const parsed = parseSong(text).song;
  return { value, title: parsed.meta.title, artist: artistOf(text), levels: parsed.versions.flatMap(v => v.level ?? parsed.meta.level ?? []), about: parsed.meta.about, family, kind, tempo: parsed.meta.tempo, versions: parsed.versions.length, practiceLevels: hasPracticeLevels(parsed.versions.map(v => v.name)) };
}

export class Songbook {
  readonly paths: string[];
  private bundledEntries: CatalogueEntry[] | null = null;

  constructor(private bundled: Record<string, string>, private saved: () => Saved[]) {
    this.paths = Object.keys(bundled);
  }

  entries(): CatalogueEntry[] {
    // parsing every bundled song is the main start-up cost
    this.bundledEntries ??= [...this.paths].sort().map(path => entryFor(bundledRef(path), this.bundled[path], folderKind(path), folderFamily(path)));
    return [...this.bundledEntries, ...this.saved().map(item => entryFor(savedRef(item.title), item.text, 'mine', familyOfText(item.text)))];
  }

  text(ref: string): string | undefined {
    const path = bundledPath(ref);
    return path !== null ? this.bundled[path] : this.saved().find(item => savedRef(item.title) === ref)?.text;
  }

  kind(ref: string): LibraryKind {
    const path = bundledPath(ref);
    return path !== null ? folderKind(path) : 'mine';
  }

  firstBundled(family: Family): string | null {
    const path = this.paths.filter(path => folderFamily(path) === family).sort()[0];
    return path === undefined ? null : bundledRef(path);
  }
}
