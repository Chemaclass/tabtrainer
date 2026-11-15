import { describe, expect, it } from 'vitest';
import { barAfter, practiceKey, type PracticeKeyEvent, type PracticeKeyState } from '../../src/app/practiceKeys';

function event(key: string, overrides: Partial<PracticeKeyEvent> = {}): PracticeKeyEvent {
  return { key, target: null, repeat: false, isComposing: false, defaultPrevented: false, ctrlKey: false, altKey: false, metaKey: false, ...overrides };
}

const stopped: PracticeKeyState = { active: true, dialogOpen: false, playing: false, scrolling: false };

function target(selector: string) {
  return { closest: (selectors: string) => selectors.split(', ').includes(selector) ? {} : null } as unknown as EventTarget;
}

describe('practice keys', () => {
  it('restarts with Enter and Page Down', () => {
    expect(practiceKey(event('Enter'), stopped)).toEqual({ kind: 'restart' });
    expect(practiceKey(event('PageDown'), stopped)).toEqual({ kind: 'restart' });
  });

  it('goes back a bar with Page Up, even while playing', () => {
    expect(practiceKey(event('PageUp'), { ...stopped, playing: true })).toEqual({ kind: 'bar', step: -1 });
  });

  it('toggles the loop with L', () => {
    expect(practiceKey(event('l'), stopped)).toEqual({ kind: 'loop' });
    expect(practiceKey(event('L'), stopped)).toEqual({ kind: 'loop' });
  });

  it('sets the loop start and end with [ and ]', () => {
    expect(practiceKey(event('['), stopped)).toEqual({ kind: 'loopStart' });
    expect(practiceKey(event(']'), stopped)).toEqual({ kind: 'loopEnd' });
  });

  it('nudges the speed by 5 points with - and =', () => {
    expect(practiceKey(event('-'), stopped)).toEqual({ kind: 'nudgeSpeed', by: -5 });
    expect(practiceKey(event('='), stopped)).toEqual({ kind: 'nudgeSpeed', by: 5 });
    expect(practiceKey(event('+'), stopped)).toEqual({ kind: 'nudgeSpeed', by: 5 });
  });

  it('jumps to 50, 75 and 100% with 1, 2 and 3', () => {
    expect(practiceKey(event('1'), stopped)).toEqual({ kind: 'speed', percent: 50 });
    expect(practiceKey(event('2'), stopped)).toEqual({ kind: 'speed', percent: 75 });
    expect(practiceKey(event('3'), stopped)).toEqual({ kind: 'speed', percent: 100 });
  });

  it('steps through bars with Left and Right only while stopped or paused', () => {
    expect(practiceKey(event('ArrowLeft'), stopped)).toEqual({ kind: 'bar', step: -1 });
    expect(practiceKey(event('ArrowRight'), stopped)).toEqual({ kind: 'bar', step: 1 });
    expect(practiceKey(event('ArrowLeft'), { ...stopped, playing: true })).toBeNull();
    expect(practiceKey(event('ArrowRight'), { ...stopped, playing: true })).toBeNull();
  });

  it('toggles the metronome with M', () => {
    expect(practiceKey(event('m'), stopped)).toEqual({ kind: 'metronome' });
    expect(practiceKey(event('M'), stopped)).toEqual({ kind: 'metronome' });
  });

  it('toggles continuous scrolling with S and changes its speed with Up and Down', () => {
    expect(practiceKey(event('s'), stopped)).toEqual({ kind: 'scroll' });
    expect(practiceKey(event('ArrowUp'), stopped)).toBeNull();
    expect(practiceKey(event('ArrowDown'), stopped)).toBeNull();
    const scrolling = { ...stopped, scrolling: true };
    expect(practiceKey(event('ArrowUp'), scrolling)).toEqual({ kind: 'scrollRate', by: 2 });
    expect(practiceKey(event('ArrowDown'), scrolling)).toEqual({ kind: 'scrollRate', by: -2 });
  });

  it('opens the shortcut sheet with ?', () => {
    expect(practiceKey(event('?'), stopped)).toEqual({ kind: 'shortcuts' });
  });

  it('leaves Space and unknown keys to others', () => {
    expect(practiceKey(event(' '), stopped)).toBeNull();
    expect(practiceKey(event('x'), stopped)).toBeNull();
  });

  it('ignores every key inside fields and open dialogs', () => {
    for (const key of ['Enter', 'PageDown', 'PageUp', 'l', '[', ']', '-', '=', '1', 'ArrowLeft', 'm', 's', '?']) {
      for (const field of ['input', 'textarea', 'select', '[contenteditable]', 'dialog']) {
        expect(practiceKey(event(key, { target: target(field) }), stopped)).toBeNull();
      }
      expect(practiceKey(event(key), { ...stopped, dialogOpen: true })).toBeNull();
    }
  });

  it('keeps Enter and arrows for focused buttons and sliders, but takes letters there', () => {
    for (const control of ['button', '[role="slider"]']) {
      expect(practiceKey(event('Enter', { target: target(control) }), stopped)).toBeNull();
      expect(practiceKey(event('ArrowRight', { target: target(control) }), stopped)).toBeNull();
      expect(practiceKey(event('l', { target: target(control) }), stopped)).toEqual({ kind: 'loop' });
      expect(practiceKey(event('PageDown', { target: target(control) }), stopped)).toEqual({ kind: 'restart' });
    }
  });

  it('ignores modifiers, composition, handled keys and other screens', () => {
    for (const overrides of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }]) {
      expect(practiceKey(event('l', overrides), stopped)).toBeNull();
    }
    expect(practiceKey(event('l'), { ...stopped, active: false })).toBeNull();
  });

  it('repeats only the stepping keys while held', () => {
    expect(practiceKey(event('=', { repeat: true }), stopped)).toEqual({ kind: 'nudgeSpeed', by: 5 });
    expect(practiceKey(event('PageUp', { repeat: true }), stopped)).toEqual({ kind: 'bar', step: -1 });
    expect(practiceKey(event('l', { repeat: true }), stopped)).toBeNull();
    expect(practiceKey(event('Enter', { repeat: true }), stopped)).toBeNull();
  });
});

describe('bar after a step', () => {
  it('stays inside the song and starts at the first bar with nothing selected', () => {
    expect(barAfter(3, 1, 8)).toBe(4);
    expect(barAfter(3, -1, 8)).toBe(2);
    expect(barAfter(1, -1, 8)).toBe(1);
    expect(barAfter(8, 1, 8)).toBe(8);
    expect(barAfter(0, 1, 8)).toBe(1);
    expect(barAfter(0, -1, 8)).toBe(1);
    expect(barAfter(0, 1, 0)).toBeNull();
  });
});
