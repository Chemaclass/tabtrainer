import { describe, expect, it } from 'vitest';
import { sharePage, sitemap, songMeta } from '../src/build/sharePages';
import { shareUrl } from '../src/ui/songLink';

const site = 'https://example.com/tabtrainer/';
const path = './songs/bass/songs/01-ode-to-joy.txt';

describe('share pages', () => {
  it('reads the title and summary the way the app does', () => {
    const meta = songMeta(path, 'Title: Ode "to" Joy  # note\nabout: A melody\nkey: F#m\n\n"C" :q 2.2 |\n');
    expect(meta).toEqual({ title: 'Ode "to" Joy', about: 'A melody', family: 'bass' });
  });
  it('previews the song and sends readers to it in the app', () => {
    const html = sharePage(site, path, { title: 'Ode "to" Joy', about: 'A melody', family: 'bass' });
    expect(html).toContain('<meta property="og:title" content="Ode &quot;to&quot; Joy, bass tab and notation · TabTrainer" />');
    expect(html).toContain('<meta property="og:url" content="https://example.com/tabtrainer/bass/ode-to-joy/" />');
    expect(html).toContain('<meta property="og:image" content="https://example.com/tabtrainer/og.png" />');
    expect(html).toContain('location.replace("../../?song=bass%2Fode-to-joy"');
  });
  it('lists the home page and every song in the sitemap', () => {
    expect(sitemap(site, [path])).toContain('<loc>https://example.com/tabtrainer/?song=bass%2Fode-to-joy</loc>');
  });
  it('shares the song page, with the version when there is one', () => {
    expect(shareUrl(site, path, null)).toBe('https://example.com/tabtrainer/bass/ode-to-joy/');
    expect(shareUrl(site, path, 'solo-bass')).toBe('https://example.com/tabtrainer/bass/ode-to-joy/?version=solo-bass');
  });
});
