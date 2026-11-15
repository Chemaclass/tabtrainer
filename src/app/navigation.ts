import { isFamily, type Family } from '../core/instruments';
import { addressOf, routeQuery } from './address';
import { isLibraryKind, type LibraryKind } from './catalogue';
import { jamSetup, writeJamSetup, type JamSetup } from './jamLink';
import { findBySlug, normalizeSongReference, songSlug } from './songLink';
import { bundledPath, bundledRef } from './songRef';

export type Route = { screen: 'library'; kind: LibraryKind; family: Family | null }
  | { screen: 'practice'; picked: string | null; version: string | null }
  | { screen: 'jam'; groove: string; setup: JamSetup };
interface NavigationState { index: number; picked: string }
export function navigationState(value: unknown): NavigationState | null {
  if (value && typeof value === 'object' && 'app' in value && value.app === 'tabtrainer' && 'index' in value && typeof value.index === 'number' && Number.isSafeInteger(value.index) && 'picked' in value && typeof value.picked === 'string') return { index: value.index, picked: value.picked };
  return null;
}
export function readRoute(search: string, paths: string[], picked: string | null = null): Route {
  const query = new URLSearchParams(search);
  if (query.get('view') === 'jam') return { screen: 'jam', groove: query.get('groove') ?? '', setup: jamSetup(query) };
  const path = findBySlug(paths, query.get('song') ?? '');
  if (path || query.get('view') === 'practice') return { screen: 'practice', picked: path ? bundledRef(path) : picked ? normalizeSongReference(picked, paths) : null, version: query.get('version') };
  const kind = query.get('kind'), family = query.get('instrument');
  return { screen: 'library', kind: isLibraryKind(kind) ? kind : 'exercises', family: family && isFamily(family) ? family : null };
}
const routeKeys = ['song', 'view', 'kind', 'instrument', 'version'];
export function isLandingAddress(search: string, onRoot = true) {
  const query = new URLSearchParams(search);
  return query.has('welcome') || (onRoot && !routeKeys.some(key => query.has(key)));
}
export const asksForNewSong = (search: string) => new URLSearchParams(search).get('new') === '1';
export function routeSearch(search: string, route: Route): string {
  const query = new URLSearchParams(search);
  query.delete('new');
  if (route.screen !== 'jam') { query.delete('groove'); writeJamSetup(query, {}); }
  if (route.screen === 'jam') {
    query.delete('song'); query.delete('version'); query.delete('kind'); query.delete('instrument');
    query.set('view', 'jam'); query.set('groove', route.groove); writeJamSetup(query, route.setup);
  } else if (route.screen === 'library') {
    query.delete('song'); query.delete('version'); query.set('view', 'library'); query.set('kind', route.kind);
    if (route.family) query.set('instrument', route.family); else query.delete('instrument');
  } else {
    query.delete('kind'); query.delete('instrument');
    const path = route.picked ? bundledPath(route.picked) : null;
    if (path !== null) { query.set('song', songSlug(path)); query.delete('view'); }
    else { query.delete('song'); query.set('view', 'practice'); }
    if (path !== null && route.version) query.set('version', route.version); else query.delete('version');
  }
  return query.toString().replace(/%2F/g, '/');
}
export class Navigation {
  private position: number;
  private restoring = false;
  private visits = 0;
  constructor(private history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'go'>, private location: Pick<Location, 'pathname' | 'search' | 'hash'>, private paths: string[], private base: string) {
    this.position = navigationState(history.state)?.index ?? 0;
  }
  show(route: Route, picked: string, push = false) {
    const url = addressOf(routeSearch(this.search(), route), this.base) + this.location.hash;
    const changed = url !== this.location.pathname + this.location.search + this.location.hash || normalizeSongReference(navigationState(this.history.state)?.picked ?? '', this.paths) !== picked;
    if (push && changed) this.position++;
    const state = { app: 'tabtrainer', index: this.position, picked };
    if (push && changed) this.history.pushState(state, '', url); else this.history.replaceState(state, '', url);
  }
  search() { return routeQuery(this.location.pathname, this.location.search, this.base); }
  /** Answers to a visit, and what runs after accepting it, are ignored once a later visit has been handled. */
  visit(state: unknown, open: (route: Route, accept: (then?: () => void) => void, cancel: () => void) => void) {
    if (this.restoring) { this.restoring = false; return; }
    const target = navigationState(state), previous = this.position;
    const destination = target?.index ?? previous - 1;
    const visit = ++this.visits;
    const isLatest = () => visit === this.visits;
    const accept = (then?: () => void) => {
      if (!isLatest()) return;
      this.position = destination;
      then?.();
    };
    open(readRoute(this.search(), this.paths, target?.picked), accept, () => {
      if (!isLatest()) return;
      const current = navigationState(this.history.state)?.index ?? destination;
      if (previous !== current) { this.restoring = true; this.history.go(previous - current); }
    });
  }
}
