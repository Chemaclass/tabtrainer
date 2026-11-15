import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, type Locator, type Page } from '@playwright/test';
import { preview } from 'vite';
import { grooveSlug } from '../src/app/jamLink';
import { songSlug, versionSlug } from '../src/app/songLink';
import { parseSong } from '../src/core/parser';
import { stubAudioContext } from './audioStub';

interface Shot { address: string; area: (page: Page) => Locator; drawn: string; image: string }

const OUT = 'song-preview';
const SONG = /^src\/songs\/[^/]+\/[^/]+\/[^/]+\.txt$/;
const GROOVE = /^src\/grooves\/[^/]+\.txt$/;

const imageName = (path: string, version = '') => `${OUT}/${path.replace(/^src\//, '').replace(/\.txt$/, '').replace(/\//g, '-')}${version && `--${version}`}.png`;

function songShots(path: string): Shot[] {
  const song = `?${new URLSearchParams({ song: songSlug(path) })}`;
  const versions = parseSong(readFileSync(path, 'utf8')).song.versions.map(version => versionSlug(version.name));
  const area = (page: Page) => page.locator('#sheet');
  if (versions.length < 2) return [{ address: song, area, drawn: '.note', image: imageName(path) }];
  return versions.map(version => ({ address: `${song}&${new URLSearchParams({ version })}`, area, drawn: '.note', image: imageName(path, version) }));
}

function shots(path: string): Shot[] {
  if (SONG.test(path)) return songShots(path);
  if (GROOVE.test(path)) return [{ address: `?${new URLSearchParams({ view: 'jam', groove: grooveSlug(path) })}`, area: page => page.locator('#jamScreen'), drawn: '#jamBars li', image: imageName(path) }];
  throw new Error('Not a song or groove file.');
}

async function render(page: Page, base: string, shot: Shot) {
  await page.goto(`${base}${shot.address}`);
  const area = shot.area(page);
  await area.locator(shot.drawn).first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => { throw new Error('nothing was drawn within 10 seconds.'); });
  await page.evaluate(() => document.fonts.ready);
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
