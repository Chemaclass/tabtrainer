import { pref, setPref } from '../../app/storage';
import { byId, one } from '../dom';

export function playerPanel(redraw: () => void) {
  const expand = (open: boolean) => { one('.player').classList.toggle('open', open); byId('moreBtn').setAttribute('aria-expanded', String(open)); setPref('playerExpanded', open); };
  expand(pref('playerExpanded', false));
  byId('moreBtn').onclick = () => expand(byId('moreBtn').getAttribute('aria-expanded') !== 'true');
  const minimize = (minimized: boolean) => {
    document.documentElement.classList.toggle('player-min', minimized);
    const label = minimized ? 'Show the controls' : 'Hide the controls', button = byId('minimizeBtn');
    button.setAttribute('aria-expanded', String(!minimized)); button.setAttribute('aria-label', label); button.title = label;
    setPref('playerMinimized', minimized);
  };
  minimize(pref('playerMinimized', false));
  byId('minimizeBtn').onclick = () => { minimize(!document.documentElement.classList.contains('player-min')); redraw(); };
}
