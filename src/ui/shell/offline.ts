import { byId } from '../dom';

export async function offlineCache(scope: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const installed = await navigator.serviceWorker.getRegistration(scope);
    await navigator.serviceWorker.register(`${scope}sw.js`, { scope });
    if (installed) return;
    await navigator.serviceWorker.ready;
    byId('offlineReady').textContent = 'Ready to use offline';
  } catch { /* the app still works online */ }
}
