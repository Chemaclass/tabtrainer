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
