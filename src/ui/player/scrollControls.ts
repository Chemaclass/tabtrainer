import { pref, setPref } from '../../app/storage';
import { AutoScroller } from '../../app/scrolling';
import { byId, fillRange } from '../dom';
import { setSelectValue } from '../shell/dropdown';

type ScrollMode = 'off' | 'follow' | 'continuous';

export function scrollControls(onFollow: () => void, onContinuous: (running: boolean) => void) {
  let current: ScrollMode = 'follow';
  const rate = byId('scrollSpeed', HTMLInputElement); rate.value = String(pref('scroll', 15));
  fillRange(rate);
  rate.oninput = () => { setPref('scroll', +rate.value); fillRange(rate); };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lineHeight = () => document.querySelector<HTMLElement>('.system')?.offsetHeight ?? window.innerHeight / 2;
  const scroller = new AutoScroller({
    request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    scroll: pixels => window.scrollBy(0, pixels), speed: () => +rate.value,
    stride: () => reducedMotion.matches ? lineHeight() : 1,
    atBottom: () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2,
    ended: () => set('off'),
  });
  function set(mode: ScrollMode) {
    scroller.stop(); current = mode;
    setSelectValue(byId('scrollMode', HTMLSelectElement), mode);
    byId('scrollRate').hidden = mode !== 'continuous';
    byId('scrollHelp').textContent = { off: 'Scroll the score yourself.', follow: 'Keep the playing line in view.', continuous: 'Scroll without audio. Play and Pause keep scrolling; Stop and song changes turn it off.' }[mode];
    if (mode === 'continuous') scroller.start();
    onContinuous(mode === 'continuous');
    if (mode === 'follow') onFollow();
  }
  byId('scrollMode', HTMLSelectElement).onchange = e => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'off' || value === 'follow' || value === 'continuous') set(value);
  };
  return {
    follows: () => current === 'follow',
    continuous: () => current === 'continuous',
    toggleContinuous: () => set(current === 'continuous' ? 'off' : 'continuous'),
    nudgeRate: (by: number) => { rate.value = String(+rate.value + by); rate.dispatchEvent(new Event('input')); },
    stopContinuous: () => { if (current === 'continuous') set('off'); },
  };
}
