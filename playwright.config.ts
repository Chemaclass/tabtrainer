import { defineConfig } from '@playwright/test';

const port = 4319;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 15_000,
  use: {
    baseURL: `http://localhost:${port}/tabtrainer/`,
    actionTimeout: 5_000,
    serviceWorkers: 'block',
    screenshot: 'on',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `${process.env.CI ? '' : 'vite build && '}vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/tabtrainer/`,
  },
});
