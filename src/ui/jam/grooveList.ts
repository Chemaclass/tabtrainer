import type { Jam } from '../../app/jam';
import { byId } from '../dom';

export function grooveList(jam: Jam, choose: (slug: string) => void) {
  const list = byId('jamGrooves', HTMLUListElement);
  const links = jam.list.map(({ slug, groove }) => {
    const item = document.createElement('li'), link = document.createElement('a');
    const genre = document.createElement('span'), title = document.createElement('span'), tempo = document.createElement('span');
    link.className = 'jam-groove';
    link.href = `?${new URLSearchParams({ view: 'jam', groove: slug })}`;
    genre.className = 'jam-groove-genre'; genre.textContent = groove.genre;
    title.className = 'jam-groove-title'; title.textContent = groove.title;
    tempo.className = 'jam-groove-tempo'; tempo.textContent = `${groove.tempo} bpm`;
    link.append(genre, title, tempo);
    link.onclick = event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      choose(slug);
    };
    item.append(link);
    return { slug, item, link };
  });
  list.replaceChildren(...links.map(l => l.item));

  function show() {
    for (const { slug, link } of links) {
      if (slug === jam.slug) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  show();
  return { show };
}
