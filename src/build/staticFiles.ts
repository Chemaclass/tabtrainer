import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CARD_IMAGE, groovePageMeta, grooveMeta, robotsTxt, sitemap, songMeta, songPageMeta, withPageMeta } from './sharePages';
import { cardPng, cardSvg, grooveCard, songCard, type Card } from './ogImage';
import { parseSong } from '../core/parser';
import { parseGroove } from '../core/groove';
import { writeOfflineCache } from './offline';
import { songSlug } from '../app/songLink';
import { grooveSlug } from '../app/jamLink';

export interface StaticSite { outDir: string; site: string; atHostRoot: boolean }

export function writeStaticFiles({ outDir, site, atHostRoot }: StaticSite) {
  const siteLabel = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const app = readFileSync(join(outDir, 'index.html'), 'utf8');
  // GitHub Pages answers an unknown path with 404.html, so a renamed song's old link still opens the app.
  writeFileSync(join(outDir, '404.html'), app);
  const writeCard = (dir: string, card: Card) => writeFileSync(join(dir, CARD_IMAGE), cardPng(cardSvg(card, siteLabel)));
  const paths = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).sort().map(f => `./songs/${f}`);
  for (const path of paths) {
    const file = join(outDir, songSlug(path), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    const text = readFileSync(join('src', path), 'utf8'), meta = songMeta(path, text);
    writeFileSync(file, withPageMeta(app, songPageMeta(site, path, meta)));
    writeCard(dirname(file), songCard(parseSong(text).song, meta.family));
  }
  const grooves = readdirSync('src/grooves').filter(f => f.endsWith('.txt')).sort();
  for (const file of grooves) {
    const page = join(outDir, 'jam', grooveSlug(file), 'index.html');
    mkdirSync(dirname(page), { recursive: true });
    const text = readFileSync(join('src/grooves', file), 'utf8');
    writeFileSync(page, withPageMeta(app, groovePageMeta(site, grooveSlug(file), grooveMeta(text))));
    writeCard(dirname(page), grooveCard(parseGroove(text).groove));
  }
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap(site, paths, grooves.map(grooveSlug)));
  // Crawlers read robots.txt only at the host root, so a project site under /<repo>/ gets none.
  if (atHostRoot) writeFileSync(join(outDir, 'robots.txt'), robotsTxt(site));
  // Last, so the cache list and its version cover every file above.
  writeOfflineCache(outDir);
}
