import { pref, setPref } from '../../app/storage';
import type { Player } from '../../audio/player';
import { byId, fillRange } from '../dom';
import { setSelectValue } from '../shell/dropdown';

export function timingPanel(player: Player) {
  const metronome = byId('metronomeChk', HTMLInputElement);
  const countIn = byId('countInSelect', HTMLSelectElement);
  const clickVolume = byId('clickVolume', HTMLInputElement);
  metronome.checked = pref('metronome', false); player.setMetronome(metronome.checked);
  setSelectValue(countIn, pref('countIn', false) ? 'bar' : 'off'); player.setCountIn(countIn.value === 'bar');
  clickVolume.value = String(pref('clickVolume', 50)); player.setClickVolume(+clickVolume.value / 100);
  const showClickVolume = () => { byId('clickVolumeOut').textContent = `${clickVolume.value}%`; fillRange(clickVolume); };
  showClickVolume();
  metronome.onchange = () => { player.setMetronome(metronome.checked); setPref('metronome', metronome.checked); };
  countIn.onchange = () => { const enabled = countIn.value === 'bar'; player.setCountIn(enabled); setPref('countIn', enabled); };
  clickVolume.oninput = () => { player.setClickVolume(+clickVolume.value / 100); setPref('clickVolume', +clickVolume.value); showClickVolume(); };
}
