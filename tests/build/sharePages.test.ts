import { describe, expect, it } from 'vitest';
import { groovePage, grooveMeta, robotsTxt, sharePage, sitemap, songMeta } from '../../src/build/sharePages';
import { shareUrl } from '../../src/app/songLink';

const site = 'https://example.com/tabtrainer/';
const path = './songs/bass/songs/01-ode-to-joy.txt';

describe('share pages', () => {
  it('reads the title and summary the way the app does', () => {
    const meta = songMeta(path, 'Title: Ode "to" Joy  # note\nabout: A melody\nkey: F#m\n\n"C" :q 2.2 |\n');
    expect(meta).toEqual({ title: 'Ode "to" Joy', about: 'A melody', family: 'bass' });
  });
  it('previews the song and sends readers to it in the app', () => {
    const html = sharePage(site, path, { title: 'Ode "to" Joy', about: 'A melody', family: 'bass' });
    expect(html).toContain('<meta property="og:title" content="Ode &quot;to&quot; Joy, bass tab with rhythm · TabTrainer" />');
    expect(html).toContain('<meta property="og:url" content="https://example.com/tabtrainer/bass/ode-to-joy/" />');
    expect(html).toContain('<meta property="og:image" content="https://example.com/tabtrainer/bass/ode-to-joy/og.png" />');
    expect(html).toContain('location.replace("../../?song=bass%2Fode-to-joy"');
  });
  it('points the share page canonical at the song address, with a card and structured data', () => {
    const html = sharePage(site, path, { title: 'Ode <to> Joy', about: 'A melody', family: 'bass' });
    expect(html).toContain('<link rel="canonical" href="https://example.com/tabtrainer/?song=bass%2Fode-to-joy" />');
    expect(html).toContain('<meta property="og:url" content="https://example.com/tabtrainer/bass/ode-to-joy/" />');
    expect(html).toContain('<meta property="og:type" content="music.song" />');
    expect(html).toContain('<meta name="twitter:image" content="https://example.com/tabtrainer/bass/ode-to-joy/og.png" />');
    expect(html).toContain('<meta property="og:image:alt"');
    const json = html.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1];
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toMatchObject({ '@type': 'MusicComposition', name: 'Ode <to> Joy', url: 'https://example.com/tabtrainer/?song=bass%2Fode-to-joy' });
  });
  it('lists the home page and every song address in the sitemap', () => {
    const xml = sitemap(site, [path]);
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/</loc></url>');
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/?song=bass%2Fode-to-joy</loc></url>');
  });
  it('reads the groove title, genre and summary', () => {
    expect(grooveMeta('title: Funk "sixteenths"\ngenre: Funk\nabout: Tight\ntempo: 96\nkey: Em\nprogression: i7\nkick: x...\n')).toEqual({ title: 'Funk "sixteenths"', about: 'Tight', genre: 'Funk' });
  });
  it('previews the groove and sends readers to it in the app with the shared setup', () => {
    const html = groovePage(site, 'funk-sixteenths', { title: 'Funk <sixteenths>', about: '', genre: 'Funk' });
    expect(html).toContain('<title>Funk &lt;sixteenths&gt;, Funk backing groove · TabTrainer</title>');
    expect(html).toContain('<meta name="description" content="Jam over a Funk groove of drums, bass and keys on bass or guitar. Pick your key and tempo." />');
    expect(html).toContain('<link rel="canonical" href="https://example.com/tabtrainer/?view=jam&amp;groove=funk-sixteenths" />');
    expect(html).toContain('<meta property="og:url" content="https://example.com/tabtrainer/jam/funk-sixteenths/" />');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=../../?view=jam&amp;groove=funk-sixteenths" />');
    expect(html).toContain('location.replace("../../?view=jam&groove=funk-sixteenths" + location.search.replace(/^\\?/, \'&\') + location.hash)');
    const json = html.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1];
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toMatchObject({ '@type': 'MusicComposition', name: 'Funk <sixteenths>', genre: 'Funk' });
  });
  it('lists every groove address in the sitemap after the songs', () => {
    const xml = sitemap(site, [path], ['blues-shuffle']);
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/?song=bass%2Fode-to-joy</loc></url>\n  <url><loc>https://example.com/tabtrainer/?view=jam&amp;groove=blues-shuffle</loc></url>');
  });
  it('points robots.txt at the sitemap', () => {
    expect(robotsTxt(site)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://example.com/tabtrainer/sitemap.xml\n');
  });
  it('shares the song page, with the version when there is one', () => {
    expect(shareUrl(site, path, null)).toBe('https://example.com/tabtrainer/bass/ode-to-joy/');
    expect(shareUrl(site, path, 'solo-bass')).toBe('https://example.com/tabtrainer/bass/ode-to-joy/?version=solo-bass');
  });
});
