import { parseSong } from '../core/parser';
import { parseGroove } from '../core/groove';
import { songAddress } from '../app/songLink';
import { jamAddress } from '../app/jamLink';
import { libraryAddress } from '../app/address';
import { creditedArtist, jamPageTitle, libraryIndexPage, libraryPage, songPageTitle } from '../app/pageTitles';
import type { LibraryKind } from '../app/catalogue';
import type { Family } from '../core/instruments';

export interface SongMeta { title: string; about: string; family: Family; kind: 'exercises' | 'songs'; artist: string }
export interface GrooveMeta { title: string; about: string; genre: string }

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function songMeta(path: string, text: string): SongMeta {
  const { meta } = parseSong(text).song;
  const [family, kind] = path.split('/').slice(2, 4);
  if ((family !== 'bass' && family !== 'guitar') || (kind !== 'exercises' && kind !== 'songs')) throw new Error(`${path} is not under songs/<family>/<exercises|songs>/`);
  return { title: meta.title, about: meta.about ?? '', family, kind, artist: creditedArtist(meta.artist) };
}

interface PageMeta { title: string; description: string; url: string; type: string; data: object; imageAlt: string; image?: string; indexed?: boolean }

export const CARD_IMAGE = 'og.png';
const SONG_HEADING = /<h1 id="title"[^>]*><\/h1>/;
const PAGE_META = /<!-- page meta[^>]*-->[\s\S]*?<!-- \/page meta -->/;

function pageMeta({ title: plainTitle, description: plainDescription, url: plainUrl, type, data, imageAlt: plainAlt, image: plainImage = `${plainUrl}${CARD_IMAGE}`, indexed = true }: PageMeta): string {
  const title = escapeHtml(plainTitle), description = escapeHtml(plainDescription), url = escapeHtml(plainUrl), image = escapeHtml(plainImage);
  const structured = JSON.stringify(data).replaceAll('<', '\\u003c');
  const imageAlt = escapeHtml(plainAlt);
  return `<title>${title}</title>
  <meta name="description" content="${description}" />${indexed ? '' : '\n  <meta name="robots" content="noindex" />'}
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="TabTrainer" />
  <meta property="og:locale" content="en_GB" />
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
export function withPageMeta(appHtml: string, meta: string, heading?: string): string {
  if (!PAGE_META.test(appHtml)) throw new Error('index.html lost its page meta markers');
  const page = appHtml.replace(PAGE_META, () => meta);
  if (heading === undefined) return page;
  if (!SONG_HEADING.test(page)) throw new Error('index.html lost its song title heading');
  return page.replace(SONG_HEADING, match => match.replace('></h1>', `>${escapeHtml(heading)}</h1>`));
}

export function grooveMeta(text: string): GrooveMeta {
  const { title, about, genre } = parseGroove(text).groove;
  return { title, about: about ?? '', genre };
}

const APP = (site: string) => ({ '@type': 'WebApplication', name: 'TabTrainer', url: site });
const crumbs = (items: [string, string][]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

export function songPageMeta(site: string, path: string, meta: SongMeta): string {
  const address = songAddress(site, path), library = libraryPage(meta.kind, meta.family);
  const by = meta.artist ? ` by ${meta.artist}` : '';
  const piece = {
    '@type': 'MusicComposition', name: meta.title, url: address, inLanguage: 'en', isAccessibleForFree: true, isPartOf: APP(site),
    ...meta.about && { description: meta.about },
  };
  return pageMeta({
    title: songPageTitle(meta.title, meta.family, meta.artist),
    description: meta.about ? `${meta.about} Free ${meta.family} tab${by} with rhythm: slow it down and loop the hard bars.` : `Practise ${meta.title}${by} on ${meta.family}: slow it down, loop the hard bars, and follow each note as it plays.`,
    url: address,
    type: 'music.song',
    data: { '@context': 'https://schema.org', '@graph': [piece, crumbs([['TabTrainer', site], [library.title.replace(' · TabTrainer', ''), libraryAddress(site, meta.kind, meta.family)], [meta.title, address]])] },
    imageAlt: `${meta.title}: its first bars of ${meta.family} tab`,
  });
}

export function groovePageMeta(site: string, slug: string, meta: GrooveMeta): string {
  const address = jamAddress(site, slug);
  return pageMeta({
    title: jamPageTitle(meta.title, meta.genre),
    description: meta.about || `Jam over a ${meta.genre} groove of drums, bass and keys on bass or guitar. Pick your key and tempo.`,
    url: address,
    type: 'website',
    data: { '@context': 'https://schema.org', '@type': 'MusicComposition', name: meta.title, url: address, genre: meta.genre, inLanguage: 'en', ...meta.about && { description: meta.about }, isAccessibleForFree: true, isPartOf: APP(site) },
    imageAlt: `${meta.title}: its first chords`,
  });
}

export function libraryPageMeta(site: string, kind: LibraryKind | null, family: Family | null): string {
  const { title, description } = kind && family ? libraryPage(kind, family) : libraryIndexPage(family), address = libraryAddress(site, family && kind, family);
  return pageMeta({
    title, description, url: address, type: 'website', image: `${site}${CARD_IMAGE}`, indexed: kind !== 'mine',
    data: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: address, description, inLanguage: 'en', isPartOf: APP(site) },
    imageAlt: 'TabTrainer: tab with rhythm for bass and guitar',
  });
}

const FAMILIES = ['bass', 'guitar'] as const;
export const LIBRARY_PAGES = FAMILIES.flatMap(family => (['exercises', 'songs', 'mine'] as const).map(kind => ({ family, kind })));
export const LIBRARY_INDEXES = [null, ...FAMILIES];

export function sitemap(site: string, paths: string[], grooves: string[] = []): string {
  const library = LIBRARY_PAGES.filter(({ kind }) => kind !== 'mine').map(({ kind, family }) => libraryAddress(site, kind, family));
  const urls = [site, ...library, ...paths.map(path => songAddress(site, path)), ...grooves.map(slug => jamAddress(site, slug))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`;
}

export const robotsTxt = (site: string) => `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`;
