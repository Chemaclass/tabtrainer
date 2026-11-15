import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// Serves dist/ the way GitHub Pages does. Playwright's offline switch and request routing catch navigations before
// the worker on Linux, so the test stops this server instead: the browser is then offline for real.
function serve(): Promise<{ server: Server; root: string }> {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)).replace(/^\/tabtrainer\//, '');
    const file = join('dist', path.endsWith('/') || path === '' ? `${path}index.html` : path);
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, root: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/tabtrainer/` });
  }));
}

test('once cached, a song, groove and library page open offline', async ({ page }) => {
  const { server, root } = await serve();
  try {
    await page.goto(root);
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated' && (await caches.keys()).length > 0;
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await page.goto(`${root}bass/first-steps/`);
  await expect(page.locator('.note').first()).toBeAttached();
  await expect(page).toHaveTitle(/^First Steps/);
  await page.goto(`${root}jam/blues-shuffle/`);
  await expect(page.locator('#jamScreen')).toBeVisible();
  await page.goto(`${root}library/bass/songs/`);
  await expect(page.locator('#catalogueList .catalogue-row').first()).toBeVisible();
});
