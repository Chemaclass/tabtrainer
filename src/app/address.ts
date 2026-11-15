import { isFamily } from '../core/instruments';
import { isMineGroove } from './jamLink';

// A bundled song or groove has its own path, such as bass/orion/ or jam/blues-shuffle/, so a copied address previews it.
// Every other screen is the root with a query. The app reads and writes routes as a query; these two functions translate.

export function routeQuery(pathname: string, search: string, base: string): string {
  const query = new URLSearchParams(search);
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const [first, second, ...rest] = path.split('/').filter(Boolean);
  if (second !== undefined && rest.length === 0) {
    const slug = decodeURIComponent(second);
    if (first === 'jam') { query.set('view', 'jam'); query.set('groove', slug); query.delete('song'); }
    else if (isFamily(first)) { query.set('song', `${first}/${slug}`); query.delete('view'); }
  }
  return query.toString().replace(/%2F/g, '/');
}

export function addressOf(search: string, base: string): string {
  const query = new URLSearchParams(search);
  const song = query.get('song'), groove = query.get('groove');
  let path = base;
  if (song && !query.has('view') && /^[a-z]+\/[^/]+$/.test(song)) {
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
