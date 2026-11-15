import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { familyOf } from '../../src/core/instruments';
import { buildTimeline } from '../../src/core/timeline';
import { DEMO_SPEEDS, DEMO_START_SPEED, demoSongText, landingEntries } from '../../src/app/landingDemo';
import { findBySlug, songSlug } from '../../src/app/songLink';
import { readRoute } from '../../src/app/navigation';
import { routeQuery } from '../../src/app/address';

const song = (title: string, instrument: string, level = 'easy') => `title: ${title}\nlevel: ${level}\ninstrument: ${instrument}\ntempo: 80\n\n:q 3.3 |\n`;
const bundled = {
  './songs/bass/exercises/02-finger-independence.txt': song('Finger Independence', 'bass4'),
  './songs/bass/exercises/01-first-steps.txt': song('First Steps: open strings and roots', 'bass4'),
  './songs/bass/exercises/04-rhythm-ladder.txt': song('Rhythm Ladder', 'bass4', 'medium'),
  './songs/bass/songs/01-ode-to-joy.txt': song('Ode to Joy', 'bass4'),
  './songs/bass/songs/02-canon-in-d.txt': song('Canon in D', 'bass4'),
  './songs/guitar/exercises/01-open-string-picking.txt': song('Open String Picking', 'guitar6'),
  './songs/guitar/exercises/02-first-chord-changes.txt': song('First Chord Changes', 'guitar6'),
  './songs/guitar/songs/01-ode-to-joy.txt': song('Ode to Joy', 'guitar6'),
};

describe('landing demo', () => {
  it('plays two clean bars of the chosen instrument', () => {
    for (const family of ['bass', 'guitar'] as const) {
      const { song: parsed, issues } = parseSong(demoSongText(family));
      expect(issues).toEqual([]);
      expect(familyOf(parsed.meta.instrument)).toBe(family);
      expect(parsed.bars).toHaveLength(2);
      expect(buildTimeline(parsed).total).toBe(8);
    }
  });
  it('starts at three quarters speed, one of the speeds it offers', () => {
    expect(DEMO_SPEEDS).toContain(DEMO_START_SPEED);
    expect(DEMO_SPEEDS).toEqual([50, 75, 100]);
  });
});

describe('landing entries', () => {
  it('opens the first exercise, the rhythm ladder and the songs of the chosen instrument', () => {
    const bass = landingEntries(bundled, 'bass', '/tabtrainer/');
    expect(bass.firstSteps).toEqual({ href: '/tabtrainer/bass/first-steps/', detail: 'First Steps · easy' });
    expect(bass.rhythm).toEqual({ href: '/tabtrainer/bass/rhythm-ladder/', detail: 'Rhythm Ladder · medium' });
    expect(bass.songs).toEqual({ href: '/tabtrainer/?view=library&kind=songs&instrument=bass', detail: 'Ode to Joy and 1 more' });
  });
  it('falls back to the second exercise when an instrument has no rhythm ladder', () => {
    const guitar = landingEntries(bundled, 'guitar', '/tabtrainer/');
    expect(guitar.firstSteps.detail).toBe('Open String Picking · easy');
    expect(guitar.rhythm.href).toBe('/tabtrainer/guitar/first-chord-changes/');
    expect(guitar.songs.detail).toBe('Ode to Joy');
  });
  it('links to bundled songs the app can open', () => {
    const files = readdirSync('src/songs', { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.txt'));
    const real = Object.fromEntries(files.map(file => [`./songs/${file}`, readFileSync(`src/songs/${file}`, 'utf8')]));
    const paths = Object.keys(real);
    for (const family of ['bass', 'guitar'] as const) {
      const entries = landingEntries(real, family, '/');
      for (const { href } of [entries.firstSteps, entries.rhythm]) {
        const slug = new URLSearchParams(routeQuery(href, '', '/')).get('song') ?? '';
        expect(songSlug(findBySlug(paths, slug) ?? '')).toBe(slug);
      }
      expect(entries.rhythm.detail).toMatch(/^Rhythm Ladder/);
      expect(readRoute(entries.songs.href.slice(1), paths)).toEqual({ screen: 'library', kind: 'songs', family });
    }
  });
});
