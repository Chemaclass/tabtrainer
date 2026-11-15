import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { groovePage, grooveMeta, robotsTxt, sharePage, sitemap, songMeta } from './sharePages';
import { writeOfflineCache } from './offline';
import { songSlug } from '../app/songLink';
import { grooveSlug } from '../app/jamLink';

export interface StaticSite { outDir: string; site: string; atHostRoot: boolean }

export function writeStaticFiles({ outDir, site, atHostRoot }: StaticSite) {
  const paths = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).sort().map(f => `./songs/${f}`);
  for (const path of paths) {
    const file = join(outDir, songSlug(path), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, sharePage(site, path, songMeta(path, readFileSync(join('src', path), 'utf8'))));
  }
  const grooves = readdirSync('src/grooves').filter(f => f.endsWith('.txt')).sort();
  for (const file of grooves) {
    const page = join(outDir, 'jam', grooveSlug(file), 'index.html');
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, groovePage(site, grooveSlug(file), grooveMeta(readFileSync(join('src/grooves', file), 'utf8'))));
  }
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap(site, paths, grooves.map(grooveSlug)));
  // Crawlers read robots.txt only at the host root, so a project site under /<repo>/ gets none.
  if (atHostRoot) writeFileSync(join(outDir, 'robots.txt'), robotsTxt(site));
  // Last, so the cache list and its version cover every file above.
  writeOfflineCache(outDir);
}
