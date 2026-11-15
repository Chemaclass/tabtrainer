import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheVersion, offlineUrls, serviceWorker } from '../../src/build/offline';
import { songSlug } from '../../src/app/songLink';
import { grooveSlug } from '../../src/app/jamLink';

const publicFiles = readdirSync('public');
const songPages = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).map(f => `${songSlug(`./songs/${f}`)}/index.html`);
const groovePages = readdirSync('src/grooves').filter(f => f.endsWith('.txt')).map(f => `jam/${grooveSlug(f)}/index.html`);
const assets = ['assets/index-Dg53OQro.js', 'assets/index-CnGjdvXt.css', 'assets/inter-latin-400-normal-AbC.woff2'];
const build = ['index.html', ...publicFiles, ...assets, ...songPages, ...groovePages, 'assets/index-Dg53OQro.js.map', 'assets/inter-latin-400-normal-XyZ.woff', 'sitemap.xml', 'robots.txt', 'sw.js'];

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
  it('caches the page behind every bundled song and groove link', () => {
    expect(songPages.length).toBeGreaterThan(0);
    for (const page of [...songPages, ...groovePages]) expect(urls).toContain(page.replace(/index\.html$/, ''));
  });
  it('leaves out what the app never asks for', () => {
    for (const file of ['assets/index-Dg53OQro.js.map', 'assets/inter-latin-400-normal-XyZ.woff', 'og.png', 'sitemap.xml', 'robots.txt', 'sw.js', 'index.html']) expect(urls).not.toContain(file);
  });
  it('reads Windows paths', () => {
    expect(offlineUrls(['bass\\ode-to-joy\\index.html', 'assets\\app.js'])).toEqual(['assets/app.js', 'bass/ode-to-joy/']);
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

describe('service worker', () => {
  const source = serviceWorker('abc123', ['./', 'assets/app.js']);

  it('is valid JavaScript', () => {
    expect(() => new Function(source)).not.toThrow();
  });
  it('names its cache after the build and lists what to keep', () => {
    expect(source).toContain('const CACHE = "tabtrainer-abc123";');
    expect(source).toContain('const URLS = ["./","assets/app.js"];');
  });
});
