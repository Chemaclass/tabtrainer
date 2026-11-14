import { MIXER_PARTS, type Mixer, type MixerPart } from '../../app/jam';
import { isFamily } from '../../core/instruments';
import type { LoopEngine } from '../../audio/loopEngine';
import { byId, fillRange } from '../dom';

const PART_NAMES: Record<MixerPart, string> = { drums: 'Drums', bass: 'Bass', keys: 'Keys' };

export function mixerView(mixer: Mixer, engine: Pick<LoopEngine, 'setPartGain'>) {
  const plays = [...document.querySelectorAll<HTMLInputElement>('input[name="jamPlays"]')];
  const rows = MIXER_PARTS.map(part => row(part));
  byId('jamMixer').replaceChildren(...rows.map(r => r.element));

  for (const input of plays) input.onchange = () => { if (input.checked && isFamily(input.value) && mixer.setPlays(input.value)) show(); };

  function row(part: MixerPart) {
    const element = document.createElement('div'), name = document.createElement('span');
    const mute = document.createElement('button'), volume = document.createElement('input'), out = document.createElement('output');
    element.className = 'jam-mixer-row';
    name.className = 'jam-mixer-part'; name.textContent = PART_NAMES[part];
    mute.type = 'button'; mute.className = 'toggle jam-mute';
    mute.append('Mute');
    const hidden = document.createElement('span'); hidden.className = 'sr-only'; hidden.textContent = ` ${PART_NAMES[part].toLowerCase()}`;
    mute.append(hidden);
    volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.step = '1';
    volume.setAttribute('aria-label', `${PART_NAMES[part]} volume`);
    out.className = 'jam-mixer-out';
    mute.onclick = () => { mixer.setMuted(part, !mixer.level(part).muted); show(); };
    volume.oninput = () => { mixer.setVolume(part, +volume.value); show(); };
    element.append(name, mute, volume, out);
    return { part, element, mute, volume, out };
  }

  function show() {
    for (const input of plays) input.checked = input.value === mixer.plays;
    for (const { part, element, mute, volume, out } of rows) {
      const { volume: level, muted } = mixer.level(part);
      mute.setAttribute('aria-pressed', String(muted));
      element.classList.toggle('muted', muted);
      volume.value = String(level); fillRange(volume);
      volume.setAttribute('aria-valuetext', muted ? `${level}%, muted` : `${level}%`);
      out.textContent = `${level}%`;
      engine.setPartGain(part, mixer.gain(part));
    }
  }

  show();
  return { show };
}
