import { describe, expect, it, vi } from 'vitest';
import { playbackShortcut } from '../../src/app/playbackShortcut';

function event(overrides: Partial<KeyboardEvent> = {}) {
  return {
    code: 'Space', target: null, repeat: false, isComposing: false,
    shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    preventDefault: vi.fn(), stopPropagation: vi.fn(), ...overrides,
  };
}

function target(selector: string) {
  return { closest: (selectors: string) => selectors.includes(selector) ? {} : null } as unknown as EventTarget;
}

describe('playback shortcut', () => {
  it('plays once for a held press and consumes its release', () => {
    const play = vi.fn(), pause = vi.fn();
    const shortcut = playbackShortcut(() => true, () => false, play, pause);
    const down = event(), repeat = event({ repeat: true }), up = event();
    shortcut.keydown(down); shortcut.keydown(repeat); shortcut.keyup(up);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
    for (const e of [down, repeat, up]) {
      expect(e.preventDefault).toHaveBeenCalledOnce();
      expect(e.stopPropagation).toHaveBeenCalledOnce();
    }
  });

  it('pauses while playing and plays again after release', () => {
    let playing = true;
    const pause = vi.fn(() => { playing = false; }), play = vi.fn();
    const shortcut = playbackShortcut(() => true, () => playing, play, pause);
    shortcut.keydown(event()); shortcut.keyup(event()); shortcut.keydown(event());
    expect(pause).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });

  it('leaves native controls and nested editable targets alone', () => {
    const play = vi.fn();
    const shortcut = playbackShortcut(() => true, () => false, play, vi.fn());
    for (const selector of ['input', 'select', 'textarea', '[contenteditable]', 'dialog', 'summary', '.file-menu', '[role="menu"]', '[role="menuitem"]', '[role="combobox"]', '[role="listbox"]', '[role="option"]', '[role="separator"]']) {
      const down = event({ target: target(selector) });
      shortcut.keydown(down);
      expect(down.preventDefault).not.toHaveBeenCalled();
    }
    expect(play).not.toHaveBeenCalled();
  });

  it('ignores modifiers, composition, unclaimed repeats and other screens', () => {
    const play = vi.fn();
    const shortcut = playbackShortcut(() => true, () => false, play, vi.fn());
    for (const overrides of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { repeat: true }, { code: 'Enter' }]) {
      const down = event(overrides);
      shortcut.keydown(down);
      expect(down.preventDefault).not.toHaveBeenCalled();
    }
    playbackShortcut(() => false, () => false, play, vi.fn()).keydown(event());
    expect(play).not.toHaveBeenCalled();
  });

  it('consumes only a claimed release and clears it on blur', () => {
    const shortcut = playbackShortcut(() => true, () => false, vi.fn(), vi.fn());
    const unclaimed = event(); shortcut.keyup(unclaimed);
    expect(unclaimed.preventDefault).not.toHaveBeenCalled();
    shortcut.keydown(event()); shortcut.blur();
    const afterBlur = event(); shortcut.keyup(afterBlur);
    expect(afterBlur.preventDefault).not.toHaveBeenCalled();
  });
});
