import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { grooveSlug } from '../src/app/jamLink';
import { songSlug, versionSlug } from '../src/app/songLink';
import { parseSong } from '../src/core/parser';
import { stubAudioContext } from './audioStub';

interface Shot { query: Record<string, string>; opened: [name: string, slug: string]; area: string; drawn: string; image: string }

const OUT = 'song-preview';
const SONG = /^src\/songs\/[^/]+\/[^/]+\/[^/]+\.txt$/;
const GROOVE = /^src\/grooves\/[^/]+\.txt$/;

const imageName = (path: string, version = '') => `${OUT}/${path.replace(/^src\//, '').replace(/\.txt$/, '').replace(/\//g, '-')}${version && `--${version}`}.png`;

function songShots(path: string): Shot[] {
  const song = songSlug(path);
  const shot = { query: { song }, opened: ['song', song] as Shot['opened'], area: '#sheet', drawn: '.note', image: imageName(path) };
  const versions = parseSong(readFileSync(path, 'utf8')).song.versions.map(version => versionSlug(version.name));
  if (versions.length < 2) return [shot];
  return versions.map(version => ({ ...shot, query: { song, version }, image: imageName(path, version) }));
}

function shots(path: string): Shot[] {
  if (!existsSync(path)) throw new Error('No such file.');
  if (SONG.test(path)) return songShots(path);
  const groove = grooveSlug(path);
  if (GROOVE.test(path)) return [{ query: { view: 'jam', groove }, opened: ['groove', groove], area: '#jamScreen', drawn: '#jamBars li', image: imageName(path) }];
  throw new Error('Not a song or groove file.');
}

// The top bar, save bar and player float over the page, so an element screenshot would show them on top of the sheet.
function hideOverlays(area: string) {
  const shown = document.querySelector(area);
  for (const element of document.querySelectorAll<HTMLElement>('body *')) {
    const { position } = getComputedStyle(element);
    if ((position !== 'fixed' && position !== 'sticky') || shown?.contains(element)) continue;
    if (element.contains(shown)) element.style.position = 'static';
    else element.style.visibility = 'hidden';
  }
}

async function render(page: Page, base: string, shot: Shot) {
  await page.goto(`${base}?${new URLSearchParams(shot.query)}`);
  const area = page.locator(shot.area);
  await area.locator(shot.drawn).first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => { throw new Error('nothing was drawn within 10 seconds.'); });
  const [name, slug] = shot.opened;
  // The app moves the query into the address, such as /guitar/fur-elise/ or /jam/rock-straight-eighths/.
  const opened = await page.evaluate(() => decodeURIComponent(location.pathname));
  if (!opened.endsWith(`/${slug}/`)) throw new Error(`the app opened ${opened} instead of the ${name} ${slug}; is the file in the build?`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(hideOverlays, shot.area);
  await area.screenshot({ path: shot.image, animations: 'disabled' });
}

const paths = process.argv.slice(2).map(path => path.replace(/\\/g, '/').replace(/^\.\//, ''));
mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls?.local[0];
const browser = await chromium.launch();
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await page.addInitScript(stubAudioContext);
  for (const path of paths) {
    try {
      if (!base) throw new Error('The preview server gave no address.');
      for (const shot of shots(path)) {
        await render(page, base, shot);
        console.log(`${path}: rendered ${shot.image}`);
      }
    } catch (error) {
      failed++;
      console.log(`${path}: could not render: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exitCode = failed > 0 ? 1 : 0;
