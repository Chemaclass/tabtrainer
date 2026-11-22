import type { Jam } from '../../app/jam';
import { moodStage, type MoodStage } from '../../app/jamMood';
import { MOODS, type MoodId } from '../../core/moods';
import { byId } from '../dom';

interface MoodStageHandlers {
  pick: (id: MoodId) => void;
  nextLoop: () => void;
}

const GROOVE_TITLE = 'Groove';
const MOOD_GROOVE_TITLE = 'Fine tune';

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

  const buttons = MOODS.map(mood => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jam-mood-chip';
    button.textContent = mood.name;
    button.dataset.mood = mood.id;
    button.onclick = () => pick(mood.id);
    return button;
  });
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

  function show() {
    const stage = moodStage(jam);
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mood === jam.mood?.id));
    screen.classList.toggle('mood-on', stage !== null);
    placeTitle(stage !== null);
    for (const element of [moodName, why, recipe, summary, tempoHint]) element.hidden = stage === null;
    grooveTitle.textContent = stage ? MOOD_GROOVE_TITLE : GROOVE_TITLE;
    if (stage) showFacts(stage);
    else setText(why, '');
  }

  return { show };
}
