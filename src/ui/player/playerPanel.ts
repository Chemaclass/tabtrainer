import { pref, setPref } from '../../app/storage';
import { byId, one } from '../dom';

export function playerPanel(redraw: () => void) {
  const player = one('.player'), more = byId('moreBtn'), sheet = byId('extras');
  const phone = matchMedia('(max-width: 599px)');
  const isOpen = () => more.getAttribute('aria-expanded') === 'true';
  const expand = (open: boolean) => {
    player.classList.toggle('open', open); more.setAttribute('aria-expanded', String(open));
    if (!phone.matches) setPref('playerExpanded', open);
  };
  if (!phone.matches) expand(pref('playerExpanded', false));
  more.onclick = () => expand(!isOpen());
  document.addEventListener('click', event => {
    const target = event.target as Node;
    if (phone.matches && isOpen() && target.isConnected && !sheet.contains(target) && !more.contains(target)) expand(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !phone.matches || !isOpen() || document.querySelector('dialog[open]')) return;
    expand(false);
    if (sheet.contains(document.activeElement)) more.focus();
  });
  const minimize = (minimized: boolean) => {
    document.documentElement.classList.toggle('player-min', minimized);
    const label = minimized ? 'Show the controls' : 'Hide the controls', button = byId('minimizeBtn');
    button.setAttribute('aria-expanded', String(!minimized)); button.setAttribute('aria-label', label); button.title = label;
    setPref('playerMinimized', minimized);
  };
  minimize(pref('playerMinimized', false));
  byId('minimizeBtn').onclick = () => { minimize(!document.documentElement.classList.contains('player-min')); redraw(); };
}
