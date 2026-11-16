import { describe, expect, it } from 'vitest';
import { groovePageMeta, grooveMeta, libraryPageMeta, robotsTxt, sitemap, songMeta, songPageMeta, withPageMeta } from '../../src/build/sharePages';
import { shareUrl } from '../../src/app/songLink';

const site = 'https://example.com/tabtrainer/';
const path = './songs/bass/songs/01-ode-to-joy.txt';

describe('share pages', () => {
  it('reads the title and summary the way the app does', () => {
    const meta = songMeta(path, 'Title: Ode "to" Joy  # note\nartist: Ludwig van Beethoven (public domain)\nabout: A melody\nkey: F#m\n\n"C" :q 2.2 |\n');
    expect(meta).toEqual({ title: 'Ode "to" Joy', about: 'A melody', family: 'bass', kind: 'songs', artist: 'Ludwig van Beethoven' });
  });
  it('gives the song page its own title, address and card', () => {
    const meta = songPageMeta(site, path, { title: 'Ode "to" Joy', about: 'A melody.', family: 'bass', kind: 'songs', artist: 'Beethoven' });
    expect(meta).toContain('<title>Ode &quot;to&quot; Joy by Beethoven, bass tab with rhythm · TabTrainer</title>');
    expect(meta).toContain('<meta name="description" content="A melody. Free bass tab by Beethoven with rhythm: slow it down and loop the hard bars." />');
    expect(meta).not.toContain('noindex');
    expect(meta).toContain('<link rel="canonical" href="https://example.com/tabtrainer/bass/ode-to-joy/" />');
    expect(meta).toContain('<meta property="og:url" content="https://example.com/tabtrainer/bass/ode-to-joy/" />');
    expect(meta).toContain('<meta property="og:type" content="music.song" />');
    expect(meta).toContain('<meta property="og:image" content="https://example.com/tabtrainer/bass/ode-to-joy/og.png" />');
    expect(meta).toContain('<meta name="twitter:image" content="https://example.com/tabtrainer/bass/ode-to-joy/og.png" />');
  });
  it('keeps structured data safe inside the script tag', () => {
    const meta = songPageMeta(site, path, { title: 'Ode <to> Joy', about: 'A melody', family: 'bass', kind: 'songs', artist: '' });
    const json = meta.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1];
    expect(json).not.toContain('<');
    const [piece, crumbs] = JSON.parse(json)['@graph'];
    expect(piece).toMatchObject({ '@type': 'MusicComposition', name: 'Ode <to> Joy', url: 'https://example.com/tabtrainer/bass/ode-to-joy/' });
    expect(crumbs.itemListElement.map((c: { name: string; item: string }) => [c.name, c.item])).toEqual([
      ['TabTrainer', site], ['Bass songs', 'https://example.com/tabtrainer/library/bass/songs/'], ['Ode <to> Joy', 'https://example.com/tabtrainer/bass/ode-to-joy/'],
    ]);
  });
  it('writes the song title into the page heading before the app runs', () => {
    const app = '<!-- page meta -->x<!-- /page meta --><h1 id="title" tabindex="-1"></h1>';
    expect(withPageMeta(app, 'm', 'Ode <to> Joy')).toBe('m<h1 id="title" tabindex="-1">Ode &lt;to&gt; Joy</h1>');
  });
  it('swaps only the page meta of the app page', () => {
    const app = '<head>\n  <meta charset="utf-8" />\n  <!-- page meta: x -->\n  <title>App</title>\n  <!-- /page meta -->\n  <script src="/a.js"></script>\n</head>';
    expect(withPageMeta(app, '<title>Song $&</title>')).toBe('<head>\n  <meta charset="utf-8" />\n  <title>Song $&</title>\n  <script src="/a.js"></script>\n</head>');
    expect(() => withPageMeta('<head></head>', '<title>Song</title>')).toThrow(/page meta/);
  });
  it('lists the home page and every song address in the sitemap', () => {
    const xml = sitemap(site, [path]);
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/</loc></url>');
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/bass/ode-to-joy/</loc></url>');
  });
  it('reads the groove title, genre and summary', () => {
    expect(grooveMeta('title: Funk "sixteenths"\ngenre: Funk\nabout: Tight\ntempo: 96\nkey: Em\nprogression: i7\nkick: x...\n')).toEqual({ title: 'Funk "sixteenths"', about: 'Tight', genre: 'Funk' });
  });
  it('gives the groove page its own title, address and summary', () => {
    const meta = groovePageMeta(site, 'funk-sixteenths', { title: 'Funk <sixteenths>', about: '', genre: 'Funk' });
    expect(meta).toContain('<title>Funk &lt;sixteenths&gt;, Funk backing groove · TabTrainer</title>');
    expect(meta).toContain('<meta name="description" content="Jam over a Funk groove of drums, bass and keys on bass or guitar. Pick your key and tempo." />');
    expect(meta).toContain('<link rel="canonical" href="https://example.com/tabtrainer/jam/funk-sixteenths/" />');
    const json = meta.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1];
    expect(JSON.parse(json)).toMatchObject({ '@type': 'MusicComposition', name: 'Funk <sixteenths>', genre: 'Funk' });
  });
  it('gives each library page its own title and address, with the site card', () => {
    const meta = libraryPageMeta(site, 'songs', 'bass');
    expect(meta).toContain('<title>Bass songs · TabTrainer</title>');
    expect(meta).toContain('<link rel="canonical" href="https://example.com/tabtrainer/library/bass/songs/" />');
    expect(meta).toContain('<meta property="og:image" content="https://example.com/tabtrainer/og.png" />');
    expect(meta).not.toContain('noindex');
  });
  it('keeps your own songs page out of search results', () => {
    expect(libraryPageMeta(site, 'mine', 'bass')).toContain('<meta name="robots" content="noindex" />');
  });
  it('lists the shared library pages in the sitemap, not your own songs', () => {
    const xml = sitemap(site, []);
    expect(xml).toContain('<loc>https://example.com/tabtrainer/library/guitar/exercises/</loc>');
    expect(xml).not.toContain('/mine/');
  });
  it('lists every groove address in the sitemap after the songs', () => {
    const xml = sitemap(site, [path], ['blues-shuffle']);
    expect(xml).toContain('<url><loc>https://example.com/tabtrainer/bass/ode-to-joy/</loc></url>\n  <url><loc>https://example.com/tabtrainer/jam/blues-shuffle/</loc></url>');
  });
  it('points robots.txt at the sitemap', () => {
    expect(robotsTxt(site)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://example.com/tabtrainer/sitemap.xml\n');
  });
  it('shares the song page, with the version when there is one', () => {
    expect(shareUrl(site, path, null)).toBe('https://example.com/tabtrainer/bass/ode-to-joy/');
    expect(shareUrl(site, path, 'solo-bass')).toBe('https://example.com/tabtrainer/bass/ode-to-joy/?version=solo-bass');
  });
});
