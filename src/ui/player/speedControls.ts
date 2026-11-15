import { pref, setPref } from '../../app/storage';
import type { Player } from '../../audio/player';
import { byId, fillRange } from '../dom';

export function speedControls(player: Player) {
  const speed = byId('speed', HTMLInputElement), track = byId('speedTrack'), slower = byId('speedDown', HTMLButtonElement), faster = byId('speedUp', HTMLButtonElement);
  track.style.setProperty('--unity', `${((100 - +speed.min) / (+speed.max - +speed.min)) * 100}%`);
  const show = () => {
    speed.value = String(Math.round(player.speed * 100));
    const bpm = Math.round(player.currentTempo * player.speed), q = document.createElement('span'); q.textContent = `  ♩${bpm}`;
    byId('speedOut').replaceChildren(speed.value + '%', q); fillRange(speed);
    track.style.setProperty('--fill', speed.style.getPropertyValue('--fill'));
    slower.disabled = +speed.value <= +speed.min; faster.disabled = +speed.value >= +speed.max;
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.speed === speed.value)));
  };
  speed.value = String(pref('speed', 100)); player.speed = +speed.value / 100;
  speed.oninput = () => { const value = +speed.value; player.setSpeed(value / 100); setPref('speed', value); show(); };
  const set = (percent: number) => { speed.value = String(percent); speed.dispatchEvent(new Event('input')); };
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => { b.onclick = () => set(+b.dataset.speed!); });
  let lastTempo = player.currentTempo;
  player.on(() => { const tempo = player.currentTempo; if (tempo !== lastTempo) { lastTempo = tempo; show(); } });
  return { show, set, nudge: (by: number) => set(+speed.value + by) };
}
