import { isFamily, type Family } from '../core/instruments';
import { isLibraryKind, type LibraryKind } from './catalogue';
import { isMineGroove } from './jamLink';

// Each screen has its own path: a bundled song bass/orion/, a bundled groove jam/blues-shuffle/, the library library/bass/exercises/.
// What has no page of its own, such as a song or groove of your own, stays a query. The app reads and writes routes as a query; these two functions translate.

export const isRootPath = (pathname: string, base: string) => pathname === base || pathname === `${base}index.html`;

function decoded(part: string): string | null {
  try { return decodeURIComponent(part); } catch { return null; }
}

export function routeQuery(pathname: string, search: string, base: string): string {
  const query = new URLSearchParams(search);
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const [first, second, ...rest] = path.split('/').filter(Boolean);
  if (first === 'library') return libraryQuery(query, second, rest);
  const slug = second === undefined || rest.length ? null : decoded(second);
  if (slug !== null) {
    if (first === 'jam') { query.set('view', 'jam'); query.set('groove', slug); query.delete('song'); }
    else if (isFamily(first)) { query.set('song', `${first}/${slug}`); query.delete('view'); }
  }
  return query.toString().replace(/%2F/g, '/');
}

function libraryQuery(query: URLSearchParams, family: string | undefined, [kind, ...rest]: string[]): string {
  if (rest.length) return query.toString().replace(/%2F/g, '/');
  query.set('view', 'library'); query.delete('song'); query.delete('groove');
  if (family && isFamily(family)) query.set('instrument', family);
  if (kind && isLibraryKind(kind)) query.set('kind', kind);
  return query.toString().replace(/%2F/g, '/');
}

export const libraryAddress = (root: string, kind: LibraryKind | null = null, family: Family | null = null) =>
  `${root}library/${family ? `${family}/${kind ? `${kind}/` : ''}` : ''}`;

export function addressOf(search: string, base: string): string {
  const query = new URLSearchParams(search);
  const song = query.get('song'), groove = query.get('groove');
  let path = base;
  if (query.get('view') === 'library') {
    const family = query.get('instrument'), kind = query.get('kind');
    path = `${base}library/`;
    query.delete('view');
    if (family && isFamily(family)) {
      path += `${family}/`; query.delete('instrument');
      if (kind && isLibraryKind(kind)) { path += `${kind}/`; query.delete('kind'); }
    }
  } else if (song && !query.has('view') && /^[a-z]+\/[^/]+$/.test(song)) {
    const [family, slug] = song.split('/');
    path = `${base}${family}/${encodeURIComponent(slug)}/`;
    query.delete('song');
  } else if (query.get('view') === 'jam' && groove && !isMineGroove(groove)) {
    path = `${base}jam/${encodeURIComponent(groove)}/`;
    query.delete('view'); query.delete('groove');
  }
  const rest = query.toString().replace(/%2F/g, '/');
  return rest ? `${path}?${rest}` : path;
}
