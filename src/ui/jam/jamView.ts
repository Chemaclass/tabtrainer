import { JAM_SWING, type Jam } from '../../app/jam';
import { playbackShortcut } from '../../app/playbackShortcut';
import type { LoopEngine } from '../../audio/loopEngine';
import { OWN_PROGRESSION, PROGRESSION_PRESETS } from '../../core/harmony';
import { byId, fillRange } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { grooveList } from './grooveList';

export function jamView(jam: Jam, engine: LoopEngine, active: () => boolean, choose: (slug: string) => void) {
  const play = byId('jamPlay', HTMLButtonElement), tempo = byId('jamTempo', HTMLInputElement), tempoOut = byId('jamTempoOut', HTMLOutputElement);
  const key = byId('jamKey', HTMLSelectElement), bars = byId('jamBars', HTMLOListElement), progression = byId('jamProgression', HTMLSelectElement);
  const swing = byId('jamSwing', HTMLInputElement), swingOut = byId('jamSwingOut', HTMLOutputElement);
  const grooves = grooveList(jam, choose);
  let playing: boolean | null = null, current: number | null = null;

  const toggle = () => { if (engine.playing) engine.stop(); else engine.play(); };
  play.onclick = toggle;
  tempo.oninput = () => { if (jam.setTempo(+tempo.value)) engine.setTempo(jam.tempo); showTempo(); };
  key.onchange = () => { if (jam.setKey(key.value)) { engine.setTimeline(jam.timeline()); showBars(); } };
  progression.onchange = () => { if (jam.setProgression(progression.value)) { showKeys(); engine.setTimeline(jam.timeline()); showBars(); } };
  swing.oninput = () => { if (jam.setSwing(+swing.value)) engine.setTimeline(jam.timeline()); showSwing(); };
  swing.min = String(JAM_SWING.min); swing.max = String(JAM_SWING.max);
  progression.replaceChildren(new Option("Groove's own", OWN_PROGRESSION), ...PROGRESSION_PRESETS.map(p => new Option(p.name, p.slug)));
  engine.on(state => { showPlaying(state.playing); highlight(state.playing ? state.bar : null); });

  const shortcut = playbackShortcut(active, () => engine.playing, () => engine.play(), () => engine.stop());
  document.addEventListener('keydown', shortcut.keydown, true);
  document.addEventListener('keyup', shortcut.keyup, true);
  window.addEventListener('blur', shortcut.blur);

  function showTempo() {
    tempo.value = String(jam.tempo); fillRange(tempo);
    tempoOut.textContent = `${jam.tempo} bpm`;
    tempo.setAttribute('aria-valuetext', `${jam.tempo} beats per minute`);
  }
  function showSwing() {
    swing.value = String(jam.swing); fillRange(swing);
    const text = jam.swing === JAM_SWING.min ? 'Straight' : jam.swing === JAM_SWING.max ? 'Triplet' : `${jam.swing}%`;
    swingOut.textContent = text;
    swing.setAttribute('aria-valuetext', text === 'Straight' || text === 'Triplet' ? text : `${jam.swing}% swing`);
  }
  function showKeys() {
    key.replaceChildren(...jam.keys.map(name => new Option(name, name)));
    setSelectValue(key, jam.key);
  }
  function showPlaying(now: boolean) {
    if (now === playing) return;
    playing = now;
    play.textContent = now ? 'Stop' : 'Play';
    play.classList.toggle('on', now);
  }
  function highlight(bar: number | null) {
    if (bar === current) return;
    bars.children[current ?? -1]?.removeAttribute('aria-current');
    current = bar;
    bars.children[bar ?? -1]?.setAttribute('aria-current', 'true');
  }
  function showBars() {
    bars.replaceChildren(...jam.timeline().bars.map(({ bar, chord }) => {
      const item = document.createElement('li'), number = document.createElement('span'), name = document.createElement('span');
      const hidden = (text: string) => { const span = document.createElement('span'); span.className = 'sr-only'; span.textContent = text; return span; };
      number.className = 'jam-bar-no'; number.append(hidden('Bar '), String(bar + 1), hidden(': '));
      name.className = 'jam-chord'; name.textContent = chord.name;
      item.append(number, name);
      if (bar === current) item.setAttribute('aria-current', 'true');
      return item;
    }));
  }
  function show() {
    const { groove } = jam;
    byId('jamTitle').textContent = groove.title;
    byId('jamContext').textContent = groove.genre ? `Jam / ${groove.genre}` : 'Jam';
    const about = byId('jamAbout'); about.textContent = groove.about ?? ''; about.hidden = !groove.about;
    setSelectValue(progression, jam.progression);
    showKeys(); showTempo(); showSwing(); showBars(); grooves.show();
    engine.setTempo(jam.tempo); engine.setTimeline(jam.timeline());
  }

  show(); showPlaying(false);
  return {
    show,
    stop() { if (engine.playing) engine.stop(); },
  };
}
