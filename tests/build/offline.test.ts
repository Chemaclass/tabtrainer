import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_WAIT_MS, cacheVersion, offlineUrls, serviceWorker } from '../../src/build/offline';
import { writeStaticFiles } from '../../src/build/staticFiles';
import { songSlug } from '../../src/app/songLink';
import { grooveSlug } from '../../src/app/jamLink';

const publicFiles = readdirSync('public');
const songPages = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).map(f => `${songSlug(`./songs/${f}`)}/index.html`);
const groovePages = readdirSync('src/grooves').filter(f => f.endsWith('.txt')).map(f => `jam/${grooveSlug(f)}/index.html`);
const assets = ['assets/index-Dg53OQro.js', 'assets/index-CnGjdvXt.css', 'assets/inter-latin-400-normal-AbC.woff2'];
const build = ['index.html', ...publicFiles, ...assets, ...songPages, ...groovePages, 'assets/index-Dg53OQro.js.map', 'assets/inter-latin-400-normal-XyZ.woff', 'sitemap.xml', 'robots.txt', 'sw.js'];
const listedUrls = (source: string): string[] => JSON.parse(source.match(/^const URLS = (.*);$/m)![1]);

describe('offline cache list', () => {
  const urls = offlineUrls(build);

  it('caches the app page, its scripts, styles and woff2 fonts', () => {
    expect(urls).toContain('./');
    for (const asset of assets) expect(urls).toContain(asset);
  });
  it('caches every public file the app uses', () => {
    for (const file of publicFiles.filter(f => f !== 'og.png')) expect(urls).toContain(file);
    expect(urls).toEqual(expect.arrayContaining(['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']));
  });
  it('leaves out the song, groove and 404 pages, which are copies of the app page the worker falls back to', () => {
    expect(songPages.length).toBeGreaterThan(0);
    for (const page of [...songPages, ...groovePages, 'library/index.html', 'library/bass/songs/index.html', '404.html']) {
      expect(urls).not.toContain(page);
      expect(urls).not.toContain(page.replace(/index\.html$/, ''));
    }
  });
  it('leaves out what the app never asks for', () => {
    for (const file of ['assets/index-Dg53OQro.js.map', 'assets/inter-latin-400-normal-XyZ.woff', 'og.png', 'bass/orion/og.png', 'jam/blues-shuffle/og.png', 'sitemap.xml', 'robots.txt', 'sw.js', 'index.html']) expect(urls).not.toContain(file);
  });
  it('reads Windows paths', () => {
    expect(offlineUrls(['assets\\app.js', 'assets\\fonts\\a.woff2', 'bass\\orion\\index.html'])).toEqual(['assets/app.js', 'assets/fonts/a.woff2']);
  });
});

describe('build output', () => {
  let outDir = '';
  afterEach(() => { if (outDir.startsWith(tmpdir())) rmSync(outDir, { recursive: true, force: true }); });

  it('writes each song and groove page as the app with its own head, and a 404 page', () => {
    outDir = mkdtempSync(join(tmpdir(), 'tabtrainer-build-'));
    mkdirSync(join(outDir, 'assets'));
    writeFileSync(join(outDir, 'index.html'), '<head><!-- page meta --><title>App</title><!-- /page meta --></head><script src="/tabtrainer/assets/index-abc.js"></script>');
    writeFileSync(join(outDir, 'assets/index-abc.js'), 'run()');
    writeStaticFiles({ outDir, site: 'https://example.com/tabtrainer/', atHostRoot: false });
    const urls = listedUrls(readFileSync(join(outDir, 'sw.js'), 'utf8'));
    expect(urls).toEqual(expect.arrayContaining(['./', 'assets/index-abc.js']));
    expect(urls).not.toContain('sitemap.xml');
    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe(readFileSync(join(outDir, 'index.html'), 'utf8'));
    const orion = readFileSync(join(outDir, 'bass/orion/index.html'), 'utf8');
    expect(orion).toContain('<title>Orion (bass solo), bass tab with rhythm · TabTrainer</title>');
    expect(orion).toContain('<script src="/tabtrainer/assets/index-abc.js"></script>');
    expect(orion).not.toContain('<title>App</title>');
    expect(readFileSync(join(outDir, 'library/guitar/mine/index.html'), 'utf8')).toContain('<title>My guitar songs · TabTrainer</title>');
    expect(readFileSync(join(outDir, 'library/index.html'), 'utf8')).toContain('<link rel="canonical" href="https://example.com/tabtrainer/library/" />');
    expect(readFileSync(join(outDir, 'library/bass/index.html'), 'utf8')).toContain('<title>Bass exercises and songs · TabTrainer</title>');
    for (const page of [...songPages, ...groovePages]) {
      const card = page.replace(/index\.html$/, 'og.png');
      expect(readFileSync(join(outDir, card)).subarray(1, 4).toString()).toBe('PNG');
      expect(urls).not.toContain(card);
    }
  });
});

describe('cache version', () => {
  const files = [{ path: './', content: '<html>' }, { path: 'assets/app.js', content: 'run()' }];

  it('stays the same for the same build', () => {
    expect(cacheVersion([...files].reverse())).toBe(cacheVersion(files));
  });
  it('changes when any cached file changes', () => {
    expect(cacheVersion([files[0], { path: 'assets/app.js', content: 'run(2)' }])).not.toBe(cacheVersion(files));
    expect(cacheVersion([files[0]])).not.toBe(cacheVersion(files));
  });
});

const scope = 'https://example.com/tabtrainer/';
const page = (body: string) => new Response(body);

// A host that sends Vary: Origin, as vite preview does: a cached file stored without an Origin header misses unless Vary is ignored.
class FakeCache {
  entries = new Map<string, Response>();
  constructor(private variesOnOrigin: boolean) {}
  async match(request: { url: string } | string, options: { ignoreSearch?: boolean; ignoreVary?: boolean } = {}) {
    const url = new URL(typeof request === 'string' ? request : request.url);
    if (this.variesOnOrigin && typeof request !== 'string' && !options.ignoreVary) return undefined;
    if (options.ignoreSearch) url.search = '';
    return this.entries.get(url.href)?.clone();
  }
  async addAll(requests: { url: string }[]) { for (const { url } of requests) this.entries.set(url, page(`cached ${url}`)); }
}

function runWorker(network: (url: string) => Promise<Response>, variesOnOrigin = false) {
  const stores = new Map<string, FakeCache>();
  const listeners: Record<string, (event: object) => void> = {};
  const caches = {
    open: async (name: string) => { if (!stores.has(name)) stores.set(name, new FakeCache(variesOnOrigin)); return stores.get(name)!; },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: { url: string }, options?: { ignoreVary?: boolean }) => { for (const store of stores.values()) { const found = await store.match(request, options); if (found) return found; } },
  };
  const self = {
    registration: { scope },
    addEventListener: (type: string, listener: (event: object) => void) => { listeners[type] = listener; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  class FakeRequest { constructor(public url: string) {} }
  new Function('self', 'caches', 'fetch', 'Request', 'Response', serviceWorker('v2', ['./', 'assets/app.js']))(self, caches, (request: { url: string }) => network(request.url), FakeRequest, Response);
  const lifecycle = async (type: string) => { let done: Promise<unknown> = Promise.resolve(); listeners[type]({ waitUntil: (work: Promise<unknown>) => { done = work; } }); await done; };
  const request = (url: string, { method = 'GET', mode = 'cors' } = {}) => {
    let response: Promise<Response> | null = null;
    listeners.fetch({ request: { url, method, mode }, respondWith: (answer: Promise<Response>) => { response = answer; } });
    return response as Promise<Response> | null;
  };
  return { stores, caches, lifecycle, request };
}

describe('service worker', () => {
  afterEach(() => { vi.useRealTimers(); });
  const offline = () => Promise.reject(new TypeError('Failed to fetch'));
  const never = () => new Promise<Response>(() => {});

  it('names its cache after the build and lists what to keep', () => {
    const source = serviceWorker('abc123', ['./', 'assets/app.js']);
    expect(source).toContain('const CACHE = "tabtrainer-abc123";');
    expect(listedUrls(source)).toEqual(['./', 'assets/app.js']);
  });
  it('caches every listed file on install', async () => {
    const worker = runWorker(offline);
    await worker.lifecycle('install');
    expect([...worker.stores.get('tabtrainer-v2')!.entries.keys()]).toEqual([scope, `${scope}assets/app.js`]);
  });
  it('removes only older TabTrainer caches when it takes over', async () => {
    const worker = runWorker(offline);
    await worker.caches.open('tabtrainer-v1');
    await worker.caches.open('other-app');
    await worker.lifecycle('install');
    await worker.lifecycle('activate');
    expect(await worker.caches.keys()).toEqual(['other-app', 'tabtrainer-v2']);
  });
  it('leaves POST and other sites to the browser', () => {
    const worker = runWorker(offline);
    expect(worker.request(`${scope}song`, { method: 'POST' })).toBeNull();
    expect(worker.request('https://fonts.example.org/a.woff2')).toBeNull();
  });
  it('serves a fresh page when online', async () => {
    const worker = runWorker(async () => page('fresh'));
    await worker.lifecycle('install');
    expect(await (await worker.request(`${scope}?song=bass%2Fode-to-joy`, { mode: 'navigate' }))!.text()).toBe('fresh');
  });
  it('opens a song link from the cached app page when offline', async () => {
    const worker = runWorker(offline);
    await worker.lifecycle('install');
    expect(await (await worker.request(`${scope}?song=bass%2Fode-to-joy`, { mode: 'navigate' }))!.text()).toBe(`cached ${scope}`);
  });
  it('opens a song, groove or library page from the cached app page when offline', async () => {
    const worker = runWorker(offline);
    await worker.lifecycle('install');
    for (const path of ['bass/ode-to-joy/', 'jam/blues-shuffle/?key=E', 'library/bass/songs/']) {
      expect(await (await worker.request(`${scope}${path}`, { mode: 'navigate' }))!.text()).toBe(`cached ${scope}`);
    }
  });
  it('serves cached files offline from a host that varies on Origin', async () => {
    const worker = runWorker(offline, true);
    await worker.lifecycle('install');
    expect(await (await worker.request(`${scope}assets/app.js`))!.text()).toBe(`cached ${scope}assets/app.js`);
  });
  it('falls back to the cached page when the network is too slow', async () => {
    vi.useFakeTimers();
    const worker = runWorker(never);
    await worker.lifecycle('install');
    const response = worker.request(`${scope}?view=library`, { mode: 'navigate' })!;
    await vi.advanceTimersByTimeAsync(NETWORK_WAIT_MS);
    expect(await (await response).text()).toBe(`cached ${scope}`);
  });
  it('keeps waiting for a slow network when nothing is cached yet', async () => {
    vi.useFakeTimers();
    let answer: (response: Response) => void = () => {};
    const worker = runWorker(() => new Promise(resolve => { answer = resolve; }));
    const response = worker.request(`${scope}?view=library`, { mode: 'navigate' })!;
    await vi.advanceTimersByTimeAsync(NETWORK_WAIT_MS * 2);
    answer(page('late'));
    expect(await (await response).text()).toBe('late');
  });
  it('serves assets from the cache, then the network', async () => {
    const worker = runWorker(async url => page(`network ${url}`));
    await worker.lifecycle('install');
    expect(await (await worker.request(`${scope}assets/app.js`))!.text()).toBe(`cached ${scope}assets/app.js`);
    expect(await (await worker.request(`${scope}assets/new.js`))!.text()).toBe(`network ${scope}assets/new.js`);
  });
});
