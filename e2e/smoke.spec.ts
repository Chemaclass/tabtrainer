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

test('saving over a saved song asks in the app, and Escape keeps the saved one', async ({ page }) => {
  await openFirstExercise(page);
  await page.locator('#editBtn').click();
  const source = page.locator('#src');
  const feedback = page.locator('#saveFeedback');
  const ask = page.locator('#askDialog');
  const menu = page.locator('.file-menu summary');
  const save = async () => { await menu.click(); await page.locator('#saveBtn').click(); };
  await save();
  await expect(feedback).toHaveText(/^Saved "/);
  await source.fill(`${await source.inputValue()}\n# changed`);
  await save();
  await expect(ask).toBeVisible();
  await expect(page.locator('#askTitle')).toHaveText(/^Replace "/);
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(ask).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(page.locator('#dirtyState')).toHaveText('Unsaved changes');
  await save();
  await ask.getByRole('button', { name: 'Replace' }).click();
  await expect(ask).toBeHidden();
  await expect(feedback).toHaveText(/^Saved "/);
  await expect(page.locator('#dirtyState')).toHaveText('No unsaved changes');
});

test('a second Back while asking to discard groove changes keeps the address and the screen together', async ({ page }) => {
  await page.goto('./library/bass/exercises/');
  await page.locator('#jamNavBtn').click();
  await page.locator('#jamPickerButton').click();
  await page.locator('#jamGrooveList li').nth(2).locator('button, a').first().click();
  await page.locator('#grooveEdit').click();
  const source = page.locator('#grooveSource');
  await source.fill(`${await source.inputValue()}\n# changed`);
  const ask = page.locator('#askDialog');
  await page.goBack();
  await expect(ask).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/bass\/exercises\/$/);
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(/\/library\/bass\/exercises\/$/);
  await expect(page.locator('#libraryScreen')).toBeVisible();
  await expect(page.locator('#jamScreen')).toBeHidden();
});

test('the landing demo plays two bars in one click and lights the playing note', async ({ page }) => {
  await page.addInitScript(() => {
    const Stub = window.AudioContext;
    const made = window as unknown as { audioMadeInClick?: boolean };
    Object.defineProperty(window, 'AudioContext', { value: function () { made.audioMadeInClick = navigator.userActivation.isActive; return new Stub(); }, configurable: true });
  });
  await page.goto('./');
  const play = page.locator('#demoPlay');
  await expect(play).toHaveText('Play these two bars');
  await play.click();
  await expect(play).toHaveText('Stop');
  expect(await page.evaluate(() => (window as unknown as { audioMadeInClick?: boolean }).audioMadeInClick)).toBe(true);
  await expect(page.locator('#demoSheet .note.on').first()).toBeAttached();
  await play.click();
  await expect(play).toHaveText('Play these two bars');
});

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`the landing play button shows without scrolling at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('./');
    const box = await page.locator('#demoPlay').boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(size.height);
  });
}

test('a landing speed chip leaves the saved practice speed alone', async ({ page }) => {
  await page.goto('./');
  const before = await page.evaluate(() => localStorage.getItem('tabtrainer:speed'));
  await page.locator('[data-demo-speed="50"]').click();
  await expect(page.locator('[data-demo-speed="50"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('tabtrainer:speed'))).toBe(before);
  await expect(page.locator('[data-speed="50"]')).toHaveAttribute('aria-pressed', 'false');
});

test('without audio the landing demo opens First Steps', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const play = page.locator('#demoPlay');
  await expect(play).toHaveText('Open First Steps');
  await play.click();
  await expect(page).toHaveURL(/\/bass\/first-steps\/$/);
  expect(errors).toEqual([]);
});

test('the library invites a tab request that follows the page and the search', async ({ page }) => {
  await page.goto('./?view=library&kind=exercises&instrument=guitar');
  const request = page.locator('#tabRequest');
  await expect(request).toContainText('Looking for a guitar exercise that is not here?');
  await expect(page.locator('#tabRequestLink')).toHaveAttribute('href', /template=song-request\.yml/);
  await page.locator('#songSearch').fill('zzz nothing');
  await expect(request).toBeVisible();
  await expect(request).toContainText('"zzz nothing"');
  await page.goto('./?view=library&kind=mine');
  await expect(request).toBeHidden();
});

test('the practice help names the open tab and leads to the shortcuts', async ({ page }) => {
  await openFirstExercise(page);
  await page.locator('#feedbackTipBtn').click();
  const dialog = page.locator('#feedback');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#feedbackLinks a').first()).toHaveAttribute('href', /template=bug\.yml.*First\+Steps/);
  await page.locator('#feedbackShortcutsBtn').click();
  await expect(page.locator('#shortcuts')).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('the header help button opens generic help in the library', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'The phone header has no room; the File menu and the tip open it there');
  await page.goto('./?view=library&kind=songs');
  await page.locator('#helpBtn').click();
  await expect(page.locator('#feedback')).toBeVisible();
  await expect(page.locator('#feedbackShortcuts')).toBeHidden();
  await expect(page.locator('#feedbackLinks li').first()).toContainText('Something in TabTrainer not working?');
});
