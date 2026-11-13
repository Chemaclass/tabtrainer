interface ShortcutTarget {
  closest(selectors: string): unknown;
}

interface ShortcutEvent {
  code: string;
  target: EventTarget | null;
  repeat: boolean;
  isComposing: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

const nativeControls = 'input, select, textarea, [contenteditable], dialog, summary, .file-menu, [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="combobox"], [role="listbox"], [role="option"], [role="separator"]';

function hasNativeSpace(target: EventTarget | null): boolean {
  if (!target || !('closest' in target) || typeof target.closest !== 'function') return false;
  return Boolean((target as ShortcutTarget).closest(nativeControls));
}

export function playbackShortcut(active: () => boolean, playing: () => boolean, play: () => void, pause: () => void) {
  let claimed = false;
  const consume = (event: ShortcutEvent) => { event.preventDefault(); event.stopPropagation(); };
  return {
    keydown(event: ShortcutEvent) {
      if (event.code !== 'Space') return;
      if (claimed) { consume(event); return; }
      if (!active() || event.repeat || event.isComposing || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || hasNativeSpace(event.target)) return;
      claimed = true;
      consume(event);
      if (playing()) pause(); else play();
    },
    keyup(event: ShortcutEvent) {
      if (event.code !== 'Space' || !claimed) return;
      claimed = false;
      consume(event);
    },
    blur() { claimed = false; },
  };
}
