import { isLibraryKind, type LibraryKind } from '../../app/catalogue';

export function libraryNav(onKind: (kind: LibraryKind) => void) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-kind]')];
  buttons.forEach(button => { button.onclick = () => { if (isLibraryKind(button.dataset.kind)) onKind(button.dataset.kind); }; });
  return {
    show(counts: Record<LibraryKind, number>, current: LibraryKind) {
      buttons.forEach(button => {
        const kind = button.dataset.kind;
        if (isLibraryKind(kind)) {
          const count = button.querySelector<HTMLElement>('.nav-count');
          if (!count) throw new Error(`Missing .nav-count in [data-kind="${kind}"]`);
          count.textContent = String(counts[kind]);
        }
        if (kind === current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
    },
  };
}
