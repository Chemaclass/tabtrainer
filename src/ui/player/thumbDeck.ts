import { HoldRepeat } from '../../app/holdRepeat';
import { speedStep } from '../../app/practiceKeys';
import { passMarks, speedPracticeProgressText } from '../../core/speedPractice';
import type { Player } from '../../audio/player';
import { byId } from '../dom';

const MAX_PASS_MARKS = 8;

interface DeckPassage { label(): string | null; snapshot(): { repeat: boolean } }

function stepOnHold(button: HTMLButtonElement, step: () => void, settled: () => void) {
  const hold = new HoldRepeat({ step, settled, atLimit: () => button.disabled });
  button.addEventListener('pointerdown', event => { if (event.button === 0) hold.press(); });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, () => hold.release());
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('click', () => hold.click());
}

export function thumbDeck(player: Player, passage: DeckPassage, actions: { nudgeSpeed: (by: number) => void; toggleLoop: () => void; restart: () => void }) {
  const status = byId('deckStatus'), loopLabel = byId('deckLoop'), pass = byId('deckPass'), marks = byId('deckPassMarks');
  const toggle = byId('loopToggle', HTMLButtonElement), announcer = byId('playbackStatus');
  const announce = () => { announcer.textContent = `Speed ${Math.round(player.speed * 100)}%`; };
  stepOnHold(byId('speedDown', HTMLButtonElement), () => actions.nudgeSpeed(-speedStep), announce);
  stepOnHold(byId('speedUp', HTMLButtonElement), () => actions.nudgeSpeed(speedStep), announce);
  toggle.onclick = actions.toggleLoop;
  byId('restartBtn', HTMLButtonElement).onclick = actions.restart;
  return {
    show() {
      const label = passage.label(), { repeat } = passage.snapshot(), practice = player.speedPracticeState;
      toggle.setAttribute('aria-pressed', String(repeat));
      status.hidden = label === null;
      loopLabel.textContent = label ?? '';
      loopLabel.classList.toggle('looping', repeat);
      pass.textContent = practice.enabled ? speedPracticeProgressText(practice) : '';
      const shown = practice.enabled && !practice.reached && practice.repetitions <= MAX_PASS_MARKS ? passMarks(practice) : [];
      marks.replaceChildren(...shown.map(mark => Object.assign(document.createElement('i'), { className: mark })));
    },
  };
}
