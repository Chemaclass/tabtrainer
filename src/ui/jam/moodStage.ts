import type { Jam } from '../../app/jam';
import { moodStage, type MoodStage } from '../../app/jamMood';
import { MOODS, type MoodId } from '../../core/moods';
import { byId } from '../dom';

interface MoodStageHandlers {
  /** A mood, or null for Free. */
  pick: (id: MoodId | null) => void;
  nextLoop: () => void;
}

const GROOVE_TITLE = 'Groove';
const MOOD_GROOVE_TITLE = 'Fine tune';
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

/** The mood chips, and the stage they turn on: the mood as the title, why it sounds so, and the recipe under it. */
export function moodStageView(jam: Jam, { pick, nextLoop }: MoodStageHandlers) {
  const screen = byId('jamScreen');
  const chips = byId('jamMoods');
  const heading = byId('jamTitle');
  const moodName = byId('jamMoodName');
  const pickerButton = byId('jamPickerButton', HTMLButtonElement);
  const picker = byId('jamPicker');
  const why = byId('jamMoodWhy');
  const recipe = byId('jamRecipe');
  const grooveSlot = byId('jamRecipeGroove');
  const moreLoops = byId('jamMoreLoops', HTMLButtonElement);
  const summary = byId('jamMoodSummary');
  const grooveTitle = byId('jamGrooveTitle');
  const tempoHint = byId('jamTempoHint');
  const pickerHome = picker.parentElement!;
  const pickerNext = picker.nextSibling;

  const free = chip('Free', null, pick);
  free.classList.add('jam-mood-free');
  free.setAttribute('aria-label', 'Free, no mood');
  const buttons = [free, ...MOODS.map(mood => chip(mood.name, mood.id, pick))];
  chips.replaceChildren(...buttons);
  moreLoops.onclick = nextLoop;

  /** With a mood on, the mood names the page and the groove picker becomes one fact of the recipe. */
  function placeTitle(moodOn: boolean) {
    if (moodOn && picker.parentElement !== grooveSlot) {
      pickerHome.insertBefore(heading, why);
      picker.prepend(pickerButton);
      grooveSlot.append(picker);
    } else if (!moodOn && picker.parentElement === grooveSlot) {
      heading.append(pickerButton);
      picker.prepend(heading);
      pickerHome.insertBefore(picker, pickerNext);
    }
  }

  function showFacts(stage: MoodStage) {
    setText(moodName, stage.name);
    setText(why, stage.why);
    setText(byId('jamRecipeScale'), stage.scale.value);
    setText(byId('jamRecipeScaleHelp'), stage.scale.helper);
    setText(byId('jamRecipeChords'), stage.chords.value);
    setText(moreLoops, stage.chords.helper);
    moreLoops.hidden = !stage.chords.more;
    setText(byId('jamRecipeTempo'), stage.tempo.value);
    setText(byId('jamRecipeTempoHelp'), stage.tempo.helper);
    setText(byId('jamRecipeGrooveHelp'), stage.groove.helper);
    setText(summary, stage.summary);
    setText(tempoHint, stage.tempoHint);
  }

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
    placeTitle(stage !== null);
    for (const element of [moodName, recipe, summary, tempoHint]) element.hidden = stage === null;
    // With Free on, the why line is visually hidden but keeps its polite live region and gets the Free text
    why.classList.toggle('sr-only', stage === null);
    grooveTitle.textContent = stage ? MOOD_GROOVE_TITLE : GROOVE_TITLE;
    if (stage) showFacts(stage);
    else {
      setText(why, FREE_TEXT);
      setText(tempoHint, '');
    }
  }

  return { show };
}
