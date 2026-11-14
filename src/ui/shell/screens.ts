import { isFamily, type Family } from '../../core/instruments';
import type { Song } from '../../core/model';
import { songAddress } from '../../app/songLink';
import type { Screen } from '../../app/workspace';
import { byId, one } from '../dom';
import { setSelectValue } from './dropdown';

export function screens(onFamily: (family: Family) => void, onJam: () => void) {
  const siteTitle = document.title, canonical = one('link[rel=canonical]', HTMLLinkElement), site = canonical.href, familySelect = byId('familySelect', HTMLSelectElement);
  familySelect.onchange = () => { if (isFamily(familySelect.value)) onFamily(familySelect.value); };
  const jamNav = byId('jamNavBtn', HTMLButtonElement);
  jamNav.onclick = onJam;
  return {
    showFamily(family: Family) { setSelectValue(familySelect, family); },
    show(screen: Screen) {
      document.body.classList.toggle('library-view', screen !== 'practice');
      byId('libraryScreen').hidden = screen !== 'library'; byId('practiceScreen').hidden = screen !== 'practice'; byId('jamScreen').hidden = screen !== 'jam';
      if (screen === 'jam') jamNav.setAttribute('aria-current', 'page'); else jamNav.removeAttribute('aria-current');
      one('.player').hidden = screen !== 'practice';
    },
    showTitle(song: Song | null, bundledPath: string | null, jamTitle: string | null = null) {
      document.title = song ? `${song.meta.title} · TabTrainer` : jamTitle ? `${jamTitle} · Jam · TabTrainer` : siteTitle;
      canonical.href = bundledPath ? songAddress(site, bundledPath) : site;
    },
    focus(screen: Screen) { window.scrollTo(0, 0); byId({ library: 'libraryTitle', practice: 'title', jam: 'jamTitle' }[screen]).focus({ preventScroll: true }); },
  };
}
