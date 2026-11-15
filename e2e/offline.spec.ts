import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('once cached, a song, groove and library page open offline', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state === 'activated' && (await caches.keys()).length > 0;
  });
  await context.setOffline(true);
  await page.goto('./bass/first-steps/');
  await expect(page.locator('.note').first()).toBeAttached();
  await expect(page).toHaveTitle(/^First Steps/);
  await page.goto('./jam/blues-shuffle/');
  await expect(page.locator('#jamScreen')).toBeVisible();
  await page.goto('./library/bass/songs/');
  await expect(page.locator('#catalogueList .catalogue-row').first()).toBeVisible();
});
