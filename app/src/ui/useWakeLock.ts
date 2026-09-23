// Keeps the screen on during long waits (the first download, waking a thing), where a locked phone
// would pause the page. Best effort: browsers without the Wake Lock API just let the screen sleep.
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = () =>
      navigator.wakeLock
        .request('screen')
        .then(l => {
          if (released) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    // The lock is dropped when the page is hidden; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
