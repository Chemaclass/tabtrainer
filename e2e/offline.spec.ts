import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

// Playwright's offline switch and request routing both catch navigations before the worker on Linux,
// so the test runs its own server and stops it: the browser is then offline for real.
async function startServer(port: number): Promise<ChildProcess> {
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { detached: true, stdio: 'ignore' });
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(`http://localhost:${port}/tabtrainer/`)).ok) return server; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`vite preview did not start on port ${port}`);
}

async function stopServer(server: ChildProcess, port: number) {
  if (server.pid) process.kill(-server.pid);
  for (let tries = 0; tries < 100; tries++) {
    try { await fetch(`http://localhost:${port}/tabtrainer/`); } catch { return; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`vite preview kept running on port ${port}`);
}

test('once cached, a song, groove and library page open offline', async ({ page }, testInfo) => {
  const port = 4400 + testInfo.workerIndex;
  const root = `http://localhost:${port}/tabtrainer/`;
  const server = await startServer(port);
  try {
    await page.goto(root);
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated' && (await caches.keys()).length > 0;
    });
  } finally {
    await stopServer(server, port);
  }
  await page.goto(`${root}bass/first-steps/`);
  await expect(page.locator('.note').first()).toBeAttached();
  await expect(page).toHaveTitle(/^First Steps/);
  await page.goto(`${root}jam/blues-shuffle/`);
  await expect(page.locator('#jamScreen')).toBeVisible();
  await page.goto(`${root}library/bass/songs/`);
  await expect(page.locator('#catalogueList .catalogue-row').first()).toBeVisible();
});
