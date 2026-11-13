import { isFamily, type Family } from '../core/instruments';
import { isLibraryKind, type LibraryKind } from './catalogue';
import { findBySlug, songSlug } from './songLink';

export type Route = { screen: 'library'; kind: LibraryKind; family: Family | null }
  | { screen: 'practice'; picked: string | null; version: string | null };
interface NavigationState { index: number; picked: string }
export function navigationState(value: unknown): NavigationState | null {
  if (value && typeof value === 'object' && 'app' in value && value.app === 'tabtrainer' && 'index' in value && typeof value.index === 'number' && Number.isSafeInteger(value.index) && 'picked' in value && typeof value.picked === 'string') return { index: value.index, picked: value.picked };
  return null;
}
export function readRoute(search: string, paths: string[], picked: string | null = null): Route {
  const query = new URLSearchParams(search), path = findBySlug(paths, query.get('song') ?? '');
  if (path || query.get('view') === 'practice') return { screen: 'practice', picked: path ? 'demo:' + path : picked, version: query.get('version') };
  const kind = query.get('kind'), family = query.get('instrument');
  return { screen: 'library', kind: isLibraryKind(kind) ? kind : 'exercises', family: isFamily(family) ? family : null };
}
export function routeSearch(search: string, route: Route): string {
  const query = new URLSearchParams(search);
  if (route.screen === 'library') {
    query.delete('song'); query.delete('version'); query.set('view', 'library'); query.set('kind', route.kind);
    if (route.family) query.set('instrument', route.family); else query.delete('instrument');
  } else {
    query.delete('kind'); query.delete('instrument');
    if (route.picked?.startsWith('demo:')) { query.set('song', songSlug(route.picked.slice(5))); query.delete('view'); }
    else { query.delete('song'); query.set('view', 'practice'); }
    if (route.picked?.startsWith('demo:') && route.version) query.set('version', route.version); else query.delete('version');
  }
  return query.toString().replace(/%2F/g, '/');
}
export class Navigation {
  private position: number;
  private restoring = false;
  constructor(private history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'go'>, private location: Pick<Location, 'pathname' | 'search' | 'hash'>, private paths: string[]) {
    this.position = navigationState(history.state)?.index ?? 0;
  }
  show(route: Route, picked: string, push = false) {
    const search = routeSearch(this.location.search, route);
    const url = this.location.pathname + (search ? '?' + search : '') + this.location.hash;
    const changed = url !== this.location.pathname + this.location.search + this.location.hash || navigationState(this.history.state)?.picked !== picked;
    if (push && changed) this.position++;
    const state = { app: 'tabtrainer', index: this.position, picked };
    if (push && changed) this.history.pushState(state, '', url); else this.history.replaceState(state, '', url);
  }
  visit(state: unknown, open: (route: Route, accept: () => void, cancel: () => void) => void) {
    if (this.restoring) { this.restoring = false; return; }
    const target = navigationState(state), previous = this.position;
    const destination = target?.index ?? previous - 1;
    open(readRoute(this.location.search, this.paths, target?.picked), () => { this.position = destination; }, () => {
      const current = navigationState(this.history.state)?.index ?? destination;
      if (previous !== current) { this.restoring = true; this.history.go(previous - current); }
    });
  }
}
