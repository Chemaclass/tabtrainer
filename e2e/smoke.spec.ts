import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { stubAudioContext } from './audioStub';

const bundledCount = (instrument: string, kind: string) => readdirSync(`src/songs/${instrument}/${kind}`).filter(file => file.endsWith('.txt')).length;

async function openFirstExercise(page: Page) {
  await page.goto('./?view=library&kind=exercises');
  await page.locator('#catalogueList .catalogue-link').first().click();
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
    await expect(page.locator('#catalogueList .catalogue-link').first()).toBeVisible();
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

test('technique marks draw without a problem', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await openFirstExercise(page);
  await page.locator('#editBtn').click();
  await page.locator('#src').fill('title: Marks\ninstrument: guitar6\ntempo: 90\nkey: C\ntime: 4/4\n\n:q 3.5 x.5 /4.4 \\2.4 | :8 _0.6 _0.6 _(0.6 2.5) _0.6 :q 2.4 h4.4 | p2.4 (0.3 2.2) (h2.3 p0.2) 2.3^1 |\n');
  if (phone) await page.locator('#scoreTab').click();
  await expect(page.locator('#issues li')).toHaveCount(0);
  await expect(page.locator('.system.error')).toHaveCount(0);
  await expect(page.locator('.note')).toHaveCount(14);
  await expect(page.locator('.note:has(path):not(:has(text))')).toHaveCount(1);
  await expect(page.locator('.technique-label.pm')).toHaveText(['P.M.']);
  await expect(page.locator('.technique-label.pm')).toBeVisible();
  // On a phone the pull-off from bar 2 to bar 3 crosses the system break, so it is drawn as two halves. Bar 1 adds a slide into a note and a slide down.
  await expect(page.locator('.system')).toHaveCount(phone ? 2 : 1);
  await expect(page.locator('.vf-join')).toHaveCount(phone ? 7 : 6);
  // A chord with a hammer-on and a pull-off shows both letters once, side by side
  await expect(page.locator('.technique-label:not(.pm)')).toHaveText(['H', 'P', 'H P']);
  await expect(page.locator('.technique-label:not(.pm)').first()).toBeVisible();
  await expect(page.locator('.note text', { hasText: 'full' })).toHaveCount(1);
  await expect(page.locator('.note text', { hasText: 'full' })).toBeVisible();
});

test('a bar full of bends fits the sheet, and a chord bent alike shows one bend', async ({ page }, testInfo) => {
  await openFirstExercise(page);
  await page.locator('#editBtn').click();
  await page.locator('#src').fill(`title: Bends\ninstrument: guitar6\ntempo: 90\nkey: C\ntime: 4/4\n\n:8${' 7.3^3/2r'.repeat(8)} | :q (7.3^1 8.2^1) (7.3^1 8.2^1r) 7.3^1 ~7.3^1r |\n`);
  if (testInfo.project.name === 'phone') await page.locator('#scoreTab').click();
  await expect(page.locator('#issues li')).toHaveCount(0);
  await expect(page.locator('.system.error')).toHaveCount(0);
  const overflow = await page.locator('#sheet .system svg').evaluateAll(svgs => svgs.map(svg => {
    let right = 0;
    svg.querySelectorAll('.note path, .note text').forEach(el => { const box = (el as SVGGraphicsElement).getBBox(); right = Math.max(right, box.x + box.width); });
    return right - Number(svg.getAttribute('width'));
  }));
  expect(overflow.every(over => over <= 0)).toBe(true);
  await expect(page.locator('.note text', { hasText: 'full' })).toHaveCount(4);
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

const openMore = (page: Page) => page.getByRole('button', { name: 'Mix and more', exact: true }).click();

test('a second Back while asking to discard groove changes keeps the address and the screen together', async ({ page }) => {
  await page.goto('./library/bass/exercises/');
  await page.locator('#jamNavBtn').click();
  await page.locator('#jamPickerButton').click();
  await page.locator('#jamGrooveList li').nth(2).locator('button, a').first().click();
  await openMore(page);
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

test('a mood sets the Jam to its chords, asks before dropping groove changes, and clears back to the groove title', async ({ page }) => {
  await page.goto('./jam/blues-shuffle/');
  const sad = page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Sad', exact: true });
  await openMore(page);
  await page.locator('#grooveEdit').click();
  const source = page.locator('#grooveSource');
  await source.fill(`${await source.inputValue()}\n# changed`);
  await page.keyboard.press('Escape');
  const ask = page.locator('#askDialog');
  await sad.click();
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(sad).toHaveAttribute('aria-pressed', 'false');
  await sad.click();
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(ask).toBeHidden();
  await expect(sad).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/jam\/slow-ballad\//);
  await page.locator('#jamPickerButton').click();
  await expect(page.locator('#jamFitHeading')).toHaveText('Fits Sad');
  await expect(page.locator('#jamFitList a')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#jamTitle')).toHaveText('Sad');
  await expect(page.locator('#jamKey')).toHaveValue(/m$/);
  await expect(page.locator('#jamMoodWhy')).toContainText('three frets above home');
  await expect(page.locator('#jamBars li').first()).toContainText('Home.');
  await page.locator('#jamPickerButton').click();
  await page.locator('#jamGrooves a', { hasText: 'Sixteenth funk' }).click();
  await expect(page).toHaveURL(/\/jam\/funk-sixteenths\//);
  await expect(page.locator('#jamTitle')).toHaveText('Sad');
  await expect(page.locator('#jamProgressionLabel')).toHaveText('Chords');
  await expect(page.locator('#jamProgression option')).toHaveCount(3);
  await sad.click();
  await expect(sad).toHaveAttribute('aria-pressed', 'true');
  const free = page.getByRole('button', { name: 'Free, no mood' });
  await free.click();
  await expect(free).toHaveAttribute('aria-pressed', 'true');
  await expect(sad).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#jamTitle')).toHaveText('Sixteenth funk in E minor');
  await expect(page.locator('#jamTempoHint')).toHaveText('');
  await expect(page.locator('#jamMoodWhy')).toHaveText('No mood. The groove plays its own chords.');
  await expect(page.locator('#jamProgression')).toHaveValue('groove');
  await expect(page.locator('[data-select="jamProgression"]')).toHaveText("Groove's own");
  await expect(page.locator('#jamFretboardNext')).toBeVisible();
  await expect(page.locator('#jamMoodLegend')).toBeHidden();
});

test('the Jam opens on Free, and a link that names only a mood opens its first loop', async ({ page }) => {
  await page.goto('./jam/blues-shuffle/');
  const chips = page.locator('#jamMoods button');
  await expect(chips.first()).toHaveText('Free');
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jamMoods [aria-pressed="true"]')).toHaveCount(1);
  await page.goto('./jam/rock-straight-eighths/?mood=melancholic');
  await expect(page.locator('#jamTitle')).toHaveText('Melancholic');
  await expect(page.locator('[data-select="jamProgression"]')).toHaveText('Wistful steps1/3');
  await expect(page.locator('#jamProgression option')).toHaveText([
    'Wistful steps: I iii IV iv, I vi IV iv',
    'Changed home: I IV iv I, vi IV iv V',
    'Soft and warm: Imaj7 vi7 IV iv, Imaj7 iii IV iv',
  ]);
});

test('a mood keeps unsaved groove text when the groove fits it', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/');
  await openMore(page);
  await page.locator('#grooveEdit').click();
  const source = page.locator('#grooveSource');
  await source.fill(`${await source.inputValue()}\n# changed`);
  await page.keyboard.press('Escape');
  const sad = page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Sad', exact: true });
  await sad.click();
  await expect(sad).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#askDialog')).toBeHidden();
  await expect(source).toHaveValue(/# changed$/);
  await expect(page).toHaveURL(/\/jam\/rock-straight-eighths\//);
});

test('a mood asks before it drops a new groove whose genre does not fit', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/');
  await openMore(page);
  await page.locator('#grooveNew').click();
  const source = page.locator('#grooveSource');
  await source.fill((await source.inputValue()).replace('genre: rock', 'genre: jazz').replace('title: My groove', 'title: My jazz'));
  await expect(page.locator('#jamTitleText')).toHaveText('My jazz');
  await page.keyboard.press('Escape');
  const ask = page.locator('#askDialog');
  const sad = page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Sad', exact: true });
  await sad.click();
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(sad).toHaveAttribute('aria-pressed', 'false');
  await expect(source).toHaveValue(/genre: jazz/);
});

test('a mood link opens the mood with its own key and tempo, and says when the tempo leaves the mood range', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/?mood=sad&key=Am&tempo=120&progression=sad-i-iv-i-v&swing=50');
  await expect(page.locator('#jamTitle')).toHaveText('Sad');
  await expect(page.locator('#jamKey')).toHaveValue('Am');
  await expect(page.locator('#jamShareHint')).toHaveText('Mood, key, tempo and chords');
  await expect(page.locator('#jamTempoHint')).toHaveText('Faster than usual for Sad: 56 to 88');
  await expect(page).toHaveURL(/\?mood=sad&key=Am&tempo=120&progression=sad-i-iv-i-v-bvi-biii-iv-v&swing=50$/);
  await expect(page.locator('#jamBars li')).toHaveCount(8);
  await page.goto('./jam/rock-straight-eighths/?mood=sad&progression=i-v-vi-iv');
  await expect(page.locator('#jamMoods [aria-pressed="true"]')).toHaveText(['Free']);
  await expect(page.locator('#jamShareHint')).toHaveText('Key, tempo, chords and swing');
});

test('Exciting starts fast with eight bars, and an old Exciting link opens its new loop', async ({ page }) => {
  await page.goto('./jam/blues-shuffle/');
  await page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Exciting', exact: true }).click();
  await expect(page.locator('#jamTitle')).toHaveText('Exciting');
  await expect(page.locator('#jamTempo')).toHaveValue('148');
  await expect(page.locator('#jamBars li')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.goto('./jam/rock-straight-eighths/?mood=exciting&progression=exciting-i-bvii-iv-i');
  await expect(page.locator('#jamTitle')).toHaveText('Exciting');
  await expect(page.locator('#jamBars li')).toHaveCount(8);
  await expect(page).toHaveURL(/progression=exciting-i-bvii-iv-i-i-bvii-iv-bvii/);
});

test('the open controls say when they leave the mood, and the groove list puts fitting grooves first', async ({ page }) => {
  await page.goto('./jam/blues-shuffle/');
  await page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Exciting', exact: true }).click();
  await expect(page.locator('#jamScale optgroup')).toHaveCount(2);
  await expect(page.locator('#jamScale optgroup').first()).toHaveAttribute('label', 'Carries the mood');
  await page.locator('[data-select="jamScale"]').click();
  await expect(page.locator('#jamScale-options [role="group"]').first()).toHaveAttribute('aria-label', 'Carries the mood');
  await page.locator('#jamScale-options').getByRole('option', { name: 'Major pentatonic' }).click();
  await expect(page.locator('#jamMoodLegend')).toHaveText('This scale leaves out G, the exciting note.');
  await expect(page.locator('#jamFretboardBoard .fb-mark[data-mood]')).toHaveCount(0);
  await page.locator('#jamPickerButton').click();
  await expect(page.locator('#jamFitHeading')).toHaveText('Fits Exciting');
  await expect(page.locator('#jamFitList a')).toHaveCount(3);
  await expect(page.locator('#jamFitList .jam-groove-title').first()).toHaveText('Driving hard rock in A');
  await expect(page.locator('#jamOtherHeading')).toHaveText('Other grooves');
  await page.keyboard.press('Escape');
  await openMore(page);
  await page.locator('#grooveEdit').click();
  const source = page.locator('#grooveSource');
  await source.fill((await source.inputValue()).replace(/^progression: .*$/m, 'progression: I I IV IV | V V IV I'));
  await expect(page.locator('#grooveFeedback')).toHaveText('Mood off. The groove plays the chords you wrote.');
  await expect(page.getByRole('button', { name: 'Free, no mood' })).toHaveAttribute('aria-pressed', 'true');
});

test('the tempo number opens its slider, with the usual tempo of the mood under it', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/?mood=sad');
  const tempoButton = page.locator('#jamTempoButton');
  await expect(page.locator('#jamTempo')).toBeHidden();
  await tempoButton.click();
  await expect(tempoButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#jamTempo')).toBeFocused();
  await expect(page.locator('#jamTempoHint')).toHaveText('Usual for Sad: 56 to 88');
  await page.locator('#jamTempo').fill('120');
  await expect(page.locator('#jamBpm')).toHaveText('120');
  await expect(tempoButton).toHaveAttribute('data-outside', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#jamTempoPanel')).toBeHidden();
  await expect(tempoButton).toBeFocused();
});

test('Mix and more opens a drawer that keeps the page playing, and keeps the groove text open when it closes', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/?mood=sad');
  const more = page.getByRole('button', { name: 'Mix and more', exact: true });
  const drawer = page.getByRole('dialog', { name: 'Mix and more' });
  await more.click();
  await expect(drawer).toBeFocused();
  const box = (await drawer.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (viewport.width >= 600) expect(Math.round(box.width)).toBe(380);
  else expect(Math.round(box.width)).toBe(viewport.width);
  await page.locator('#jamPlay').click();
  await expect(drawer).toBeVisible();
  await page.locator('#jamPlay').click();
  await page.locator('#grooveEdit').click();
  await expect(more).toHaveAttribute('data-editing', '');
  const source = page.locator('#grooveSource');
  await source.fill(`${await source.inputValue()}\n# changed`);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(more).toBeFocused();
  await expect(page.locator('#jamEditingNote')).toBeAttached();
  await expect(more).toHaveAttribute('data-editing', '');
  await page.getByRole('group', { name: 'How do you want it to feel?' }).getByRole('button', { name: 'Funky', exact: true }).click();
  const ask = page.locator('#askDialog');
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toBeHidden();
  await expect(source).toHaveValue(/# changed$/);
  await more.click();
  await expect(source).toBeVisible();
});

test('the now line under the bars names the playing chord, its job and the mood note', async ({ page }) => {
  await page.goto('./jam/rock-straight-eighths/?mood=sad');
  await expect(page.locator('#jamNowChord')).toHaveText('Em');
  await expect(page.locator('#jamFretboardJob')).toHaveText('Home. Minor, so it starts low.');
  await expect(page.locator('#jamFretboardNext')).toBeHidden();
  await expect(page.locator('#jamMoodLegend')).toContainText('G is the sad note.');
  await expect(page.locator('#jamBars li').first().locator('.jam-bar-numeral')).toHaveText('i');
});

test('the Jam fits its width, and a six string fretboard ends on the first screen', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await page.addInitScript(() => localStorage.setItem('tabtrainer:family', JSON.stringify('guitar')));
  for (const path of ['./jam/rock-straight-eighths/?mood=sad', './jam/blues-shuffle/?mood=bluesy', './jam/rock-straight-eighths/']) {
    await page.goto(path);
    await expect(page.locator('#jamFretboardBoard svg')).toBeAttached();
    const fit = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      boardBottom: document.querySelector('#jamFretboardBoard')!.getBoundingClientRect().bottom,
      transportTop: document.querySelector('.jam-transport')!.getBoundingClientRect().top,
    }));
    const viewport = page.viewportSize()!;
    expect(fit.scrollWidth).toBeLessThanOrEqual(viewport.width);
    expect(fit.boardBottom).toBeLessThanOrEqual(phone ? fit.transportTop : viewport.height);
  }
  const rowTops = await page.goto('./jam/blues-shuffle/?mood=bluesy').then(() => page.locator('#jamBars li').evaluateAll(items => new Set(items.map(item => item.getBoundingClientRect().top)).size));
  expect(rowTops).toBe(phone ? 2 : 1);
  await page.goto('./jam/rock-straight-eighths/?mood=sad');
  const sadRows = await page.locator('#jamBars li').evaluateAll(items => new Set(items.map(item => item.getBoundingClientRect().top)).size);
  expect(sadRows).toBe(phone ? 2 : 1);
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

test('the library invites a tab request that follows the page and the search', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name !== 'phone';
  await page.goto('./?view=library&kind=exercises&instrument=guitar');
  const [shown, hidden] = desktop ? [page.locator('#requestCard'), page.locator('#tabRequest')] : [page.locator('#tabRequest'), page.locator('#requestCard')];
  await expect(shown).toContainText(desktop ? 'Missing a guitar exercise?' : 'Looking for a guitar exercise that is not here?');
  await expect(hidden).toBeHidden();
  if (desktop) await expect(shown).toBeInViewport({ ratio: 1 });
  await expect(shown.locator('a')).toHaveAttribute('href', /template=song-request\.yml/);
  await page.locator('#songSearch').fill('zzz nothing');
  await expect(shown).toBeVisible();
  await expect(shown).toContainText('"zzz nothing"');
  await page.goto('./?view=library&kind=mine');
  await expect(shown).toBeHidden();
  if (!desktop) return;
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('./?view=library&kind=songs&instrument=bass');
  await expect(page.locator('#tabRequest')).toContainText('Looking for a bass song that is not here?');
  await expect(page.locator('#requestCard')).toBeHidden();
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

test('help opened from the phone File menu gives focus back to the menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'The File menu item only shows on phones');
  await openFirstExercise(page);
  await page.locator('.file-menu summary').click();
  await page.locator('#feedbackMenuBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#feedback')).toBeHidden();
  await expect(page.locator('.file-menu summary')).toBeFocused();
});

test('a row marks a song done by hand, keeps it after a reload, and takes it back', async ({ page }) => {
  await page.goto('./?view=library&kind=exercises&instrument=bass');
  const toggle = page.locator('#catalogueList li').first().locator('.done-toggle:visible');
  await toggle.click();
  await expect(page.locator('#libraryScreen')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toContainText(/Done/);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText('Not started');
});

test('a row marks each practice level on its own', async ({ page }) => {
  await page.goto('./?view=library&kind=exercises&instrument=bass');
  const row = page.locator('#catalogueList li', { has: page.locator('.level-marks') }).first();
  await row.locator('.level-mark', { hasText: 'Learn' }).click();
  await expect(row.locator('.level-mark', { hasText: 'Learn' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row.locator('.level-mark', { hasText: 'Develop' })).toHaveAttribute('aria-pressed', 'false');
  await expect(row.locator('.row-status')).toHaveClass(/partial/);
  await expect(page.locator('#libraryScreen')).toBeVisible();
});
