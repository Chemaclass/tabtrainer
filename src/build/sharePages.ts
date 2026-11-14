import { parseSong } from '../core/parser';
import { songSlug } from '../ui/songLink';

export interface SongMeta { title: string; about: string; family: string }

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function songMeta(path: string, text: string): SongMeta {
  const { meta } = parseSong(text).song;
  return { title: meta.title, about: meta.about ?? '', family: songSlug(path).split('/')[0] };
}

export const appUrl = (site: string, path: string) => `${site}?${new URLSearchParams({ song: songSlug(path) })}`;

export function sharePage(site: string, path: string, meta: SongMeta): string {
  const title = escapeHtml(`${meta.title}, ${meta.family} tab and notation · TabTrainer`);
  const description = escapeHtml(meta.about || `Practise ${meta.title} on ${meta.family}: slow it down, loop the hard bars, and follow each note as it plays.`);
  const target = appUrl(site, path), local = `../../?${new URLSearchParams({ song: songSlug(path) })}`, url = `${site}${songSlug(path)}/`, image = `${site}og.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${escapeHtml(target)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TabTrainer" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="TabTrainer: notation and tab for bass and guitar" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(local)}" />
  <script>location.replace(${JSON.stringify(local)} + location.search.replace(/^\\?/, '&') + location.hash);</script>
</head>
<body><a href="${escapeHtml(local)}">Open ${escapeHtml(meta.title)} in TabTrainer</a></body>
</html>
`;
}

export function sitemap(site: string, paths: string[]): string {
  const urls = [site, ...paths.map(path => appUrl(site, path))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`;
}
