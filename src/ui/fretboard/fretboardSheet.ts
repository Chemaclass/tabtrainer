import { INSTRUMENTS } from '../../core/instruments';
import { MOODS, type Mood } from '../../core/moods';
import { SCALES, isScaleId } from '../../core/scales';
import { DEFAULT_FRETBOARD_CHOICE, FIRST_FRET, LAST_FRET, ROOT_OPTIONS, chooseScale, fretboardSheet as sheetFor, isFretboardChoice, stepPosition, toggleMood, windowLabel, withOfferedMove, type FretboardChoice, type FretboardSheet, type SheetMove } from '../../app/fretboardSheet';
import type { Progression, ProgressionChord } from '../../core/progressions';
import { pref, setPref } from '../../app/storage';
import { byId } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { dismissHelpOnBackdrop } from '../shell/helpDialogs';
import { fretboardSvg } from './fretboardSvg';

const NO_MOOD = 'Pick a mood to set a scale and the progressions that carry it.';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function moodWhyFor(mood: Mood | null): string {
  if (!mood) return NO_MOOD;
  return `${mood.name}: ${mood.why}`;
}

function movesHintFor(sheet: FretboardSheet): string {
  if (!sheet.chord) return 'Pick a chord to see the bass moves over it.';
  if (!sheet.next) return 'Pick a chord in a progression to walk into the next chord.';
  return `Walks lead into ${sheet.next.name}, the next chord.`;
}

/** Sticky boards hide whatever focus scrolls under them, so the dialog keeps that much room clear at the top. */
function keepFocusClearOf(view: HTMLElement, dialog: HTMLDialogElement) {
  const update = () => {
    const sticky = getComputedStyle(view).position === 'sticky';
    dialog.style.scrollPaddingTop = sticky ? `${view.offsetHeight}px` : '';
  };
  new ResizeObserver(update).observe(view);
}

function replaceKeepingFocus(container: HTMLElement, nodes: HTMLElement[]) {
  const focused = container.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.key : undefined;
  container.replaceChildren(...nodes);
  if (focused) container.querySelector<HTMLElement>(`[data-key="${CSS.escape(focused)}"]`)?.focus();
}

const options = (select: HTMLSelectElement, entries: { value: string | number; label: string }[]) =>
  select.replaceChildren(...entries.map(({ value, label }) => new Option(label, String(value))));

export function fretboardSheet() {
  const dialog = byId('fretboard', HTMLDialogElement);
  const root = byId('fretboardRoot', HTMLSelectElement), scale = byId('fretboardScale', HTMLSelectElement), instrument = byId('fretboardInstrument', HTMLSelectElement);
  const degrees = byId('fretboardDegrees', HTMLButtonElement), board = byId('fretboardBoard'), strings = byId('fretboardStrings', HTMLUListElement);
  const sevenths = byId('fretboardSevenths', HTMLButtonElement), position = byId('fretboardPosition', HTMLSelectElement);
  const previous = byId('fretboardPrevious', HTMLButtonElement), next = byId('fretboardNext', HTMLButtonElement);
  const progressionList = byId('fretboardProgressions'), moveList = byId('fretboardMoves'), movesHint = byId('fretboardMovesHint');
  const moveText = byId('fretboardMoveText'), fits = byId('fretboardFits', HTMLButtonElement);
  const moodWhy = byId('fretboardMoodWhy');
  const moodButton = (mood: Mood) => {
    const button = element('button', 'toggle', mood.name);
    button.type = 'button';
    button.dataset.mood = mood.id;
    button.onclick = () => commit(toggleMood(choice, mood.id));
    return button;
  };
  const moodButtons = MOODS.map(moodButton);
  byId('fretboardMoods').replaceChildren(...moodButtons);
  const chordButton = (step: number | null) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'toggle fretboard-chord' });
    button.onclick = () => choose({ chord: step, progression: null, bar: null });
    return button;
  };
  const chordButtons = [chordButton(null), ...Array.from({ length: 7 }, (_, step) => chordButton(step))];
  byId('fretboardChords').replaceChildren(...chordButtons);
  let choice = DEFAULT_FRETBOARD_CHOICE, windows = sheetFor(choice).windows, scrolledTo: number | null = null;

  options(root, ROOT_OPTIONS);
  options(scale, SCALES.map(s => ({ value: s.id, label: s.name })));
  options(instrument, Object.values(INSTRUMENTS).map(i => ({ value: i.id, label: i.name })));

  byId('fretboardBtn').onclick = () => { choice = pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE); scrolledTo = null; dialog.showModal(); show(); };
  dismissHelpOnBackdrop(dialog);
  keepFocusClearOf(byId('fretboardView'), dialog);
  root.onchange = () => choose({ root: Number(root.value) });
  scale.onchange = () => {
    if (isScaleId(scale.value)) commit(chooseScale(choice, scale.value));
  };
  instrument.onchange = () => choose({ instrument: instrument.value });
  degrees.onclick = () => choose({ labels: choice.labels === 'degrees' ? 'names' : 'degrees' });
  sevenths.onclick = () => choose({ sevenths: !choice.sevenths });
  position.onchange = () => choose({ position: position.value === '' ? null : Number(position.value) });
  fits.onclick = () => {
    choose({ position: Number(fits.dataset.fret) });
    position.focus();
  };
  previous.onclick = () => step(-1);
  next.onclick = () => step(1);

  function step(direction: 1 | -1) {
    const fret = stepPosition(windows, choice.position, direction);
    if (fret !== undefined) choose({ position: fret });
  }

  function choose(change: Partial<FretboardChoice>) {
    commit({ ...choice, ...change });
  }

  function commit(next: FretboardChoice) {
    if (!isFretboardChoice(next)) return;
    choice = withOfferedMove(next);
    setPref('fretboardSheet', choice);
    show();
  }

  function show() {
    setSelectValue(root, String(choice.root));
    setSelectValue(scale, choice.scale);
    setSelectValue(instrument, choice.instrument);
    degrees.setAttribute('aria-pressed', String(choice.labels === 'degrees'));
    sevenths.setAttribute('aria-pressed', String(choice.sevenths));
    const sheet = sheetFor(choice);
    windows = sheet.windows;
    showMood(sheet);
    chordButtons[0].textContent = 'No chord';
    chordButtons[0].setAttribute('aria-pressed', String(!sheet.chord));
    sheet.chords.forEach((chord, index) => {
      const button = chordButtons[index + 1];
      button.replaceChildren(chord.name, Object.assign(document.createElement('small'), { textContent: chord.numeral }));
      button.setAttribute('aria-label', `${chord.name}, ${chord.numeral}`);
      button.setAttribute('aria-pressed', String(sheet.chord === chord));
    });
    showProgressions(sheet);
    showMoves(sheet);
    options(position, [{ value: '', label: 'All frets' }, ...sheet.windows.map(w => ({ value: w.first, label: windowLabel(w) }))]);
    setSelectValue(position, sheet.window ? String(sheet.window.first) : '');
    previous.setAttribute('aria-disabled', String(stepPosition(windows, choice.position, -1) === undefined));
    next.setAttribute('aria-disabled', String(stepPosition(windows, choice.position, 1) === undefined));
    const summary = byId('fretboardSummary');
    if (summary.textContent !== sheet.summary) summary.textContent = sheet.summary;
    board.replaceChildren(fretboardSvg({ openNames: sheet.openNames, firstFret: FIRST_FRET, lastFret: LAST_FRET, marks: sheet.marks, label: sheet.description }));
    if (sheet.window && sheet.window.first !== scrolledTo) scrollToFret(sheet.window.first);
    scrolledTo = sheet.window?.first ?? null;
    strings.replaceChildren(...sheet.strings.map(({ text }) => Object.assign(document.createElement('li'), { textContent: text })));
  }

  function showMood(sheet: FretboardSheet) {
    for (const button of moodButtons) {
      const picked = button.dataset.mood === sheet.mood?.id;
      button.setAttribute('aria-pressed', String(picked));
    }
    const why = moodWhyFor(sheet.mood);
    if (moodWhy.textContent !== why) moodWhy.textContent = why;
  }

  function showProgressions(sheet: FretboardSheet) {
    replaceKeepingFocus(progressionList, sheet.progressions.map(progression => progressionRow(sheet, progression)));
  }

  function progressionRow(sheet: FretboardSheet, progression: Progression): HTMLElement {
    const label = element('span', 'fretboard-progression-name', progression.name);
    label.id = `fretboardProgression-${progression.slug}`;
    const chords = element('div', 'fretboard-chord-row');
    chords.setAttribute('role', 'group');
    chords.setAttribute('aria-labelledby', label.id);
    chords.append(...progression.chords.map(chord => progressionChordButton(sheet, progression, chord)));
    const row = element('div', 'fretboard-progression');
    row.append(label, chords);
    return row;
  }

  function progressionChordButton(sheet: FretboardSheet, progression: Progression, chord: ProgressionChord): HTMLButtonElement {
    const button = element('button', 'toggle fretboard-chord');
    button.type = 'button';
    button.dataset.key = `${progression.slug}:${chord.bar}`;
    button.append(chord.name, element('small', '', chord.numeral));
    button.setAttribute('aria-label', `${chord.name}, ${chord.numeral}, bar ${chord.bar + 1}`);
    button.setAttribute('aria-pressed', String(sheet.chord === chord));
    button.onclick = () => choose({ progression: progression.slug, bar: chord.bar, chord: null });
    return button;
  }

  function moveButton(sheet: FretboardSheet, move: SheetMove): HTMLButtonElement {
    const button = element('button', 'toggle fretboard-move');
    button.type = 'button';
    button.dataset.key = move.id;
    button.append(element('strong', '', move.name), element('small', '', move.when));
    button.setAttribute('aria-pressed', String(sheet.move?.id === move.id));
    button.onclick = () => choose({ move: choice.move === move.id ? null : move.id });
    return button;
  }

  function showMoves(sheet: FretboardSheet) {
    replaceKeepingFocus(moveList, sheet.moves.map(move => moveButton(sheet, move)));
    movesHint.textContent = movesHintFor(sheet);
    const text = sheet.move?.text ?? '';
    if (moveText.textContent !== text) moveText.textContent = text;
    const fitting = sheet.move?.fits;
    fits.hidden = !fitting;
    if (fitting) {
      fits.textContent = `Go to ${windowLabel(fitting).toLowerCase()}`;
      fits.dataset.fret = String(fitting.first);
    }
  }

  function scrollToFret(fret: number) {
    const number = board.querySelector(`.fb-fret-number[data-fret="${fret}"]`);
    if (!number) { board.scrollLeft = 0; return; }
    const offset = number.getBoundingClientRect().left - board.getBoundingClientRect().left + board.scrollLeft;
    board.scrollLeft = Math.max(0, offset - 40);
  }
}
