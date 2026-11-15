import { playbackShortcut } from '../../app/playbackShortcut';
import { barAfter, practiceKey, type PracticeAction } from '../../app/practiceKeys';
import type { Passage } from '../../app/passage';
import type { Player } from '../../audio/player';

interface PracticeControls {
  active: () => boolean;
  passage: Passage;
  passages: { apply(): void; selectBar(bar: number): void };
  restart: () => void;
  speed: { set(percent: number): void; nudge(by: number): void };
  scrolling: { continuous(): boolean; toggleContinuous(): void; nudgeRate(by: number): void };
  toggleMetronome: () => void;
  showShortcuts: () => void;
}

export function playShortcut(player: Player, active: () => boolean) {
  const shortcut = playbackShortcut(active, () => player.playing, () => player.play(), () => player.pause());
  document.addEventListener('keydown', shortcut.keydown, true);
  document.addEventListener('keyup', shortcut.keyup, true);
  window.addEventListener('blur', shortcut.blur);
}

export function practiceShortcuts(player: Player, controls: PracticeControls) {
  let playingBeat: number | null = null;
  player.on(state => { playingBeat = state.playing ? state.beat : null; });
  const currentBar = () => {
    const beat = player.playing ? playingBeat : player.pausedAt;
    return (beat === null ? null : player.barAt(beat)) ?? controls.passage.snapshot().selected;
  };
  const atCurrentBar = (change: (bar: number) => void) => {
    const bar = currentBar();
    if (bar) { change(bar); controls.passages.apply(); }
  };
  const run = (action: PracticeAction) => {
    switch (action.kind) {
      case 'restart': controls.restart(); break;
      case 'loop': controls.passage.toggleRepeat(); controls.passages.apply(); break;
      case 'loopStart': atCurrentBar(bar => controls.passage.startAt(bar)); break;
      case 'loopEnd': atCurrentBar(bar => controls.passage.endAt(bar)); break;
      case 'nudgeSpeed': controls.speed.nudge(action.by); break;
      case 'speed': controls.speed.set(action.percent); break;
      case 'bar': {
        const bar = barAfter(currentBar(), action.step, controls.passage.snapshot().count);
        if (bar) controls.passages.selectBar(bar);
        break;
      }
      case 'metronome': controls.toggleMetronome(); break;
      case 'scroll': controls.scrolling.toggleContinuous(); break;
      case 'scrollRate': controls.scrolling.nudgeRate(action.by); break;
      case 'shortcuts': controls.showShortcuts(); break;
    }
  };
  document.addEventListener('keydown', event => {
    const action = practiceKey(event, {
      active: controls.active(),
      dialogOpen: document.querySelector('dialog[open]') !== null,
      playing: player.playing,
      scrolling: controls.scrolling.continuous(),
    });
    if (!action) return;
    event.preventDefault();
    run(action);
  });
}
