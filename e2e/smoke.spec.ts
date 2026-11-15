import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { stubAudioContext } from './audioStub';

const bundledCount = (instrument: string, kind: string) => readdirSync(`src/songs/${instrument}/${kind}`).filter(file => file.endsWith('.txt')).length;

async function openFirstExercise(page: Page) {
  await page.goto('./?view=library&kind=exercises');
  await page.locator('#catalogueList .catalogue-row').first().click();
  await expect(page.locator('.note').first()).toBeAttached();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(stubAudioContext);
});

test('the landing page loads with no console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#landing h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('the library lists every bundled exercise and song', async ({ page }) => {
  const nav = page.locator('.library-nav');
  for (const instrument of ['bass', 'guitar']) {
    await page.goto(`./?view=library&kind=exercises&instrument=${instrument}`);
    await expect(nav.locator('[data-kind="exercises"] .nav-count')).toHaveText(String(bundledCount(instrument, 'exercises')));
    await expect(nav.locator('[data-kind="songs"] .nav-count')).toHaveText(String(bundledCount(instrument, 'songs')));
    await expect(page.locator('#catalogueList .catalogue-row').first()).toBeVisible();
  }
});

test('a song opens and renders its notes', async ({ page }) => {
  await openFirstExercise(page);
  expect(await page.locator('.note').count()).toBeGreaterThan(0);
  await expect(page.locator('.note').first()).toBeVisible();
});

test('the editor shows a problem for a bad line and clears it once fixed', async ({ page }) => {
  await openFirstExercise(page);
  await page.locator('#editBtn').click();
  const source = page.locator('#src');
  const text = await source.inputValue();
  await source.fill(`${text}\n:q 9.9 |\n`);
  await expect(page.locator('#issues li').first()).toBeVisible();
  await expect(page.locator('#status')).toHaveClass(/\bbad\b/);
  await source.fill(text);
  await expect(page.locator('#status')).not.toHaveClass(/\bbad\b/);
  await expect(page.locator('#issues li')).toHaveCount(0);
});

test('the player reaches the playing state and lights the current note', async ({ page }) => {
  await openFirstExercise(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#playbackStatus')).toHaveText('Playing', { timeout: 10_000 });
  await expect(page.locator('#playBtn')).toHaveAttribute('aria-label', 'Pause');
  await expect(page.locator('.note.on').first()).toBeAttached();});

test('the phone editor switches between text and score and keeps the caret', async ({ page }, testInfo) => {
  await openFirstExercise(page);
  await page.locator('#editBtn').click();
  const source = page.locator('#src');
  if (testInfo.project.name !== 'phone') {
    await expect(page.locator('#editorTabs')).toBeHidden();
    await expect(source).toBeVisible();
    await expect(page.locator('#sheet')).toBeVisible();
    return;
  }
  await expect(source).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  await source.evaluate((area: HTMLTextAreaElement) => area.setSelectionRange(12, 18));
  await page.locator('#scoreTab').click();
  await expect(page.locator('#scoreTab')).toHaveAttribute('aria-selected', 'true');
  await expect(source).toBeHidden();
  await expect(page.locator('.note').first()).toBeVisible();
  await page.locator('#textTab').click();
  await expect(source).toBeVisible();
  expect(await source.evaluate((area: HTMLTextAreaElement) => [area.selectionStart, area.selectionEnd])).toEqual([12, 18]);
});

test('the landing demo plays two bars in one click and lights the playing note', async ({ page }) => {
  await page.goto('./');
  const play = page.locator('#demoPlay');
  await expect(play).toHaveText('Play these two bars');
  const box = await play.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  await play.click();
  await expect(play).toHaveText('Stop');
  await expect(page.locator('#demoSheet .note.on').first()).toBeAttached();
  await play.click();
  await expect(play).toHaveText('Play these two bars');
});

test('without audio the landing demo opens First Steps', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const play = page.locator('#demoPlay');
  await expect(play).toHaveText('Open First Steps');
  await play.click();
  await expect(page).toHaveURL(/song=bass\/first-steps/);
  expect(errors).toEqual([]);
});
