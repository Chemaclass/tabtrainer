import type { Family } from '../../core/instruments';
import { parseSong } from '../../core/parser';
import { buildTimeline, onsetAt, onsetsOf } from '../../core/timeline';
import { Player } from '../../audio/player';
import { renderSong } from '../../render/tab';
import { demoSongText } from '../../app/landingDemo';

const PHONE_SHEET_WIDTH = 350, MAX_ZOOM = 1.4;

export function landingDemo(sheet: HTMLElement, playing: (on: boolean) => void) {
  const player = new Player();
  let onsets: number[] = [], lit: Element[] = [], shown: Family | null = null, drawnWidth = 0;
  const light = (key: string | null) => {
    lit.forEach(note => note.classList.remove('on'));
    lit = key ? [...sheet.querySelectorAll(`.note[data-key="${key}"]`)] : [];
    lit.forEach(note => note.classList.add('on'));
  };
  const draw = (family: Family) => {
    const song = parseSong(demoSongText(family)).song;
    drawnWidth = sheet.clientWidth;
    const box = getComputedStyle(sheet);
    const width = drawnWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    const zoom = Math.min(MAX_ZOOM, Math.max(1, width / PHONE_SHEET_WIDTH));
    sheet.style.setProperty('--demo-zoom', String(zoom));
    renderSong(sheet, song, { barsPerLine: 2, width: width / zoom, touchSize: 0 });
    lit = [];
    if (shown === family) return;
    shown = family;
    player.load(buildTimeline(song), song.meta.tempo);
    player.setRange(null, true);
    onsets = onsetsOf(player.notes);
  };
  player.on(state => {
    playing(state.playing);
    light(state.playing && state.beat !== null ? onsetAt(onsets, state.beat) : null);
  });
  addEventListener('resize', () => { if (shown && sheet.clientWidth !== drawnWidth) draw(shown); });
  return {
    show(family: Family) {
      if (family === shown) return;
      player.stop();
      draw(family);
    },
    /** Starts or stops the loop; false when this browser cannot make sound. */
    toggle(): boolean {
      if (player.playing) { player.stop(); return true; }
      player.play();
      return player.playing;
    },
    setSpeed(percent: number) { player.setSpeed(percent / 100); },
    stop() { player.stop(); },
  };
}
