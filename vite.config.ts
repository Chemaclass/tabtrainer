import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { writeStaticFiles } from './src/build/staticFiles';

// GitHub Pages serves the app from /<repo>/. For a custom domain, set BASE=/ and SITE_URL to its address.
const base = process.env.BASE ?? '/tabtrainer/';
const siteUrl = process.env.SITE_URL ?? (base === '/tabtrainer/' ? 'https://chemaclass.github.io/tabtrainer/' : null);
const site = siteUrl?.replace(/\/?$/, '/') ?? '';

// Link previews never run JavaScript, so each bundled song and groove gets a static page with its own title and description.
function sharePages(): Plugin {
  let outDir = 'dist', building = false;
  return {
    name: 'share-pages',
    configResolved(config) {
      outDir = config.build.outDir; building = config.command === 'build' && !process.env.VITEST;
      if (building && !siteUrl) throw new Error(`Set SITE_URL to the public address when BASE is ${base}`);
    },
    transformIndexHtml: { order: 'pre', handler: html => html.replaceAll('__SITE_URL__', site) },
    closeBundle() {
      if (building) writeStaticFiles({ outDir, site, atHostRoot: base === '/' });
    },
  };
}

export default defineConfig({
  base,
  plugins: [sharePages()],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'] },
} as never);
