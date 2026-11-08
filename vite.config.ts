import { defineConfig } from 'vite';

// GitHub Pages serves the app from /<repo>/; override with BASE=/ for custom domains.
export default defineConfig({
  base: process.env.BASE ?? '/tabtrainer/',
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
} as never);
