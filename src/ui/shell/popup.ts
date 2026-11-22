interface PopupOptions {
  /** Where focus goes on open; the panel itself when missing. */
  focus?: () => HTMLElement;
  /** Presses and focus on these elements leave the panel open. */
  keepOpenFor?: readonly HTMLElement[];
  /** While true, presses and focus elsewhere on the page leave the panel open; Esc and close() still close it. */
  pinned?: () => boolean;
  closed?: () => void;
}

export interface Popup {
  open(): void;
  close(returnFocus?: boolean): void;
  readonly isOpen: boolean;
}

const openPopups: Popup[] = [];

// The discard question is a modal dialog over the page, so presses, focus and Esc inside it belong to it
const inDialog = (target: EventTarget | null) => target instanceof Element && target.closest('dialog') !== null;

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || inDialog(event.target)) return;
  const last = openPopups.at(-1);
  if (!last) return;
  event.preventDefault();
  last.close(true);
});

/**
 * A panel a button opens over the page without making the rest of it inert, so Play and the chips keep working.
 * Esc, a click outside or focus moving away closes it.
 */
export function popup(button: HTMLButtonElement, panel: HTMLElement, { focus, keepOpenFor = [], pinned = () => false, closed }: PopupOptions = {}): Popup {
  const keepsOpen = (target: EventTarget | null) =>
    pinned() || (target instanceof Node && (panel.contains(target) || button.contains(target) || keepOpenFor.some(element => element.contains(target)) || inDialog(target)));

  const handle: Popup = {
    open() {
      if (handle.isOpen) return;
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openPopups.push(handle);
      (focus?.() ?? panel).focus();
    },
    close(returnFocus = false) {
      if (!handle.isOpen) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      openPopups.splice(openPopups.indexOf(handle), 1);
      if (returnFocus) button.focus();
      closed?.();
    },
    get isOpen() { return !panel.hidden; },
  };

  button.addEventListener('click', () => {
    if (handle.isOpen) handle.close();
    else handle.open();
  });
  // On click rather than pointerdown, so the press that closes the panel still reaches what it pressed
  document.addEventListener('click', event => {
    if (handle.isOpen && !keepsOpen(event.target)) handle.close();
  });
  panel.addEventListener('focusout', event => {
    // A null target is the window losing focus, as when the file chooser opens
    if (event.relatedTarget instanceof Element && !keepsOpen(event.relatedTarget)) handle.close();
  });
  return handle;
}
