import { byId, one } from '../dom';

type EditorTab = 'text' | 'score';

const startOfText = () => ({ start: 0, end: 0, direction: 'none' as HTMLTextAreaElement['selectionDirection'], scrollTop: 0, scrollLeft: 0, focused: false });
const tabKeys: Record<string, (shown: EditorTab) => EditorTab> = {
  ArrowLeft: shown => shown === 'text' ? 'score' : 'text',
  ArrowRight: shown => shown === 'text' ? 'score' : 'text',
  Home: () => 'text',
  End: () => 'score',
};

export function editorTabs(source: HTMLTextAreaElement, open: () => boolean, redraw: () => void) {
  const layout = one('.layout');
  const tabList = byId('editorTabs');
  const tabs = { text: byId('textTab'), score: byId('scoreTab') };
  const panes = { text: byId('editorPane'), score: byId('scorePane') };
  const dots = { text: byId('textTabDot'), score: byId('scoreTabDot') };
  const phone = window.matchMedia('(max-width:599px)');
  let caret = startOfText();
  let pageScroll = { text: 0, score: 0 };
  let shown: EditorTab = 'text';
  let textFocused = false;

  const keepCaret = () => {
    caret = { start: source.selectionStart, end: source.selectionEnd, direction: source.selectionDirection, scrollTop: source.scrollTop, scrollLeft: source.scrollLeft, focused: textFocused };
  };
  const restoreCaret = () => {
    source.setSelectionRange(caret.start, caret.end, caret.direction);
    source.scrollTop = caret.scrollTop; source.scrollLeft = caret.scrollLeft;
    source.dispatchEvent(new Event('scroll'));
    if (caret.focused) source.focus({ preventScroll: true });
  };
  const label = (tab: EditorTab, note: string) => tabs[tab].setAttribute('aria-label', note ? `${tabs[tab].dataset.name}, ${note}` : tabs[tab].dataset.name ?? '');
  const showChanged = (changed: boolean) => { dots.score.hidden = !changed; label('score', changed ? 'changed' : ''); };

  const mark = (tab: EditorTab) => {
    shown = tab;
    layout.classList.toggle('score-tab', tab === 'score');
    for (const name of ['text', 'score'] as const) {
      tabs[name].setAttribute('aria-selected', String(name === tab));
      tabs[name].tabIndex = name === tab ? 0 : -1;
    }
  };
  const describePanes = () => {
    const inUse = phone.matches && open();
    for (const name of ['text', 'score'] as const) {
      if (inUse) { panes[name].setAttribute('role', 'tabpanel'); panes[name].setAttribute('aria-labelledby', tabs[name].id); }
      else { panes[name].removeAttribute('role'); panes[name].removeAttribute('aria-labelledby'); }
    }
  };

  const select = (tab: EditorTab) => {
    if (tab === shown) return;
    pageScroll[shown] = window.scrollY;
    if (shown === 'text') keepCaret();
    mark(tab);
    if (tab === 'text') restoreCaret();
    else { showChanged(false); setTimeout(redraw, 50); }
    window.scrollTo(0, pageScroll[tab]);
  };

  tabs.text.onclick = () => select('text');
  tabs.score.onclick = () => select('score');
  tabList.addEventListener('pointerdown', () => { textFocused = document.activeElement === source; });
  tabList.addEventListener('keydown', event => {
    const next = tabKeys[event.key]?.(shown);
    if (!next) return;
    event.preventDefault(); textFocused = false;
    select(next); tabs[next].focus();
  });
  source.addEventListener('input', () => { if (shown === 'text') showChanged(true); });
  phone.addEventListener('change', () => { mark('text'); describePanes(); });

  return {
    scoreShown: () => phone.matches && shown === 'score',
    opened() { showChanged(false); select('text'); describePanes(); },
    closed: describePanes,
    reset() { caret = startOfText(); pageScroll = { text: 0, score: 0 }; showChanged(false); },
    showProblems(summary: string, errors: boolean) {
      dots.text.hidden = !summary;
      dots.text.classList.toggle('warn', !errors);
      label('text', summary);
    },
  };
}
