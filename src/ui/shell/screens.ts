import { isFamily, type Family } from '../../core/instruments';
import type { Screen } from '../../app/workspace';
import { byId, one } from '../dom';

export function screens(onFamily: (family: Family) => void, onJam: () => void) {
  const canonical = one('link[rel=canonical]', HTMLLinkElement);
  const familyButtons = [...byId('familySwitch').querySelectorAll<HTMLButtonElement>('[data-family]')];
  familyButtons.forEach(button => { const family = button.dataset.family ?? ''; button.onclick = () => { if (isFamily(family)) onFamily(family); }; });
  const jamNav = byId('jamNavBtn', HTMLButtonElement);
  jamNav.onclick = onJam;
  return {
    showFamily(family: Family) { familyButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === family))); },
    show(screen: Screen) {
      document.body.classList.toggle('library-view', screen !== 'practice');
      document.body.classList.toggle('jam-view', screen === 'jam');
      byId('libraryScreen').hidden = screen !== 'library'; byId('practiceScreen').hidden = screen !== 'practice'; byId('jamScreen').hidden = screen !== 'jam';
      if (screen === 'jam') jamNav.setAttribute('aria-current', 'page'); else jamNav.removeAttribute('aria-current');
      one('.player').hidden = screen !== 'practice';
    },
    showTitle(title: string, address: string) {
      document.title = title;
      canonical.href = address;
    },
    focus(screen: Screen) { window.scrollTo(0, 0); byId({ library: 'libraryTitle', practice: 'title', jam: 'jamTitle' }[screen]).focus({ preventScroll: true }); },
  };
}
