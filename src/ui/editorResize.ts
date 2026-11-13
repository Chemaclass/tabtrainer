import { pref, setPref } from './storage';

export function editorWidth(preferred: number, available: number) {
  const max = Math.max(240, Math.min(720, available - 368));
  return { min: 240, max, value: Math.max(240, Math.min(max, Math.round(preferred))) };
}
export function editorResize(pane: HTMLElement, handle: HTMLElement, redraw: () => void) {
  let preferred = pref('editorWidth', null);
  let previous = preferred, dragging = false, startX = 0, startWidth = 0;
  const available = () => pane.parentElement!.clientWidth || window.innerWidth;
  const sync = () => {
    const size = editorWidth(preferred ?? (window.innerWidth >= 1600 ? 480 : 400), available());
    document.documentElement.style.setProperty('--editor-width', `${size.value}px`);
    handle.setAttribute('aria-valuemin', String(size.min)); handle.setAttribute('aria-valuemax', String(size.max));
    handle.setAttribute('aria-valuenow', String(size.value)); handle.setAttribute('aria-valuetext', `${size.value} pixels`);
    return size;
  };
  const finish = (cancel = false) => {
    if (!dragging) return;
    dragging = false; document.body.classList.remove('editor-dragging');
    if (cancel) preferred = previous; else setPref('editorWidth', preferred);
    sync(); redraw();
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    previous = preferred; startX = event.clientX; startWidth = pane.getBoundingClientRect().width; dragging = true;
    handle.focus({ preventScroll: true }); handle.setPointerCapture(event.pointerId); document.body.classList.add('editor-dragging'); event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging) return;
    preferred = editorWidth(startWidth + event.clientX - startX, available()).value; sync();
  });
  handle.addEventListener('pointerup', () => finish());
  handle.addEventListener('pointercancel', () => finish(true));
  handle.addEventListener('lostpointercapture', () => finish());
  handle.addEventListener('dblclick', () => { preferred = null; setPref('editorWidth', null); sync(); redraw(); });
  handle.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dragging) { finish(true); return; }
    const size = sync();
    const value = { ArrowLeft: size.value - 24, ArrowRight: size.value + 24, Home: size.min, End: size.max }[event.key];
    if (value === undefined) return;
    event.preventDefault(); event.stopPropagation(); preferred = editorWidth(value, available()).value;
    setPref('editorWidth', preferred); sync(); redraw();
  });
  window.addEventListener('resize', () => { sync(); }); sync();
}
