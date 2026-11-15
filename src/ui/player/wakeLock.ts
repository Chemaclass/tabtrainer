import { ScreenAwake, type AwakeSource } from '../../app/screenAwake';

export function screenWakeLock() {
  const awake = new ScreenAwake();
  let pending = false;
  let sentinel: WakeLockSentinel | null = null;

  async function request() {
    if (!('wakeLock' in navigator) || sentinel || pending || document.visibilityState !== 'visible') return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null; });
      if (awake.wanted) sentinel = lock; else void lock.release();
    } catch { sentinel = null; } finally { pending = false; }
  }

  function release() {
    const lock = sentinel; sentinel = null;
    if (lock) void lock.release();
  }

  document.addEventListener('visibilitychange', () => { if (awake.wanted) void request(); });

  return {
    keep(source: AwakeSource, active: boolean) {
      const wasWanted = awake.wanted;
      awake.keep(source, active);
      if (awake.wanted && !wasWanted) void request();
      else if (!awake.wanted && wasWanted) release();
    },
  };
}
