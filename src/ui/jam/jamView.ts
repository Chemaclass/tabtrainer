import { JAM_SWING, type Jam } from '../../app/jam';
import { PROGRESSION_CHOICES, SUMMARY_SEPARATOR, grooveContext, grooveSummary, progressionName } from '../../app/jamSummary';
import { playbackShortcut } from '../../app/playbackShortcut';
import { pref, setPref } from '../../app/storage';
import type { LoopEngine } from '../../audio/loopEngine';
import type { GrooveBar } from '../../core/grooveTimeline';
import { byId, fillRange, textSpan } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { groovePicker } from './groovePicker';

interface JamViewHandlers {
  active: () => boolean;
  choose: (slug: string) => void;
  changed: () => void;
  chordsChanged: (bars: readonly GrooveBar[]) => void;
  shareLink: () => string;
}

const COUNT_IN_BAR = 'bar';
const COUNT_IN_OFF = 'off';

interface SwingTexts { shown: string; spoken: string }

function swingTexts(swing: number): SwingTexts {
  if (swing === JAM_SWING.min) return { shown: 'Straight', spoken: 'Straight' };
  if (swing === JAM_SWING.max) return { shown: 'Triplet', spoken: 'Triplet' };
  return { shown: `${swing}%`, spoken: `${swing}% swing` };
}

function barItem({ bar, chord }: GrooveBar): HTMLLIElement {
  const item = document.createElement('li');
  const number = document.createElement('span');
  const name = document.createElement('span');
  number.className = 'jam-bar-no';
  number.append(textSpan('sr-only', 'Bar '), String(bar + 1), textSpan('sr-only', ': '));
  name.className = 'jam-chord';
  name.textContent = chord.name;
  item.append(number, name);
  return item;
}

function enableSectionToggles() {
  for (const toggle of document.querySelectorAll<HTMLButtonElement>('.jam-section-toggle')) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
    });
  }
}

export function jamView(jam: Jam, engine: LoopEngine, { active, choose, changed, chordsChanged, shareLink }: JamViewHandlers) {
  const play = byId('jamPlay', HTMLButtonElement);
  const playLabel = byId('jamPlayLabel');
  const bpm = byId('jamBpm');
  const tempo = byId('jamTempo', HTMLInputElement);
  const tempoOut = byId('jamTempoOut', HTMLOutputElement);
  const key = byId('jamKey', HTMLSelectElement);
  const progression = byId('jamProgression', HTMLSelectElement);
  const swing = byId('jamSwing', HTMLInputElement);
  const swingOut = byId('jamSwingOut', HTMLOutputElement);
  const countIn = byId('jamCountIn', HTMLSelectElement);
  const bars = byId('jamBars', HTMLOListElement);
  const share = byId('jamShare', HTMLButtonElement);
  const shareStatus = byId('jamShareStatus');
  const summary = byId('jamGrooveSummary');
  const title = byId('jamTitleText');
  const context = byId('jamContext');
  const about = byId('jamAbout');
  const picker = groovePicker(jam, choose);
  let playing: boolean | null = null;
  let current: number | null = null;

  play.onclick = toggle;
  tempo.oninput = changeTempo;
  tempo.onchange = changed;
  key.onchange = changeKey;
  progression.onchange = changeProgression;
  swing.oninput = changeSwing;
  swing.onchange = changed;
  countIn.onchange = changeCountIn;
  share.onclick = copyShareLink;
  swing.min = String(JAM_SWING.min);
  swing.max = String(JAM_SWING.max);
  progression.replaceChildren(...PROGRESSION_CHOICES.map(slug => new Option(progressionName(slug), slug)));
  setSelectValue(countIn, pref('jamCountIn', false) ? COUNT_IN_BAR : COUNT_IN_OFF);
  engine.setCountIn(countIn.value === COUNT_IN_BAR);
  engine.on(state => {
    showPlaying(state.playing);
    highlight(state.playing ? state.bar : null);
  });
  enableSectionToggles();
  listenForSpace();

  function start() {
    engine.setClickVolume(pref('clickVolume', 50) / 100);
    engine.play();
  }

  function toggle() {
    if (engine.playing) engine.stop();
    else start();
  }

  function listenForSpace() {
    const shortcut = playbackShortcut(active, () => engine.playing, start, () => engine.stop());
    document.addEventListener('keydown', shortcut.keydown, true);
    document.addEventListener('keyup', shortcut.keyup, true);
    window.addEventListener('blur', shortcut.blur);
  }

  function changeTempo() {
    if (jam.setTempo(+tempo.value)) engine.setTempo(jam.tempo);
    showTempo();
    showSummary();
  }

  function changeKey() {
    if (!jam.setKey(key.value)) return;
    showChords();
    changed();
  }

  function changeProgression() {
    if (!jam.setProgression(progression.value)) return;
    showKeys();
    showChords();
    changed();
  }

  function changeSwing() {
    if (jam.setSwing(+swing.value)) engine.setTimeline(jam.timeline());
    showSwing();
  }

  function changeCountIn() {
    const enabled = countIn.value === COUNT_IN_BAR;
    engine.setCountIn(enabled);
    setPref('jamCountIn', enabled);
  }

  async function copyShareLink() {
    const url = shareLink();
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = `Link copied: ${url}`;
    } catch {
      shareStatus.textContent = `Could not copy the link: ${url}`;
    }
  }

  function showSummary() {
    summary.textContent = grooveSummary(jam.setup);
  }

  function showTempo() {
    tempo.value = String(jam.tempo);
    fillRange(tempo);
    tempoOut.textContent = `${jam.tempo} bpm`;
    tempo.setAttribute('aria-valuetext', `${jam.tempo} beats per minute`);
    bpm.textContent = String(jam.tempo);
  }

  function showSwing() {
    swing.value = String(jam.swing);
    fillRange(swing);
    const texts = swingTexts(jam.swing);
    swingOut.textContent = texts.shown;
    swing.setAttribute('aria-valuetext', texts.spoken);
  }

  function showKeys() {
    key.replaceChildren(...jam.keys.map(name => new Option(name, name)));
    setSelectValue(key, jam.key);
  }

  function showPlaying(now: boolean) {
    if (now === playing) return;
    playing = now;
    playLabel.textContent = now ? 'Stop' : 'Play';
    play.classList.toggle('on', now);
  }

  function highlight(bar: number | null) {
    if (bar === current) return;
    bars.children[current ?? -1]?.removeAttribute('aria-current');
    current = bar;
    bars.children[bar ?? -1]?.setAttribute('aria-current', 'true');
  }

  function showBars(timelineBars: readonly GrooveBar[]) {
    chordsChanged(timelineBars);
    bars.replaceChildren(...timelineBars.map(barItem));
    bars.children[current ?? -1]?.setAttribute('aria-current', 'true');
  }

  function showContext(barCount: number) {
    const key = textSpan('jam-context-key', jam.key);
    context.replaceChildren(grooveContext(jam.groove.genre, barCount), SUMMARY_SEPARATOR, key);
  }

  function showChords() {
    const timeline = jam.timeline();
    engine.setTimeline(timeline);
    showBars(timeline.bars);
    showContext(timeline.bars.length);
    showSummary();
  }

  function showGroove() {
    const { groove } = jam;
    title.textContent = groove.title;
    about.textContent = groove.about ?? '';
    about.hidden = !groove.about;
  }

  function show() {
    showGroove();
    setSelectValue(progression, jam.progression);
    showKeys();
    showTempo();
    showSwing();
    showChords();
    picker.show();
    shareStatus.textContent = '';
    engine.setTempo(jam.tempo);
  }

  show();
  showPlaying(false);
  return {
    show,
    stop() { if (engine.playing) engine.stop(); },
  };
}
