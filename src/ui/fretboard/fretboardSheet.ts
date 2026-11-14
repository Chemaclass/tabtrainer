import { INSTRUMENTS } from '../../core/instruments';
import { SCALES } from '../../core/scales';
import { DEFAULT_FRETBOARD_CHOICE, FIRST_FRET, LAST_FRET, ROOT_OPTIONS, fretboardSheet as sheetFor, isFretboardChoice, type FretboardChoice } from '../../app/fretboardSheet';
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
  let choice = DEFAULT_FRETBOARD_CHOICE;

  options(root, ROOT_OPTIONS);
  options(scale, SCALES.map(s => ({ value: s.id, label: s.name })));
  options(instrument, Object.values(INSTRUMENTS).map(i => ({ value: i.id, label: i.name })));

  byId('fretboardBtn').onclick = () => { choice = pref('fretboardSheet', DEFAULT_FRETBOARD_CHOICE); show(); dialog.showModal(); };
  dismissHelpOnBackdrop(dialog);
  root.onchange = () => choose({ root: Number(root.value) });
  scale.onchange = () => choose({ scale: scale.value as FretboardChoice['scale'] });
  instrument.onchange = () => choose({ instrument: instrument.value });
  degrees.onclick = () => choose({ labels: choice.labels === 'degrees' ? 'names' : 'degrees' });

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
    const sheet = sheetFor(choice);
    byId('fretboardSummary').textContent = sheet.summary;
    board.replaceChildren(fretboardSvg({ openNames: sheet.openNames, firstFret: FIRST_FRET, lastFret: LAST_FRET, marks: sheet.marks, label: sheet.description }));
    strings.replaceChildren(...sheet.strings.map(({ text }) => Object.assign(document.createElement('li'), { textContent: text })));
  }
}
