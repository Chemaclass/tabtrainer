import { insideAny, nativeControls } from './playbackShortcut';

export type PracticeAction =
  | { kind: 'restart' }
  | { kind: 'loop' }
  | { kind: 'loopStart' }
  | { kind: 'loopEnd' }
  | { kind: 'nudgeSpeed'; by: number }
  | { kind: 'speed'; percent: number }
  | { kind: 'bar'; step: -1 | 1 }
  | { kind: 'metronome' }
  | { kind: 'scroll' }
  | { kind: 'scrollRate'; by: number }
  | { kind: 'shortcuts' };

export interface PracticeKeyEvent {
  key: string;
  target: EventTarget | null;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface PracticeKeyState {
  active: boolean;
  dialogOpen: boolean;
  playing: boolean;
  scrolling: boolean;
}

interface Binding { action: PracticeAction; native?: boolean; repeats?: boolean }

const typingControls = 'input, select, textarea, [contenteditable], dialog, .file-menu, [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="combobox"], [role="listbox"], [role="option"]';
const speedStep = 5;
const scrollRateStep = 2;

function bindingFor(key: string, state: PracticeKeyState): Binding | null {
  switch (key) {
    case 'Enter': return { action: { kind: 'restart' }, native: true };
    case 'PageDown': return { action: { kind: 'restart' } };
    case 'PageUp': return { action: { kind: 'bar', step: -1 }, repeats: true };
    case 'l': case 'L': return { action: { kind: 'loop' } };
    case '[': return { action: { kind: 'loopStart' } };
    case ']': return { action: { kind: 'loopEnd' } };
    case '-': return { action: { kind: 'nudgeSpeed', by: -speedStep }, repeats: true };
    case '=': case '+': return { action: { kind: 'nudgeSpeed', by: speedStep }, repeats: true };
    case '1': return { action: { kind: 'speed', percent: 50 } };
    case '2': return { action: { kind: 'speed', percent: 75 } };
    case '3': return { action: { kind: 'speed', percent: 100 } };
    case 'ArrowLeft': return state.playing ? null : { action: { kind: 'bar', step: -1 }, native: true, repeats: true };
    case 'ArrowRight': return state.playing ? null : { action: { kind: 'bar', step: 1 }, native: true, repeats: true };
    case 'ArrowUp': return state.scrolling ? { action: { kind: 'scrollRate', by: scrollRateStep }, native: true, repeats: true } : null;
    case 'ArrowDown': return state.scrolling ? { action: { kind: 'scrollRate', by: -scrollRateStep }, native: true, repeats: true } : null;
    case 'm': case 'M': return { action: { kind: 'metronome' } };
    case 's': case 'S': return { action: { kind: 'scroll' } };
    case '?': return { action: { kind: 'shortcuts' } };
    default: return null;
  }
}

export function practiceKey(event: PracticeKeyEvent, state: PracticeKeyState): PracticeAction | null {
  if (!state.active || state.dialogOpen || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return null;
  const binding = bindingFor(event.key, state);
  if (!binding || (event.repeat && !binding.repeats)) return null;
  return insideAny(event.target, binding.native ? nativeControls : typingControls) ? null : binding.action;
}

export function barAfter(current: number, step: -1 | 1, count: number): number | null {
  if (count < 1) return null;
  return Math.min(count, Math.max(1, current + step));
}
