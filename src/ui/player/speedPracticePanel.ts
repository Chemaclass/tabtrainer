import { isSpeedPracticeConfig } from '../../core/speedPractice';
import { pref, setPref } from '../../app/storage';
import type { Player } from '../../audio/player';
import { closeOnOutside } from '../shell/disclosure';
import { byId, one } from '../dom';

export function speedPracticePanel(player: Player, canLoop: () => boolean, onSpeedChange: () => void) {
  closeOnOutside(one('.speed-practice', HTMLDetailsElement));
  const enabled = byId('speedPracticeChk', HTMLInputElement);
  const repetitions = byId('speedPracticeRepetitions', HTMLInputElement);
  const increase = byId('speedPracticeIncrease', HTMLInputElement);
  const target = byId('speedPracticeTarget', HTMLInputElement);
  const error = byId('speedPracticeError');
  const saved = pref('speedPractice', { repetitions: 4, increase: 5, target: Math.max(100, Math.round(player.speed * 100)) });
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
    enabled.checked = state.enabled;
    enabled.disabled = !canLoop();
    const progress = byId('speedPracticeProgress');
    progress.hidden = !state.enabled;
    progress.textContent = state.reached ? `Target reached: ${state.speed}%` : `${state.speed}%, repetition ${state.completed + 1} of ${state.repetitions}, target ${state.target}%`;
  }
  player.onSpeedPractice((state, reason) => {
    onSpeedChange(); show();
    if (reason === 'increase' || reason === 'target' || reason === 'reset') setPref('speed', Math.round(player.speed * 100));
    if (reason === 'enabled' || reason === 'ended') byId('speedPracticeStatus').textContent = '';
    if (reason === 'increase') byId('speedPracticeStatus').textContent = `Speed increased to ${state.speed}%.`;
    if (reason === 'target') byId('speedPracticeStatus').textContent = `Target reached: ${state.speed}%.`;
  });
  enabled.onchange = () => {
    if (!enabled.checked) { player.setSpeedPractice(null); show(); return; }
    const valid = validate();
    if (!valid || !player.setSpeedPractice(valid)) {
      if (valid) error.textContent = 'Turn on Loop bars to enable gradual speed increases.';
      show(); return;
    }
    setPref('speedPractice', valid); show();
  };
  [repetitions, increase, target].forEach(input => input.addEventListener('input', () => {
    if (player.speedPracticeState.enabled) player.setSpeedPractice(null);
    validate();
    const current = config();
    if (isSpeedPracticeConfig(current)) setPref('speedPractice', current);
    show();
  }));
  show();
  return { show };
}
