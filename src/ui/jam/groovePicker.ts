import { addressOf } from '../../app/address';
import type { Jam, JamGroove } from '../../app/jam';
import { byId, isPlainClick, textSpan } from '../dom';

interface GrooveOption { slug: string; link: HTMLAnchorElement }

const FOCUS_STEP: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

function grooveHref(slug: string): string {
  return addressOf(new URLSearchParams({ view: 'jam', groove: slug }).toString(), import.meta.env.BASE_URL);
}

function grooveLink({ slug, groove }: JamGroove): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'jam-groove';
  link.href = grooveHref(slug);
  link.append(
    textSpan('jam-groove-title', groove.title),
    textSpan('jam-groove-genre', groove.genre),
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
  const mineList = byId('jamMineList', HTMLUListElement);
  const mineEmpty = byId('jamMineEmpty');
  let options: GrooveOption[] = [];

  button.addEventListener('click', toggle);
  button.addEventListener('keydown', openWithArrow);
  menu.addEventListener('keydown', moveFocus);
  picker.addEventListener('keydown', closeWithEscape);
  picker.addEventListener('focusout', closeWhenFocusLeaves);
  document.addEventListener('pointerdown', closeWhenPressedOutside);

  function optionFor(entry: JamGroove): GrooveOption {
    const link = grooveLink(entry);
    link.addEventListener('click', event => pick(event, entry.slug));
    return { slug: entry.slug, link };
  }

  /** Lists every groove again, after one of mine is saved or deleted. */
  function fill() {
    const bundledOptions = jam.list.filter(entry => !entry.mine).map(optionFor);
    const mineOptions = jam.list.filter(entry => entry.mine).map(optionFor);
    options = [...bundledOptions, ...mineOptions];
    bundledList.replaceChildren(...bundledOptions.map(option => listItem(option.link)));
    mineList.replaceChildren(...mineOptions.map(option => listItem(option.link)));
    mineEmpty.hidden = mineOptions.length > 0;
    show();
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

  function show() {
    for (const { slug, link } of options) {
      if (slug === jam.slug) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  fill();
  return { show, fill };
}
