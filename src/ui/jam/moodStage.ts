import type { Jam } from '../../app/jam';
import { heroTitle, moodStage } from '../../app/jamMood';
import { MOODS, type MoodId } from '../../core/moods';
import { byId } from '../dom';

interface MoodStageHandlers {
  /** A mood, or null for Free. */
  pick: (id: MoodId | null) => void;
}

const FREE_TEXT = 'No mood. The groove plays its own chords.';

function chip(label: string, id: MoodId | null, pick: MoodStageHandlers['pick']): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'jam-mood-chip';
  button.textContent = label;
  button.dataset.mood = id ?? '';
  button.onclick = () => pick(id);
  return button;
}

function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

/** The mood chips, and the hero they set: the mood or the groove as the title, why it sounds so, and the usual tempo. */
export function moodStageView(jam: Jam, { pick }: MoodStageHandlers) {
  const screen = byId('jamScreen');
  const chips = byId('jamMoods');
  const heading = byId('jamTitle');
  const heroName = byId('jamHeroName');
  const why = byId('jamMoodWhy');
  const about = byId('jamAbout');
  const tempoButton = byId('jamTempoButton', HTMLButtonElement);
  const tempoHint = byId('jamTempoHint');

  const free = chip('Free', null, pick);
  free.classList.add('jam-mood-free');
  free.setAttribute('aria-label', 'Free, no mood');
  const buttons = [free, ...MOODS.map(mood => chip(mood.name, mood.id, pick))];
  chips.replaceChildren(...buttons);

  let revealedMood: string | null = null;
  // The row has no width while the Jam screen is hidden, so the pressed chip is revealed once it shows
  new ResizeObserver(revealPressed).observe(chips);

  /** Scrolls the chip row sideways only, so a mood opened from a link shows its pressed chip on a phone. */
  function revealPressed() {
    const pressedMood = jam.mood?.id ?? '';
    if (pressedMood === revealedMood || chips.clientWidth === 0) return;
    revealedMood = pressedMood;
    const button = buttons.find(chip => chip.dataset.mood === pressedMood)!;
    const row = chips.getBoundingClientRect();
    const chip = button.getBoundingClientRect();
    if (chip.left < row.left) chips.scrollLeft -= row.left - chip.left;
    else if (chip.right > row.right) chips.scrollLeft += chip.right - row.right;
  }

  function show() {
    const stage = moodStage(jam);
    const pressedMood = jam.mood?.id ?? '';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mood === pressedMood));
    revealPressed();
    screen.classList.toggle('mood-on', stage !== null);
    setText(heroName, heroTitle(jam));
    heading.classList.toggle('long', stage === null);
    // With Free on, the why line is visually hidden but keeps its polite live region and gets the Free text
    why.classList.toggle('sr-only', stage === null);
    setText(why, stage?.why ?? FREE_TEXT);
    setText(about, jam.groove.about ?? '');
    about.hidden = stage !== null || !jam.groove.about;
    setText(tempoHint, stage?.tempoHint ?? '');
    tempoHint.hidden = stage === null;
    tempoButton.toggleAttribute('data-outside', stage?.tempoOutside ?? false);
  }

  return { show };
}
