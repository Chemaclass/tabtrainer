export function screenWakeLock() {
  let wanted = false;
  let pending = false;
  let sentinel: WakeLockSentinel | null = null;

  async function request() {
    if (!('wakeLock' in navigator) || sentinel || pending || document.visibilityState !== 'visible') return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null; });
      if (wanted) sentinel = lock; else void lock.release();
    } catch { sentinel = null; } finally { pending = false; }
  }

  document.addEventListener('visibilitychange', () => { if (wanted) void request(); });

  return {
    hold() { if (wanted) return; wanted = true; void request(); },
    release() {
      wanted = false;
      const lock = sentinel; sentinel = null;
      if (lock) void lock.release();
    },
  };
}
