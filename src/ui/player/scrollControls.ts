import { pref, setPref } from '../../app/storage';
import { AutoScroller } from '../../app/scrolling';
import { byId, fillRange } from '../dom';
import { setSelectValue } from '../shell/dropdown';

type ScrollMode = 'off' | 'follow' | 'continuous';

export function scrollControls(active: () => boolean, onFollow: () => void) {
  let current: ScrollMode = 'follow';
  const rate = byId('scrollSpeed', HTMLInputElement); rate.value = String(pref('scroll', 15));
  fillRange(rate);
  rate.oninput = () => { setPref('scroll', +rate.value); fillRange(rate); };
  const scroller = new AutoScroller({
    request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    scroll: pixels => window.scrollBy(0, pixels), speed: () => +rate.value,
    atBottom: () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2,
    ended: () => set('off'),
  });
  function set(mode: ScrollMode) {
    scroller.stop(); current = mode;
    setSelectValue(byId('scrollMode', HTMLSelectElement), mode);
    byId('scrollRate').hidden = mode !== 'continuous';
    byId('scrollHelp').textContent = { off: 'Scroll the score yourself.', follow: 'Keep the playing line in view.', continuous: 'Scroll without audio. Play and Pause keep scrolling; Stop and song changes turn it off.' }[mode];
    if (mode === 'continuous') scroller.start();
    if (mode === 'follow') onFollow();
  }
  byId('scrollMode', HTMLSelectElement).onchange = e => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'off' || value === 'follow' || value === 'continuous') set(value);
  };
  document.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (!active() || t.closest('button, summary, input, select, textarea, dialog, [role=separator]') || t.isContentEditable) return;
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); set(current === 'continuous' ? 'off' : 'continuous'); }
    else if (current === 'continuous' && e.key === 'ArrowUp') { e.preventDefault(); rate.value = String(Math.min(80, +rate.value + 2)); rate.dispatchEvent(new Event('input')); }
    else if (current === 'continuous' && e.key === 'ArrowDown') { e.preventDefault(); rate.value = String(Math.max(3, +rate.value - 2)); rate.dispatchEvent(new Event('input')); }
  });
  return {
    follows: () => current === 'follow',
    stopContinuous: () => { if (current === 'continuous') set('off'); },
  };
}
