import { byId, one } from '../dom';

type EditorTab = 'text' | 'score';

export function editorTabs(source: HTMLTextAreaElement, redraw: () => void) {
  const layout = one('.layout');
  const tabs = { text: byId('textTab'), score: byId('scoreTab') };
  const dots = { text: byId('textTabDot'), score: byId('scoreTabDot') };
  const caret = { start: 0, end: 0, direction: 'none' as HTMLTextAreaElement['selectionDirection'], scrollTop: 0, scrollLeft: 0 };
  const pageScroll = { text: 0, score: 0 };
  let shown: EditorTab = 'text';

  const keepCaret = () => {
    Object.assign(caret, { start: source.selectionStart, end: source.selectionEnd, direction: source.selectionDirection, scrollTop: source.scrollTop, scrollLeft: source.scrollLeft });
  };
  const restoreCaret = () => {
    source.setSelectionRange(caret.start, caret.end, caret.direction);
    source.scrollTop = caret.scrollTop; source.scrollLeft = caret.scrollLeft;
    source.dispatchEvent(new Event('scroll'));
  };
  const label = (tab: EditorTab, note: string) => tabs[tab].setAttribute('aria-label', note ? `${tabs[tab].dataset.name}, ${note}` : tabs[tab].dataset.name ?? '');

  const select = (tab: EditorTab) => {
    if (tab === shown) return;
    pageScroll[shown] = window.scrollY;
    if (shown === 'text') keepCaret();
    shown = tab;
    layout.classList.toggle('score-tab', tab === 'score');
    for (const name of ['text', 'score'] as const) {
      tabs[name].setAttribute('aria-selected', String(name === tab));
      tabs[name].tabIndex = name === tab ? 0 : -1;
    }
    if (tab === 'text') restoreCaret();
    else { dots.score.hidden = true; label('score', ''); setTimeout(redraw, 50); }
    window.scrollTo(0, pageScroll[tab]);
  };

  tabs.text.onclick = () => select('text');
  tabs.score.onclick = () => select('score');
  byId('editorTabs').addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: EditorTab = shown === 'text' ? 'score' : 'text';
    select(next); tabs[next].focus();
  });
  source.addEventListener('input', () => {
    if (shown !== 'text') return;
    dots.score.hidden = false; label('score', 'changed');
  });

  return {
    showText: () => select('text'),
    showProblems(summary: string, errors: boolean) {
      dots.text.hidden = !summary;
      dots.text.classList.toggle('warn', !errors);
      label('text', summary);
    },
  };
}
