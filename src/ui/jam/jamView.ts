import type { Jam } from '../../app/jam';
import { playbackShortcut } from '../../app/playbackShortcut';
import type { LoopEngine } from '../../audio/loopEngine';
import { byId, fillRange } from '../dom';
import { setSelectValue } from '../shell/dropdown';

export function jamView(jam: Jam, engine: LoopEngine, active: () => boolean) {
  const play = byId('jamPlay', HTMLButtonElement), tempo = byId('jamTempo', HTMLInputElement), tempoOut = byId('jamTempoOut', HTMLOutputElement);
  const key = byId('jamKey', HTMLSelectElement), bars = byId('jamBars', HTMLOListElement);
  let playing: boolean | null = null, current: number | null = null;

  const toggle = () => { if (engine.playing) engine.stop(); else engine.play(); };
  play.onclick = toggle;
  tempo.oninput = () => { if (jam.setTempo(+tempo.value)) engine.setTempo(jam.tempo); showTempo(); };
  key.onchange = () => { if (jam.setKey(key.value)) { engine.setTimeline(jam.timeline()); showBars(); } };
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
    key.replaceChildren(...jam.keys.map(name => new Option(name, name)));
    setSelectValue(key, jam.key);
    showTempo(); showBars();
    engine.setTempo(jam.tempo); engine.setTimeline(jam.timeline());
  }

  show(); showPlaying(false);
  return {
    show,
    stop() { if (engine.playing) engine.stop(); },
  };
}
