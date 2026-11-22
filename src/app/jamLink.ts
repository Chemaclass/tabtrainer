export interface JamSetup { mood?: string; key?: string; tempo?: number; progression?: string; swing?: number }

const SETUP_PARAMS = ['mood', 'key', 'tempo', 'progression', 'swing'] as const;
const MINE_PREFIX = 'mine:';

export const mineGrooveSlug = (title: string) => MINE_PREFIX + title;
export const isMineGroove = (slug: string) => slug.startsWith(MINE_PREFIX);
export const mineGrooveTitle = (slug: string) => slug.slice(MINE_PREFIX.length);

export function grooveSlug(path: string): string {
  const fileName = path.split('/').pop() ?? '';
  return fileName.replace(/\.txt$/, '').replace(/^\d+-/, '');
}

const textParam = (query: URLSearchParams, name: string) => query.get(name) ?? undefined;

function numberParam(query: URLSearchParams, name: string): number | undefined {
  const value = query.get(name);
  if (value === null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function jamSetup(query: URLSearchParams): JamSetup {
  const setup: JamSetup = {
    mood: textParam(query, 'mood'),
    key: textParam(query, 'key'),
    tempo: numberParam(query, 'tempo'),
    progression: textParam(query, 'progression'),
    swing: numberParam(query, 'swing'),
  };
  return Object.fromEntries(Object.entries(setup).filter(([, value]) => value !== undefined));
}

export function writeJamSetup(query: URLSearchParams, setup: JamSetup) {
  for (const name of SETUP_PARAMS) {
    const value = setup[name];
    if (value === undefined) query.delete(name);
    else query.set(name, String(value));
  }
}

export function jamShareLink(root: string, slug: string, setup: JamSetup): string {
  const query = new URLSearchParams();
  writeJamSetup(query, setup);
  const search = query.toString();
  return `${jamAddress(root, slug)}${search ? `?${search}` : ''}`;
}

export const jamAddress = (root: string, slug: string) => `${root}jam/${encodeURIComponent(slug)}/`;
