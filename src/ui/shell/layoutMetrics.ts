export function publishHeight(element: HTMLElement, variable: string) {
  new ResizeObserver(([e]) => document.documentElement.style.setProperty(variable, `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(element);
}
