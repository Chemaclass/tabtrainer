import { parseSong } from '../core/parser';
import { parseGroove } from '../core/groove';
import { songAddress, songSlug } from '../app/songLink';
import { jamAddress } from '../app/jamLink';

export interface SongMeta { title: string; about: string; family: string }
export interface GrooveMeta { title: string; about: string; genre: string }

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function songMeta(path: string, text: string): SongMeta {
  const { meta } = parseSong(text).song;
  return { title: meta.title, about: meta.about ?? '', family: songSlug(path).split('/')[0] };
}

interface PageMeta { title: string; description: string; url: string; type: string; data: object; imageAlt: string }

export const CARD_IMAGE = 'og.png';
const PAGE_META = /<!-- page meta[^>]*-->[\s\S]*?<!-- \/page meta -->/;

function pageMeta({ title: plainTitle, description: plainDescription, url: plainUrl, type, data, imageAlt: plainAlt }: PageMeta): string {
  const title = escapeHtml(plainTitle), description = escapeHtml(plainDescription), url = escapeHtml(plainUrl), image = escapeHtml(`${plainUrl}${CARD_IMAGE}`);
  const structured = JSON.stringify(data).replaceAll('<', '\\u003c');
  const imageAlt = escapeHtml(plainAlt);
  return `<title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="TabTrainer" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${imageAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${imageAlt}" />
  <script type="application/ld+json">${structured}</script>`;
}

// The page is the app itself with the song's own head, so a reload or a shared link opens it in place.
export function withPageMeta(appHtml: string, meta: string): string {
  if (!PAGE_META.test(appHtml)) throw new Error('index.html lost its page meta markers');
  return appHtml.replace(PAGE_META, () => meta);
}

export function grooveMeta(text: string): GrooveMeta {
  const { title, about, genre } = parseGroove(text).groove;
  return { title, about: about ?? '', genre };
}

export function songPageMeta(site: string, path: string, meta: SongMeta): string {
  const address = songAddress(site, path);
  return pageMeta({
    title: `${meta.title}, ${meta.family} tab with rhythm · TabTrainer`,
    description: meta.about || `Practise ${meta.title} on ${meta.family}: slow it down, loop the hard bars, and follow each note as it plays.`,
    url: address,
    type: 'music.song',
    data: { '@context': 'https://schema.org', '@type': 'MusicComposition', name: meta.title, url: address, ...meta.about && { description: meta.about }, isAccessibleForFree: true, isPartOf: { '@type': 'WebApplication', name: 'TabTrainer', url: site } },
    imageAlt: `${meta.title}: its first bars of ${meta.family} tab`,
  });
}

export function groovePageMeta(site: string, slug: string, meta: GrooveMeta): string {
  const address = jamAddress(site, slug);
  return pageMeta({
    title: `${meta.title}, ${meta.genre} backing groove · TabTrainer`,
    description: meta.about || `Jam over a ${meta.genre} groove of drums, bass and keys on bass or guitar. Pick your key and tempo.`,
    url: address,
    type: 'website',
    data: { '@context': 'https://schema.org', '@type': 'MusicComposition', name: meta.title, url: address, genre: meta.genre, ...meta.about && { description: meta.about }, isAccessibleForFree: true, isPartOf: { '@type': 'WebApplication', name: 'TabTrainer', url: site } },
    imageAlt: `${meta.title}: its first chords`,
  });
}

export function sitemap(site: string, paths: string[], grooves: string[] = []): string {
  const urls = [site, ...paths.map(path => songAddress(site, path)), ...grooves.map(slug => jamAddress(site, slug))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`;
}

export const robotsTxt = (site: string) => `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`;
