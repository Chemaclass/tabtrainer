import { JAM_SWING, type Jam } from '../../app/jam';
import { chordsChoice, keyLabel, moodBars, type MoodBar } from '../../app/jamMood';
import { progressionChoices, progressionName } from '../../app/jamSummary';
import { playbackShortcut } from '../../app/playbackShortcut';
import { pref, setPref } from '../../app/storage';
import type { LoopEngine } from '../../audio/loopEngine';
import type { GrooveBar } from '../../core/grooveTimeline';
import type { MoodId } from '../../core/moods';
import { byId, fillRange, textSpan } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { popup } from '../shell/popup';
import { groovePicker } from './groovePicker';
import { moodStageView } from './moodStage';

interface JamViewHandlers {
  active: () => boolean;
  choose: (slug: string) => void;
  changed: () => void;
  chordsChanged: (bars: readonly GrooveBar[]) => void;
  shareLink: () => string;
  moodPicked: (id: MoodId | null) => void;
}

const COUNT_IN_BAR = 'bar';
const COUNT_IN_OFF = 'off';
const SHARE_HINT = 'Key, tempo, chords and swing';
const MOOD_SHARE_HINT = 'Mood, key, tempo and chords';
const NO_SHARE_HINT = 'Links open bundled grooves as written. Download a file to share your own.';

interface SwingTexts { shown: string; spoken: string }

function swingTexts(swing: number): SwingTexts {
  if (swing === JAM_SWING.min) return { shown: 'Straight', spoken: 'Straight' };
  if (swing === JAM_SWING.max) return { shown: 'Triplet', spoken: 'Triplet' };
  return { shown: `${swing}%`, spoken: `${swing}% swing` };
}

function barItem({ bar, chord }: GrooveBar, moodBar: MoodBar | undefined): HTMLLIElement {
  const item = document.createElement('li');
  const number = document.createElement('span');
  const name = document.createElement('span');
  number.className = 'jam-bar-no';
  number.append(textSpan('sr-only', 'Bar '), textSpan('jam-bar-index', String(bar + 1)), textSpan('sr-only', ': '));
  name.className = 'jam-chord';
  name.textContent = chord.name;
  item.append(number, name);
  if (!moodBar) return item;
  number.append(textSpan('jam-bar-numeral', moodBar.numeral), textSpan('sr-only', ', '));
  // The job shows once, on the now line under the bars, for the bar that plays
  if (moodBar.job) item.append(textSpan('sr-only', `. ${moodBar.job}`));
  return item;
}

export function jamView(jam: Jam, engine: LoopEngine, { active, choose, changed, chordsChanged, shareLink, moodPicked }: JamViewHandlers) {
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
  const shareHint = byId('jamShareHint');
  const title = byId('jamTitleText');
  const tempoButton = byId('jamTempoButton', HTMLButtonElement);
  const tempoPanel = byId('jamTempoPanel');
  const more = byId('jamMore', HTMLButtonElement);
  const drawer = byId('jamDrawer');
  const picker = groovePicker(jam, choose);
  const moods = moodStageView(jam, { pick: moodPicked });
  popup(tempoButton, tempoPanel, { focus: () => tempo });
  const drawerPopup = popup(more, drawer, { keepOpenFor: [play, tempoButton, tempoPanel] });
  byId('jamDrawerClose').onclick = () => drawerPopup.close(true);
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
  setSelectValue(countIn, pref('jamCountIn', false) ? COUNT_IN_BAR : COUNT_IN_OFF);
  engine.setCountIn(countIn.value === COUNT_IN_BAR);
  engine.on(state => {
    showPlaying(state.playing);
    highlight(state.playing ? state.bar : null);
  });
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
    moods.show();
  }

  function changeKey() {
    if (!jam.setKey(key.value)) return;
    showChords();
    moods.show();
    changed();
  }

  function changeProgression() {
    if (!jam.setProgression(progression.value)) return;
    showHarmony();
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
    // A groove's key names only its home note, so with Free "E" stays "E" rather than reading as E major over a minor scale
    const label = jam.mood ? keyLabel : (name: string) => name;
    key.replaceChildren(...jam.keys.map(name => new Option(label(name), name)));
    setSelectValue(key, jam.key);
  }

  function showProgressions() {
    const { mood } = jam;
    const options = progressionChoices(mood, jam.progression).map(slug => new Option(progressionName(slug, mood), slug));
    const chosen = options.find(option => option.value === jam.progression);
    const { short, count } = chordsChoice(jam);
    if (chosen) {
      chosen.dataset.short = short;
      if (count) chosen.dataset.note = count;
    }
    progression.replaceChildren(...options);
    setSelectValue(progression, jam.progression);
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
    const moodBarList = moodBars(jam);
    bars.dataset.count = String(timelineBars.length);
    bars.replaceChildren(...timelineBars.map((bar, index) => barItem(bar, moodBarList?.[index])));
    bars.children[current ?? -1]?.setAttribute('aria-current', 'true');
  }

  function showChords() {
    const timeline = jam.timeline();
    engine.setTimeline(timeline);
    showBars(timeline.bars);
  }

  function showShare() {
    const shareable = !jam.entry.mine && !jam.previewing;
    share.hidden = !shareable;
    const hint = jam.mood ? MOOD_SHARE_HINT : SHARE_HINT;
    shareHint.textContent = shareable ? hint : NO_SHARE_HINT;
  }

  function showGroove() {
    title.textContent = jam.groove.title;
  }

  /** Redraws what follows the chords: the mood can clear, and the key list can switch mode. */
  function showHarmony() {
    showProgressions();
    showKeys();
    showChords();
    moods.show();
    picker.show();
    showShare();
  }

  function show() {
    showGroove();
    showProgressions();
    showKeys();
    showTempo();
    showSwing();
    showChords();
    picker.show();
    moods.show();
    showShare();
    shareStatus.textContent = '';
    engine.setTempo(jam.tempo);
  }

  show();
  showPlaying(false);
  return {
    show,
    showGrooveList: picker.fill,
    stop() { if (engine.playing) engine.stop(); },
  };
}
