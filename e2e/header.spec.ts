import { expect, test, type Page } from '@playwright/test';

const headerParts = (page: Page) => page.evaluate(() => {
  const shown = (element: Element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden';
  const box = (selector: string, kept = false) => {
    const element = [...document.querySelectorAll(selector)].find(kept ? (found: Element) => found.getBoundingClientRect().width > 0 : shown);
    if (!element) return null;
    const { x, y, width, height } = element.getBoundingClientRect();
    return [x, y, width, height].map(n => Math.round(n * 10) / 10).join(',');
  };
  const phone = innerWidth < 600;
  return {
    bar: box('.top'),
    logo: box('#homeBtn'),
    instrument: box('.family-switch', true),
    exercises: box('[data-kind="exercises"]'),
    songs: box('[data-kind="songs"]'),
    mine: box('[data-kind="mine"]'),
    jam: box('#jamNavBtn'),
    tuner: box('#tunerBtn'),
    fretboard: box('#fretboardBtn'),
    ...(phone
      ? { slotA: box('#themeBtn, #editBtn'), slotB: box('#writeSongBtn, .top-action .file-menu') }
      : { theme: box('#themeBtn'), help: box('#helpBtn'), tools: box('.top-tools'), action: box('.top-action') }),
  };
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the header keeps every part in place across screens, ${colorScheme}`, async ({ page }, testInfo) => {
    const widths = testInfo.project.name === 'phone' ? [390, 320] : [1440, 1300, 1240, 1024, 768, 600];
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('./');
      const landing = await headerParts(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px scrolls sideways`).toBeLessThanOrEqual(width);
      const visit = async (selector: string) => {
        await page.locator(selector).click();
        expect(await headerParts(page), `${width}px after ${selector}`).toEqual(landing);
      };
      await visit('[data-kind="exercises"]');
      await visit('[data-kind="songs"]');
      await visit('[data-kind="mine"]');
      await visit('#jamNavBtn');
      await page.locator('[data-kind="exercises"]').click();
      await visit('#catalogueList .catalogue-row >> nth=0');
      await expect(page.locator('#practiceName')).not.toBeEmpty();
      await visit('[data-kind="exercises"]');
    }
  });
}

test('back from a tab opened on landing returns to landing', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-kind="songs"]').click();
  await expect(page.locator('#libraryTitle')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#landing h1')).toBeVisible();
  await expect(page.locator('#libraryScreen')).toBeHidden();
  await expect(page.locator('.library-nav [aria-current]')).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
  await page.goForward();
  await expect(page.locator('#libraryTitle')).toBeVisible();
  await expect(page.locator('[data-kind="songs"]')).toHaveAttribute('aria-current', 'page');
});

test('choosing an instrument on landing keeps the landing address', async ({ page }) => {
  await page.goto('./');
  await page.locator('#familySwitch [data-family="guitar"]').click();
  await expect(page.locator('#familySwitch [data-family="guitar"]')).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('#landing h1')).toBeVisible();
});
