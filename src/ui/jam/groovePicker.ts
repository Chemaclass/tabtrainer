import { addressOf } from '../../app/address';
import type { Jam, JamGroove } from '../../app/jam';
import { grooveGroups } from '../../app/jamMood';
import { moodFits } from '../../core/moods';
import { byId, isPlainClick, textSpan } from '../dom';

interface GrooveOption { slug: string; genre: string; link: HTMLAnchorElement; fit: HTMLSpanElement }

const FOCUS_STEP: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

function grooveHref(slug: string): string {
  return addressOf(new URLSearchParams({ view: 'jam', groove: slug }).toString(), import.meta.env.BASE_URL);
}

function grooveLink({ slug, groove }: JamGroove, fit: HTMLSpanElement): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'jam-groove';
  link.href = grooveHref(slug);
  const genre = textSpan('jam-groove-genre', groove.genre);
  genre.append(fit);
  link.append(
    textSpan('jam-groove-title', groove.title),
    genre,
    textSpan('jam-groove-tempo', `${groove.tempo} bpm`),
  );
  return link;
}

function listItem(link: HTMLAnchorElement): HTMLLIElement {
  const item = document.createElement('li');
  item.append(link);
  return item;
}

export function groovePicker(jam: Jam, choose: (slug: string) => void) {
  const picker = byId('jamPicker');
  const button = byId('jamPickerButton', HTMLButtonElement);
  const menu = byId('jamGrooves');
  const bundledList = byId('jamGrooveList', HTMLUListElement);
  const fitList = byId('jamFitList', HTMLUListElement);
  const fitHeading = byId('jamFitHeading');
  const otherHeading = byId('jamOtherHeading');
  const mineList = byId('jamMineList', HTMLUListElement);
  const mineEmpty = byId('jamMineEmpty');
  let options: GrooveOption[] = [];
  let bundledOptions: GrooveOption[] = [];
  let mineOptions: GrooveOption[] = [];

  button.addEventListener('click', toggle);
  button.addEventListener('keydown', openWithArrow);
  menu.addEventListener('keydown', moveFocus);
  picker.addEventListener('keydown', closeWithEscape);
  picker.addEventListener('focusout', closeWhenFocusLeaves);
  document.addEventListener('pointerdown', closeWhenPressedOutside);

  function optionFor(entry: JamGroove): GrooveOption {
    const fit = textSpan('jam-groove-fit', '');
    const link = grooveLink(entry, fit);
    link.addEventListener('click', event => pick(event, entry.slug));
    return { slug: entry.slug, genre: entry.groove.genre, link, fit };
  }

  /** Lists every groove again, after one of mine is saved or deleted. */
  function fill() {
    bundledOptions = jam.list.filter(entry => !entry.mine).map(optionFor);
    mineOptions = jam.list.filter(entry => entry.mine).map(optionFor);
    mineList.replaceChildren(...mineOptions.map(option => listItem(option.link)));
    mineEmpty.hidden = mineOptions.length > 0;
    show();
  }

  /** With a mood on, the bundled grooves that fit it come first under their own heading. */
  function group() {
    const { mood } = jam;
    const { fitting, other } = grooveGroups(jam.list, mood);
    const optionsOf = (entries: readonly JamGroove[]) => entries.map(entry => bundledOptions.find(option => option.slug === entry.slug)!);
    const fittingOptions = optionsOf(fitting);
    const otherOptions = optionsOf(other);
    fitList.replaceChildren(...fittingOptions.map(option => listItem(option.link)));
    bundledList.replaceChildren(...otherOptions.map(option => listItem(option.link)));
    fitHeading.textContent = mood ? `Fits ${mood.name}` : '';
    otherHeading.textContent = mood ? 'Other grooves' : 'Bundled grooves';
    fitHeading.hidden = fitList.hidden = fittingOptions.length === 0;
    otherHeading.hidden = !mood;
    options = [...fittingOptions, ...otherOptions, ...mineOptions];
  }

  function isOpen(): boolean {
    return !menu.hidden;
  }

  function open() {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }

  function close() {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  function pick(event: MouseEvent, slug: string) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    close();
    button.focus();
    choose(slug);
  }

  function focusOption(index: number) {
    const wrapped = (index + options.length) % options.length;
    options[wrapped].link.focus();
  }

  function chosenIndex(): number {
    return options.findIndex(option => option.slug === jam.slug);
  }

  function focusedIndex(): number {
    return options.findIndex(option => option.link === document.activeElement);
  }

  function targetIndex(key: string): number | null {
    if (key === 'Home') return 0;
    if (key === 'End') return options.length - 1;
    const step = FOCUS_STEP[key];
    if (step === undefined) return null;
    return focusedIndex() + step;
  }

  function openWithArrow(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    open();
    focusOption(chosenIndex());
  }

  function moveFocus(event: KeyboardEvent) {
    const index = targetIndex(event.key);
    if (index === null) return;
    event.preventDefault();
    focusOption(index);
  }

  function closeWithEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    close();
    button.focus();
  }

  function closeWhenFocusLeaves(event: FocusEvent) {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || picker.contains(next)) return;
    close();
  }

  function closeWhenPressedOutside(event: PointerEvent) {
    const target = event.target;
    if (target instanceof Node && picker.contains(target)) return;
    close();
  }

  /** Marks the chosen groove, and tags each of mine that fits the mood, since only bundled grooves sit under "Fits". */
  function show() {
    const { mood } = jam;
    group();
    for (const { slug, link } of options) {
      if (slug === jam.slug) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    for (const { genre, fit } of mineOptions) fit.textContent = mood && moodFits(mood, genre) ? ` · fits ${mood.name}` : '';
  }

  fill();
  return { show, fill };
}
