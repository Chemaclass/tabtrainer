import { pref, setPref } from '../../app/storage';
import type { Player } from '../../audio/player';
import { byId, fillRange } from '../dom';

export function speedControls(player: Player) {
  const speed = byId('speed', HTMLInputElement);
  const show = () => {
    speed.value = String(Math.round(player.speed * 100));
    const bpm = Math.round(player.tempo * player.speed), q = document.createElement('span'); q.textContent = `  ♩${bpm}`;
    byId('speedOut').replaceChildren(speed.value + '%', q); fillRange(speed);
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.speed === speed.value)));
  };
  speed.value = String(pref('speed', 100)); player.speed = +speed.value / 100;
  speed.oninput = () => { const value = +speed.value; player.setSpeed(value / 100); setPref('speed', value); show(); };
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => { b.onclick = () => { speed.value = b.dataset.speed!; speed.dispatchEvent(new Event('input')); }; });
  return { show };
}
