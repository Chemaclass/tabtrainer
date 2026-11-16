type ElementType<T extends HTMLElement> = abstract new () => T;

function checked<T extends HTMLElement>(found: Element | null, label: string, type: ElementType<T>): T {
  if (!found) throw new Error(`Missing ${label}`);
  if (!(found instanceof type)) throw new Error(`${label} is not a <${type.name}>`);
  return found;
}

export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, type: ElementType<T>): T;
export function byId(id: string, type: ElementType<HTMLElement> = HTMLElement) {
  return checked(document.getElementById(id), `#${id}`, type);
}

export function one(selector: string): HTMLElement;
export function one<T extends HTMLElement>(selector: string, type: ElementType<T>): T;
export function one(selector: string, type: ElementType<HTMLElement> = HTMLElement) {
  return checked(document.querySelector(selector), selector, type);
}

export function textSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

export const fillRange = (range: HTMLInputElement) => range.style.setProperty('--fill', `${((+range.value - +range.min) / (+range.max - +range.min)) * 100}%`);

export function isPlainClick(event: MouseEvent): boolean {
  const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  return !modified && event.button === 0;
}
