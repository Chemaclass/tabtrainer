import type { Family } from '../../core/instruments';
import type { Song } from '../../core/model';
import { parseSong } from '../../core/parser';
import { buildTimeline, onsetAt, onsetsOf } from '../../core/timeline';
import { Player } from '../../audio/player';
import { renderSong } from '../../render/tab';
import { demoSongText } from '../../app/landingDemo';

const PHONE_SHEET_WIDTH = 350, MAX_ZOOM = 1.4;

export function landingDemo(sheet: HTMLElement, playing: (on: boolean) => void) {
  const player = new Player();
  let song: Song | null = null, onsets: number[] = [], lit: Element[] = [];
  let drawn: { song: Song; width: number } | null = null;
  const light = (key: string | null) => {
    lit.forEach(note => note.classList.remove('on'));
    lit = key ? [...sheet.querySelectorAll(`.note[data-key="${key}"]`)] : [];
    lit.forEach(note => note.classList.add('on'));
  };
  const draw = () => {
    const width = sheet.clientWidth;
    if (!song || width === 0 || (drawn?.song === song && drawn.width === width)) return;
    const box = getComputedStyle(sheet);
    const inner = width - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    const zoom = Math.min(MAX_ZOOM, Math.max(1, inner / PHONE_SHEET_WIDTH));
    sheet.style.setProperty('--demo-zoom', String(zoom));
    renderSong(sheet, song, { barsPerLine: 2, width: inner / zoom, touchSize: 0 });
    drawn = { song, width };
    lit = [];
  };
  player.on(state => {
    playing(state.playing);
    light(state.playing && state.beat !== null ? onsetAt(onsets, state.beat) : null);
  });
  addEventListener('resize', draw);
  let family: Family | null = null;
  return {
    /** Loads the bars of an instrument and draws them once the sheet has a width. */
    show(chosen: Family) {
      if (chosen !== family) {
        family = chosen;
        song = parseSong(demoSongText(chosen)).song;
        player.load(buildTimeline(song), song.meta.tempo);
        player.setRange(null, true);
        onsets = onsetsOf(player.notes);
      }
      draw();
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
