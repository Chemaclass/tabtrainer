import { isLibraryKind, shownCount, type LibraryKind } from '../../app/catalogue';

const onLanding = () => document.documentElement.classList.contains('landing');

export function libraryNav(onKind: (kind: LibraryKind) => void) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-kind]')];
  buttons.forEach(button => { button.onclick = () => { if (isLibraryKind(button.dataset.kind)) onKind(button.dataset.kind); }; });
  return {
    show(counts: Record<LibraryKind, number>, current: LibraryKind | null) {
      buttons.forEach(button => {
        const kind = button.dataset.kind;
        if (isLibraryKind(kind)) {
          const count = button.querySelector<HTMLElement>('.nav-count');
          if (!count) throw new Error(`Missing .nav-count in [data-kind="${kind}"]`);
          count.textContent = shownCount(counts[kind]);
        }
        if (kind === current && !onLanding()) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
    },
  };
}
