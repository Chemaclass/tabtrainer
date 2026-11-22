import type { CatalogueEntry } from '../../app/catalogue';
import type { BarLoop } from '../../app/practiceLog';
import { barsLabel, clearedSummary, clearedTitle, clockTime, type ClearedLoop } from '../../app/practiceSession';
import type { Player } from '../../audio/player';
import { byId } from '../dom';

interface ClearedActions {
  next: (loop: BarLoop, speed: number) => void;
  wholeSong: () => void;
  nextExercise: () => CatalogueEntry | undefined;
  nextLevel: () => { index: number; name: string } | null;
  chooseLevel: (index: number) => void;
  pick: (ref: string) => void;
  daysInARow: () => number;
}

export function clearedSheet(player: Pick<Player, 'playing' | 'pause'>, actions: ClearedActions) {
  const sheet = byId('clearedSheet', HTMLDialogElement), steps = byId('clearedSteps');
  const nextButton = byId('clearedNextBtn', HTMLButtonElement), wholeButton = byId('clearedWholeBtn', HTMLButtonElement);
  const exerciseButton = byId('clearedExerciseBtn', HTMLButtonElement), levelButton = byId('clearedLevelBtn', HTMLButtonElement);
  // Beside the score the sheet leaves the score and the level picker usable.
  const beside = matchMedia('(min-width: 900px)');
  let shown: ClearedLoop | null = null, generation = 0;
  sheet.addEventListener('close', () => document.body.classList.remove('cleared-beside'));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !sheet.open || sheet.matches(':modal') || document.querySelector('dialog:modal')) return;
    event.preventDefault(); sheet.close();
  });
  beside.addEventListener('change', () => { if (sheet.open) sheet.close(); });
  sheet.addEventListener('click', event => {
    if (!sheet.matches(':modal') || event.target !== sheet) return;
    const bounds = sheet.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientX < bounds.left || event.clientX > bounds.right) sheet.close();
  });
  sheet.addEventListener('click', event => { if (event.target instanceof Element && event.target.closest('.cleared-action')) sheet.close(); });
  nextButton.onclick = () => { if (shown?.next) actions.next(shown.next, shown.startSpeed); };
  wholeButton.onclick = actions.wholeSong;
  byId('clearedDoneBtn').onclick = () => sheet.close();

  function showChart({ steps: speeds }: ClearedLoop) {
    const low = Math.min(...speeds), high = Math.max(...speeds), span = high - low;
    steps.replaceChildren(...speeds.map((speed, i) => {
      const bar = document.createElement('i'), level = span ? (speed - low) / span : 1;
      bar.style.setProperty('--level', String(level));
      bar.style.setProperty('--shade', `${Math.round(30 + 70 * (speeds.length > 1 ? i / (speeds.length - 1) : 1))}%`);
      return bar;
    }));
    byId('clearedChart').hidden = speeds.length < 2;
    byId('clearedFrom').textContent = `${speeds[0]}%`;
    byId('clearedTo').textContent = `${speeds[speeds.length - 1]}%`;
  }

  function show(cleared: ClearedLoop) {
    if (sheet.open) return;
    if (player.playing) player.pause();
    shown = cleared;
    const days = actions.daysInARow();
    byId('clearedLabel').textContent = cleared.loop ? 'Loop cleared' : 'Song cleared';
    byId('clearedTitle').textContent = clearedTitle(cleared);
    byId('clearedSummary').textContent = clearedSummary(cleared);
    showChart(cleared);
    byId('clearedPasses').textContent = String(cleared.passes);
    byId('clearedPassesLabel').textContent = cleared.passes === 1 ? 'pass' : 'passes';
    byId('clearedTime').textContent = clockTime(cleared.seconds);
    byId('clearedDays').textContent = `${days} ${days === 1 ? 'day' : 'days'}`;
    nextButton.hidden = !cleared.next;
    byId('clearedNextLabel').textContent = cleared.next ? `Next: ${barsLabel(cleared.next)}` : '';
    const level = cleared.loop ? null : actions.nextLevel();
    levelButton.hidden = !level;
    byId('clearedLevelName').textContent = level?.name ?? '';
    levelButton.onclick = () => { if (level) actions.chooseLevel(level.index); };
    const exercise = cleared.loop || level ? undefined : actions.nextExercise();
    exerciseButton.hidden = !exercise;
    byId('clearedExerciseTitle').textContent = exercise?.title ?? '';
    exerciseButton.onclick = () => { if (exercise) actions.pick(exercise.value); };
    const actionButtons = [nextButton, levelButton, exerciseButton, wholeButton];
    const primary = actionButtons.find(button => !button.hidden) ?? wholeButton;
    for (const button of actionButtons) button.classList.toggle('primary', button === primary);
    if (beside.matches) { document.body.classList.add('cleared-beside'); sheet.show(); } else sheet.showModal();
    primary.focus();
  }

  // A pass ends inside the player's own update, so pause and open once that update is done.
  return {
    open: (cleared: ClearedLoop) => {
      const opened = generation;
      queueMicrotask(() => { if (opened === generation) show(cleared); });
    },
    // A sheet still waiting to open belongs to the song or level that was playing, so it is dropped too.
    close: () => { generation++; if (sheet.open) sheet.close(); },
  };
}
