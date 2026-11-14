export interface JamSetup { key?: string; tempo?: number; progression?: string; swing?: number }

export const grooveSlug = (path: string) => (path.split('/').pop() ?? '').replace(/\.txt$/, '').replace(/^\d+-/, '');

export function jamSetup(query: URLSearchParams): JamSetup {
  const text = (name: string) => query.get(name) ?? undefined;
  const number = (name: string) => { const value = query.get(name); return value !== null && value.trim() !== '' && Number.isFinite(+value) ? +value : undefined; };
  const setup: JamSetup = { key: text('key'), tempo: number('tempo'), progression: text('progression'), swing: number('swing') };
  return Object.fromEntries(Object.entries(setup).filter(([, value]) => value !== undefined));
}

export function writeJamSetup(query: URLSearchParams, setup: JamSetup) {
  for (const name of ['key', 'tempo', 'progression', 'swing'] as const) {
    const value = setup[name];
    if (value === undefined) query.delete(name); else query.set(name, String(value));
  }
}

// Only the build writes the per-groove pages, so the dev server links to the query instead.
export function jamShareLink(root: string, slug: string, setup: JamSetup, dev: boolean): string {
  const query = new URLSearchParams(dev ? { view: 'jam', groove: slug } : {});
  writeJamSetup(query, setup);
  const search = query.toString();
  return `${root}${dev ? '' : `jam/${slug}/`}${search ? `?${search}` : ''}`;
}

export const jamAddress = (root: string, slug: string) => `${root}?${new URLSearchParams({ view: 'jam', groove: slug })}`;
