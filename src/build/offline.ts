import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SERVICE_WORKER = 'sw.js';
export const NETWORK_WAIT_MS = 3000;

// The app never asks for these: source maps, .woff fonts (every browser that runs the app takes .woff2) and files only crawlers and link previews read.
const notForTheApp = /(\.map|\.woff|(^|\/)og\.png|^sitemap\.xml|^robots\.txt)$/;

export function offlineUrls(files: readonly string[]): string[] {
  return files
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => file !== SERVICE_WORKER && !notForTheApp.test(file))
    .map(file => file === 'index.html' ? './' : file.replace(/(^|\/)index\.html$/, '$1'))
    .sort();
}

export function cacheVersion(files: readonly { path: string; content: Uint8Array | string }[]): string {
  const hash = createHash('sha256');
  for (const { path, content } of [...files].sort((a, b) => a.path.localeCompare(b.path))) hash.update(path).update('\0').update(content).update('\0');
  return hash.digest('hex').slice(0, 16);
}

export function writeOfflineCache(outDir: string) {
  const urls = offlineUrls(readdirSync(outDir, { recursive: true, encoding: 'utf8' }).filter(file => statSync(join(outDir, file)).isFile()));
  const files = urls.map(url => ({ path: url, content: readFileSync(join(outDir, url.endsWith('/') ? `${url}index.html` : url)) }));
  writeFileSync(join(outDir, SERVICE_WORKER), serviceWorker(cacheVersion(files), urls));
}

// Pages come from the network first so an online visit gets the latest songs; a slow network falls back to the cached page. The rest comes from the cache.
export function serviceWorker(version: string, urls: readonly string[]): string {
  return `const CACHE = ${JSON.stringify(`tabtrainer-${version}`)};
const URLS = ${JSON.stringify(urls)};
const NETWORK_WAIT_MS = ${NETWORK_WAIT_MS};
const scoped = url => new URL(url, self.registration.scope).href;

function page(request) {
  const network = fetch(request);
  const cached = caches.open(CACHE).then(cache => cache.match(request, { ignoreSearch: true }).then(found => found ?? cache.match(scoped('./'))));
  const slow = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT_MS)).then(() => cached).then(found => found ?? network);
  return Promise.race([network, slow]).catch(() => cached.then(found => found ?? Response.error()));
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(URLS.map(url => new Request(scoped(url), { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('tabtrainer-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)));
});
`;
}
