import { byId } from '../dom';

interface PassageControlState { first: number; last: number; count: number; repeat: boolean; selected: number; active: boolean }

export function passageControls(handlers: { onRange: (first: number, last: number, repeat: boolean) => void; onStart: () => void; onEnd: () => void; onReset: () => void }) {
  const first = byId('loopA', HTMLInputElement), last = byId('loopB', HTMLInputElement), repeat = byId('loopChk', HTMLInputElement);
  const start = byId('rangeStart', HTMLButtonElement), end = byId('rangeEnd', HTMLButtonElement), reset = byId('rangeReset', HTMLButtonElement);
  start.onclick = handlers.onStart;
  end.onclick = handlers.onEnd;
  reset.onclick = handlers.onReset;
  [repeat, first, last].forEach(input => input.addEventListener('change', () => handlers.onRange(first.valueAsNumber, last.valueAsNumber, repeat.checked)));
  return {
    show(state: PassageControlState, summary: string) {
      first.value = String(state.first);
      last.value = String(state.last);
      first.max = last.max = String(state.count);
      repeat.checked = state.repeat;
      start.disabled = end.disabled = !state.selected;
      reset.disabled = !state.selected && !state.active;
      byId('rangeSummary').textContent = summary;
    },
  };
}
