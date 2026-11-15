import { byId } from '../dom';

export function offlineCache(scope: string) {
  if (!('serviceWorker' in navigator)) return;
  const firstInstall = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register(`${scope}sw.js`, { scope }).catch(() => { /* the app still works online */ });
  if (firstInstall) navigator.serviceWorker.ready.then(() => { byId('offlineReady').textContent = 'Ready to use offline'; });
}
