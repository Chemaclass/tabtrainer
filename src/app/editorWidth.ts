export function editorWidth(preferred: number, available: number) {
  const max = Math.max(240, Math.min(720, available - 368));
  return { min: 240, max, value: Math.max(240, Math.min(max, Math.round(preferred))) };
}
