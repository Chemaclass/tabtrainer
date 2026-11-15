import { MIXER_PARTS, type Mixer, type MixerPart } from '../../app/jam';
import { mixSummary } from '../../app/jamSummary';
import { isFamily, type Family } from '../../core/instruments';
import type { LoopEngine } from '../../audio/loopEngine';
import { byId, fillRange, textSpan } from '../dom';

const PART_NAMES: Record<MixerPart, string> = { drums: 'Drums', bass: 'Bass', keys: 'Keys' };

interface MixerRow { part: MixerPart; element: HTMLDivElement; mute: HTMLButtonElement; volume: HTMLInputElement }

function volumeSlider(part: MixerPart): HTMLInputElement {
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '1';
  volume.setAttribute('aria-label', `${PART_NAMES[part]} volume`);
  return volume;
}

function muteButton(part: MixerPart): HTMLButtonElement {
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'toggle jam-mute';
  mute.append('Mute', textSpan('sr-only', ` ${PART_NAMES[part].toLowerCase()}`));
  return mute;
}

export function mixerView(mixer: Mixer, engine: Pick<LoopEngine, 'setPartGain' | 'setRoom'>, choosePlays: (family: Family) => void) {
  const plays = [...document.querySelectorAll<HTMLInputElement>('input[name="jamPlays"]')];
  const room = byId('jamRoom', HTMLButtonElement);
  const summary = byId('jamMixSummary');
  const rows = MIXER_PARTS.map(row);
  byId('jamMixer').replaceChildren(...rows.map(r => r.element));

  room.onclick = () => {
    mixer.setRoom(!mixer.room);
    engine.setRoom(mixer.room);
    show();
  };
  engine.setRoom(mixer.room);
  for (const input of plays) {
    input.onchange = () => {
      if (input.checked && isFamily(input.value)) choosePlays(input.value);
    };
  }

  function row(part: MixerPart): MixerRow {
    const element = document.createElement('div');
    const volume = volumeSlider(part);
    const mute = muteButton(part);
    element.className = 'jam-mixer-row';
    mute.onclick = () => {
      mixer.setMuted(part, !mixer.level(part).muted);
      show();
    };
    volume.oninput = () => {
      mixer.setVolume(part, +volume.value);
      show();
    };
    element.append(textSpan('jam-mixer-part', PART_NAMES[part]), volume, mute);
    return { part, element, mute, volume };
  }

  function show() {
    for (const input of plays) input.checked = input.value === mixer.plays;
    room.setAttribute('aria-pressed', String(mixer.room));
    summary.textContent = mixSummary(mixer);
    for (const { part, element, mute, volume } of rows) {
      const { volume: level, muted } = mixer.level(part);
      mute.setAttribute('aria-pressed', String(muted));
      element.classList.toggle('muted', muted);
      volume.value = String(level);
      fillRange(volume);
      volume.setAttribute('aria-valuetext', muted ? `${level}%, muted` : `${level}%`);
      engine.setPartGain(part, mixer.gain(part));
    }
  }

  show();
  return { show };
}
