import { playbackShortcut } from '../../app/playbackShortcut';
import type { Player } from '../../audio/player';

export function playShortcut(player: Player, active: () => boolean) {
  const shortcut = playbackShortcut(active, () => player.playing, () => player.play(), () => player.pause());
  document.addEventListener('keydown', shortcut.keydown, true);
  document.addEventListener('keyup', shortcut.keyup, true);
  window.addEventListener('blur', shortcut.blur);
}
