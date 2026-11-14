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

interface Preview { title: string; description: string; canonical: string; url: string; local: string; type: string; data: object; link: string }

function previewPage({ title: plainTitle, description: plainDescription, canonical, url, local, type, data, link }: Preview, site: string): string {
  const title = escapeHtml(plainTitle), description = escapeHtml(plainDescription), image = `${site}og.png`;
  const structured = JSON.stringify(data).replaceAll('<', '\\u003c');
  const imageAlt = 'TabTrainer: notation and tab for bass and guitar';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="TabTrainer" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${imageAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${imageAlt}" />
  <script type="application/ld+json">${structured}</script>
  <meta http-equiv="refresh" content="0; url=${escapeHtml(local)}" />
  <script>location.replace(${JSON.stringify(local)} + location.search.replace(/^\\?/, '&') + location.hash);</script>
</head>
<body><a href="${escapeHtml(local)}">${escapeHtml(link)}</a></body>
</html>
`;
}

export function grooveMeta(text: string): GrooveMeta {
  const { title, about, genre } = parseGroove(text).groove;
  return { title, about: about ?? '', genre };
}

export function sharePage(site: string, path: string, meta: SongMeta): string {
  const address = songAddress(site, path);
  return previewPage({
    title: `${meta.title}, ${meta.family} tab and notation · TabTrainer`,
    description: meta.about || `Practise ${meta.title} on ${meta.family}: slow it down, loop the hard bars, and follow each note as it plays.`,
    canonical: address,
    url: `${site}${songSlug(path)}/`,
    local: `../../?${new URLSearchParams({ song: songSlug(path) })}`,
    type: 'music.song',
    data: { '@context': 'https://schema.org', '@type': 'MusicComposition', name: meta.title, url: address, ...meta.about && { description: meta.about }, isAccessibleForFree: true, isPartOf: { '@type': 'WebApplication', name: 'TabTrainer', url: site } },
    link: `Open ${meta.title} in TabTrainer`,
  }, site);
}

export function groovePage(site: string, slug: string, meta: GrooveMeta): string {
  const address = jamAddress(site, slug);
  return previewPage({
    title: `${meta.title}, ${meta.genre} backing groove · TabTrainer`,
    description: meta.about || `Jam over a ${meta.genre} groove of drums, bass and keys on bass or guitar. Pick your key and tempo.`,
    canonical: address,
    url: `${site}jam/${slug}/`,
    local: `../../?${new URLSearchParams({ view: 'jam', groove: slug })}`,
    type: 'website',
    data: { '@context': 'https://schema.org', '@type': 'MusicComposition', name: meta.title, url: address, genre: meta.genre, ...meta.about && { description: meta.about }, isAccessibleForFree: true, isPartOf: { '@type': 'WebApplication', name: 'TabTrainer', url: site } },
    link: `Jam over ${meta.title} in TabTrainer`,
  }, site);
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
