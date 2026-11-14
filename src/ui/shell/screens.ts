import { isFamily, type Family } from '../../core/instruments';
import type { Song } from '../../core/model';
import { songAddress } from '../../app/songLink';
import type { Screen } from '../../app/workspace';
import { byId, one } from '../dom';
import { setSelectValue } from './dropdown';

export function screens(onFamily: (family: Family) => void) {
  const siteTitle = document.title, canonical = one('link[rel=canonical]', HTMLLinkElement), site = canonical.href, familySelect = byId('familySelect', HTMLSelectElement);
  familySelect.onchange = () => { if (isFamily(familySelect.value)) onFamily(familySelect.value); };
  return {
    showFamily(family: Family) { setSelectValue(familySelect, family); },
    show(screen: Screen) {
      document.body.classList.toggle('library-view', screen === 'library');
      byId('libraryScreen').hidden = screen !== 'library'; byId('practiceScreen').hidden = screen !== 'practice';
      one('.player').hidden = screen !== 'practice';
    },
    showTitle(song: Song | null, bundledPath: string | null) {
      document.title = song ? `${song.meta.title} · TabTrainer` : siteTitle;
      canonical.href = bundledPath ? songAddress(site, bundledPath) : site;
    },
    focus(screen: Screen) { window.scrollTo(0, 0); byId(screen === 'library' ? 'libraryTitle' : 'title').focus({ preventScroll: true }); },
  };
}
