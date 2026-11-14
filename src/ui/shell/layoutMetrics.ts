import { byId, one } from '../dom';

function publishHeight(element: HTMLElement, variable: string) {
  new ResizeObserver(([e]) => document.documentElement.style.setProperty(variable, `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(element);
}

// the player wraps at narrow widths; reserve exactly its height below the page and the sticky editor
export function publishLayoutHeights() {
  publishHeight(one('.player'), '--deck-h');
  publishHeight(one('.top'), '--top-h');
  publishHeight(byId('exerciseContinuation'), '--continuation-h');
  publishHeight(one('.save-state'), '--save-state-h');
}
