import type { OpenSong } from '../../app/openSong';
import type { Passage } from '../../app/passage';
import type { PassagePlayback } from '../../app/passagePlayback';
import type { Player } from '../../audio/player';
import type { scoreView } from '../practice/scoreView';
import { byId } from '../dom';
import { passageControls } from './passageControls';

type PassageScore = Pick<ReturnType<typeof scoreView>, 'markPassage' | 'focusFirstBar'>;

export function passageView(player: Player, passage: Passage, playback: PassagePlayback, openSong: OpenSong, score: PassageScore, onShow: () => void) {
  function show() {
    const state = passage.snapshot();
    onShow();
    score.markPassage({ selectedNote: playback.selectedNote?.key, selectedBar: state.selected, inPassage: bar => state.active && passage.includes(bar), isLoopEnd: bar => passage.isLoopEnd(bar) });
    controls.show({ ...state, loopsSelection: passage.loopsSelection() }, playback.summary(openSong.song?.bars ?? []));
  }
  function apply() {
    if (!openSong.song?.bars.length) return;
    playback.apply();
    show();
  }
  const controls = passageControls({
    onRange: (first, last, repeat) => { passage.setRange(first, last, repeat); apply(); },
    onStart: () => { passage.startAtSelection(); apply(); },
    onEnd: () => { passage.endAtSelection(); apply(); },
    onLoopBar: () => { passage.loopSelection(); apply(); },
    onReset: () => {
      passage.clear(); apply(); player.stop(); passage.deselect(); show();
      if (!score.focusFirstBar()) byId('title').focus();
    },
  });
  return {
    show,
    apply,
    loopTo(bar: number) { passage.loopTo(bar); apply(); },
    selectBar(bar: number) { if (playback.selectBar(bar)) show(); },
    selectNote(key: string, bar: number) {
      if (!playback.selectNote(key, bar)) return false;
      show();
      return true;
    },
  };
}
