export function dismissHelpOnBackdrop(dialog: HTMLDialogElement) {
  let outsidePointer: number | null = null;
  const outside = (event: PointerEvent) => {
    const bounds = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  dialog.addEventListener('pointerdown', event => {
    outsidePointer = event.isPrimary && event.button === 0 && outside(event) ? event.pointerId : null;
  });
  dialog.addEventListener('pointerup', event => {
    if (event.isPrimary && event.button === 0 && event.pointerId === outsidePointer && outside(event)) dialog.close();
    outsidePointer = null;
  });
  dialog.addEventListener('pointercancel', () => { outsidePointer = null; });
  dialog.addEventListener('close', () => { outsidePointer = null; });
}
