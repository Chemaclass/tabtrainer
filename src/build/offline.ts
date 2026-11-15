import { createHash } from 'node:crypto';

export const SERVICE_WORKER = 'sw.js';

// The app never asks for these: source maps, .woff fonts (every browser that runs the app takes .woff2) and files only crawlers and link previews read.
const notForTheApp = /(\.map|\.woff|^og\.png|^sitemap\.xml|^robots\.txt)$/;

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

// Pages are fetched from the network first so an online visit always gets the latest songs; the rest comes from the cache.
export function serviceWorker(version: string, urls: readonly string[]): string {
  return `const CACHE = ${JSON.stringify(`tabtrainer-${version}`)};
const URLS = ${JSON.stringify(urls)};
const scoped = url => new URL(url, self.registration.scope).href;

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
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE)
      .then(cache => cache.match(request, { ignoreSearch: true }).then(page => page ?? cache.match(scoped('./'))))
      .then(page => page ?? Response.error())));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)));
});
`;
}
