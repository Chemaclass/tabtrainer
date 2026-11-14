import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sharePage, sitemap, songMeta } from './src/build/sharePages';
import { songSlug } from './src/app/songLink';

// GitHub Pages serves the app from /<repo>/. For a custom domain, set BASE=/ and SITE_URL to its address.
const base = process.env.BASE ?? '/tabtrainer/';
const siteUrl = process.env.SITE_URL ?? (base === '/tabtrainer/' ? 'https://chemaclass.github.io/tabtrainer/' : null);
const site = siteUrl?.replace(/\/?$/, '/') ?? '';

// Link previews never run JavaScript, so each bundled song gets a static page with its own title and description.
function sharePages(): Plugin {
  let outDir = 'dist', building = false;
  return {
    name: 'share-pages',
    configResolved(config) {
      outDir = config.build.outDir; building = config.command === 'build' && !process.env.VITEST;
      if (building && !siteUrl) throw new Error(`Set SITE_URL to the public address when BASE is ${base}`);
    },
    transformIndexHtml: html => html.replaceAll('__SITE_URL__', site),
    closeBundle() {
      if (!building) return;
      const paths = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.txt')).sort().map(f => `./songs/${f}`);
      for (const path of paths) {
        const file = join(outDir, songSlug(path), 'index.html');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, sharePage(site, path, songMeta(path, readFileSync(join('src', path), 'utf8'))));
      }
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap(site, paths));
    },
  };
}

export default defineConfig({
  base,
  plugins: [sharePages()],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', exclude: [...configDefaults.exclude, '.claude/**'] },
} as never);
