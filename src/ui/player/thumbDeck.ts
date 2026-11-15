import { speedStep } from '../../app/practiceKeys';
import { passMarks, speedPracticeProgressText } from '../../core/speedPractice';
import type { Player } from '../../audio/player';
import { byId } from '../dom';

const HOLD_DELAY_MS = 450;
const HOLD_REPEAT_MS = 150;
const MAX_PASS_MARKS = 8;

interface LoopState { first: number; last: number; repeat: boolean }

function stepOnHold(button: HTMLButtonElement, step: () => void) {
  let delay = 0, repeat = 0, held = false;
  const release = () => { clearTimeout(delay); clearInterval(repeat); };
  const tick = () => { step(); if (button.disabled) release(); };
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    held = false;
    delay = window.setTimeout(() => { held = true; repeat = window.setInterval(tick, HOLD_REPEAT_MS); tick(); }, HOLD_DELAY_MS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, release);
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('click', () => { if (held) held = false; else step(); });
}

export function thumbDeck(player: Player, loop: () => LoopState, actions: { nudgeSpeed: (by: number) => void; toggleLoop: () => void; restart: () => void }) {
  const status = byId('deckStatus'), loopLabel = byId('deckLoop'), pass = byId('deckPass'), marks = byId('deckPassMarks');
  const toggle = byId('loopToggle', HTMLButtonElement), announcer = byId('playbackStatus');
  const nudge = (by: number) => { actions.nudgeSpeed(by); announcer.textContent = `Speed ${Math.round(player.speed * 100)}%`; };
  stepOnHold(byId('speedDown', HTMLButtonElement), () => nudge(-speedStep));
  stepOnHold(byId('speedUp', HTMLButtonElement), () => nudge(speedStep));
  toggle.onclick = actions.toggleLoop;
  byId('restartBtn', HTMLButtonElement).onclick = actions.restart;
  return {
    show() {
      const { first, last, repeat } = loop(), practice = player.speedPracticeState;
      toggle.setAttribute('aria-pressed', String(repeat));
      status.hidden = !repeat;
      loopLabel.textContent = first === last ? `Loop ${first}` : `Loop ${first}-${last}`;
      pass.textContent = practice.enabled ? speedPracticeProgressText(practice) : '';
      const shown = practice.enabled && !practice.reached && practice.repetitions <= MAX_PASS_MARKS ? passMarks(practice) : [];
      marks.replaceChildren(...shown.map(mark => Object.assign(document.createElement('i'), { className: mark })));
    },
  };
}
