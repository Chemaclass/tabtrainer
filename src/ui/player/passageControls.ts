import { byId } from '../dom';

interface PassageControlState { first: number; last: number; count: number; repeat: boolean; selected: number; active: boolean; loopsSelection: boolean }

export function passageControls(handlers: { onRange: (first: number, last: number, repeat: boolean) => void; onStart: () => void; onEnd: () => void; onLoopBar: () => void; onReset: () => void }) {
  const first = byId('loopA', HTMLInputElement), last = byId('loopB', HTMLInputElement), repeat = byId('loopChk', HTMLInputElement);
  const loopBar = byId('loopBar', HTMLButtonElement);
  const starts = [byId('rangeStart', HTMLButtonElement), byId('deckRangeStart', HTMLButtonElement)];
  const ends = [byId('rangeEnd', HTMLButtonElement), byId('deckRangeEnd', HTMLButtonElement)];
  const reset = byId('rangeReset', HTMLButtonElement);
  starts.forEach(start => { start.onclick = handlers.onStart; });
  ends.forEach(end => { end.onclick = handlers.onEnd; });
  reset.onclick = handlers.onReset;
  loopBar.onclick = handlers.onLoopBar;
  [repeat, first, last].forEach(input => input.addEventListener('change', () => handlers.onRange(first.valueAsNumber, last.valueAsNumber, repeat.checked)));
  return {
    show(state: PassageControlState, summary: string) {
      first.value = String(state.first);
      last.value = String(state.last);
      first.max = last.max = String(state.count);
      repeat.checked = state.repeat;
      [...starts, ...ends].forEach(button => { button.disabled = !state.selected; });
      loopBar.hidden = !state.selected || state.loopsSelection;
      reset.disabled = !state.selected && !state.active;
      byId('rangeSummary').textContent = summary;
    },
  };
}
