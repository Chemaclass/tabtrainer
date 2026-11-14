import type { Player, PlayerPhase, PlayerState } from '../../audio/player';
import { byId } from '../dom';

const phaseNames: Record<PlayerPhase, string> = { 'counting-in': 'Counting in', playing: 'Playing', paused: 'Paused', stopped: 'Stopped' };

export function transport(player: Player, onStop: () => void) {
  const play = byId('playBtn', HTMLButtonElement), countIn = byId('countInDisplay'), status = byId('playbackStatus'), barNumber = byId('barNo');
  let shownPhase = player.phase;
  const showPlayButton = () => {
    play.classList.toggle('pause', player.playing);
    play.setAttribute('aria-label', player.playing ? 'Pause' : player.canResume ? 'Resume' : 'Play');
  };
  play.onclick = () => player.toggle();
  byId('stopBtn', HTMLButtonElement).onclick = onStop;
  return {
    show({ phase, countInRemaining }: PlayerState) {
      countIn.hidden = phase !== 'counting-in';
      countIn.textContent = phase === 'counting-in' ? `Count-in: ${countInRemaining ?? ''}` : '';
      if (phase !== shownPhase) { status.textContent = phaseNames[phase]; shownPhase = phase; }
      showPlayButton();
    },
    showPlayButton,
    showBar(bar: number | null) { barNumber.textContent = bar ? String(bar) : '–'; },
  };
}
