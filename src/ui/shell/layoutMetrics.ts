import { byId, one } from '../dom';

function publishHeight(element: HTMLElement, variable: string) {
  new ResizeObserver(([e]) => document.documentElement.style.setProperty(variable, `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(element);
}

// iOS Safari keeps 100dvh when the keyboard opens; the visual viewport is the space above the keyboard
function publishVisibleHeight() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const publish = () => document.documentElement.style.setProperty('--visible-h', `${Math.floor(viewport.height)}px`);
  viewport.addEventListener('resize', publish); viewport.addEventListener('scroll', publish); publish();
}

// the player wraps at narrow widths; reserve exactly its height below the page and the sticky editor
export function publishLayoutHeights() {
  publishHeight(one('.player'), '--deck-h');
  publishHeight(one('.top'), '--top-h');
  publishHeight(byId('exerciseContinuation'), '--continuation-h');
  publishHeight(one('.save-state'), '--save-state-h');
  publishHeight(byId('extras'), '--sheet-h');
  publishVisibleHeight();
}
