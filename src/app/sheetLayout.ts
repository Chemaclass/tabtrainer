export type ZoomStep = 'in' | 'out';

export function barsPerLine(width: number, zoom: number, notation: boolean) {
  return Math.max(1, Math.min(8, Math.round((width / zoom) / (notation ? 300 : 240))));
}

export function nextZoom(zoom: number, step: ZoomStep) {
  return step === 'in' ? Math.min(1.8, +(zoom + 0.1).toFixed(2)) : Math.max(0.6, +(zoom - 0.1).toFixed(2));
}
