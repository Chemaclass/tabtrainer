import { INSTRUMENTS } from '../../core/instruments';
import { SCALES } from '../../core/scales';
import { DEFAULT_FRETBOARD_CHOICE, FIRST_FRET, LAST_FRET, ROOT_OPTIONS, fretboardSheet as sheetFor, isFretboardChoice, stepPosition, windowLabel, type FretboardChoice } from '../../app/fretboardSheet';
import { pref, setPref } from '../../app/storage';
import { byId } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { dismissHelpOnBackdrop } from '../shell/helpDialogs';
import { fretboardSvg } from './fretboardSvg';

const options = (select: HTMLSelectElement, entries: { value: string | number; label: string }[]) =>
  select.replaceChildren(...entries.map(({ value, label }) => new Option(label, String(value))));

export function fretboardSheet() {
  const dialog = byId('fretboard', HTMLDialogElement);
  const root = byId('fretboardRoot', HTMLSelectElement), scale = byId('fretboardScale', HTMLSelectElement), instrument = byId('fretboardInstrument', HTMLSelectElement);
  const degrees = byId('fretboardDegrees', HTMLButtonElement), board = byId('fretboardBoard'), strings = byId('fretboardStrings', HTMLUListElement);
  const sevenths = byId('fretboardSevenths', HTMLButtonElement), position = byId('fretboardPosition', HTMLSelectElement);
  const previous = byId('fretboardPrevious', HTMLButtonElement), next = byId('fretboardNext', HTMLButtonElement);
  const chordButton = (step: number | null) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'toggle fretboard-chord' });
    button.onclick = () => choose({ chord: step });
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
  root.onchange = () => choose({ root: Number(root.value) });
  scale.onchange = () => choose({ scale: scale.value as FretboardChoice['scale'] });
  instrument.onchange = () => choose({ instrument: instrument.value });
  degrees.onclick = () => choose({ labels: choice.labels === 'degrees' ? 'names' : 'degrees' });
  sevenths.onclick = () => choose({ sevenths: !choice.sevenths });
  position.onchange = () => choose({ position: position.value === '' ? null : Number(position.value) });
  previous.onclick = () => step(-1);
  next.onclick = () => step(1);

  function step(direction: 1 | -1) {
    const fret = stepPosition(windows, choice.position, direction);
    if (fret !== undefined) choose({ position: fret });
  }

  function choose(change: Partial<FretboardChoice>) {
    const next = { ...choice, ...change };
    if (!isFretboardChoice(next)) return;
    choice = next;
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
    chordButtons[0].textContent = 'No chord';
    chordButtons[0].setAttribute('aria-pressed', String(!sheet.chord));
    sheet.chords.forEach((chord, index) => {
      const button = chordButtons[index + 1];
      button.replaceChildren(chord.name, Object.assign(document.createElement('small'), { textContent: chord.numeral }));
      button.setAttribute('aria-label', `${chord.name}, ${chord.numeral}`);
      button.setAttribute('aria-pressed', String(sheet.chord === chord));
    });
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

  function scrollToFret(fret: number) {
    const number = board.querySelector(`.fb-fret-number[data-fret="${fret}"]`);
    if (!number) { board.scrollLeft = 0; return; }
    const offset = number.getBoundingClientRect().left - board.getBoundingClientRect().left + board.scrollLeft;
    board.scrollLeft = Math.max(0, offset - 40);
  }
}
