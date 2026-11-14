export function closeOnOutside(details: HTMLDetailsElement) {
  document.addEventListener('click', e => {
    if (!details.contains(e.target as Node)) details.open = false;
  });
  details.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); details.open = false; details.querySelector('summary')!.focus(); }
  });
}

export function closeOnChoice(details: HTMLDetailsElement) {
  details.addEventListener('click', e => {
    if ((e.target as Element).closest('button')) {
      const returnFocus = details.contains(document.activeElement);
      details.open = false;
      if (returnFocus) details.querySelector('summary')!.focus();
    }
  });
}
