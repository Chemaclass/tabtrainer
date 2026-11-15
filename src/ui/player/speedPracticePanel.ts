import { defaultSpeedPracticeFrom, isSpeedPracticeConfig, nextSpeedPracticeSpeed } from '../../core/speedPractice';
import { pref, setPref } from '../../app/storage';
import type { Player } from '../../audio/player';
import { closeOnOutside } from '../shell/disclosure';
import { byId, one } from '../dom';

export function speedPracticePanel(player: Player, canLoop: () => boolean, onSpeedChange: () => void) {
  const settings = one('.speed-practice', HTMLDetailsElement);
  closeOnOutside(settings);
  const climb = byId('climbBtn', HTMLButtonElement);
  const repetitions = byId('speedPracticeRepetitions', HTMLInputElement);
  const increase = byId('speedPracticeIncrease', HTMLInputElement);
  const target = byId('speedPracticeTarget', HTMLInputElement);
  const error = byId('speedPracticeError');
  const status = byId('speedPracticeStatus');
  const saved = pref('speedPractice', defaultSpeedPracticeFrom(Math.round(player.speed * 100)));
  let lastTarget = saved.target;
  repetitions.value = String(saved.repetitions); increase.value = String(saved.increase); target.value = String(saved.target);
  const config = () => ({ repetitions: repetitions.valueAsNumber, increase: increase.valueAsNumber, target: target.valueAsNumber });
  function validate() {
    const current = config();
    const message = !isSpeedPracticeConfig(current) ? 'Enter whole numbers within the shown limits.' : current.target < Math.round(player.speed * 100) ? 'Target must be at least the current speed.' : '';
    error.textContent = message;
    return isSpeedPracticeConfig(current) && !message ? current : null;
  }
  function show() {
    const state = player.speedPracticeState;
    const climbTarget = state.enabled ? state.target : lastTarget;
    climb.hidden = !canLoop() || (!state.enabled && state.speed >= climbTarget);
    climb.setAttribute('aria-pressed', String(state.enabled));
    climb.textContent = `Climb to ${climbTarget}%`;
    const progress = byId('speedPracticeProgress');
    progress.hidden = !state.enabled;
    progress.textContent = state.reached ? `Target reached: ${state.speed}%` : `pass ${state.completed + 1} of ${state.repetitions}, then ${nextSpeedPracticeSpeed(state.speed, state)}%`;
  }
  player.onSpeedPractice((state, reason) => {
    onSpeedChange(); show();
    if (reason === 'increase' || reason === 'target' || reason === 'reset') setPref('speed', Math.round(player.speed * 100));
    if (reason === 'enabled' || reason === 'ended') status.textContent = '';
    if (reason === 'speed') status.textContent = 'Climb stopped because you changed the speed.';
    if (reason === 'increase') status.textContent = `Speed increased to ${state.speed}%.`;
    if (reason === 'target') status.textContent = `Target reached: ${state.speed}%.`;
  });
  climb.onclick = event => {
    if (player.speedPracticeState.enabled) { player.setSpeedPractice(null); show(); return; }
    const valid = validate();
    if (!valid || !player.setSpeedPractice(valid)) {
      event.stopPropagation();
      settings.open = true;
      status.textContent = `Climb did not start. ${error.textContent || 'Turn on Loop bars first.'}`;
      show(); return;
    }
    setPref('speedPractice', valid); show();
  };
  byId('speed', HTMLInputElement).addEventListener('input', show);
  [repetitions, increase, target].forEach(input => input.addEventListener('input', () => {
    if (player.speedPracticeState.enabled) player.setSpeedPractice(null);
    validate();
    const current = config();
    if (isSpeedPracticeConfig(current)) { setPref('speedPractice', current); lastTarget = current.target; }
    show();
  }));
  show();
  return { show };
}
