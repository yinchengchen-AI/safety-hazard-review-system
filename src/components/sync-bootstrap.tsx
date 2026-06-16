'use client';
import { useEffect } from 'react';

export function SyncBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@/pwa/sync-worker');
        if (!cancelled) {
          // worker registers window 'online' listener on import; trigger an initial sync
          void mod.syncNow();
        }
      } catch {
        // ignore - the worker is only meaningful in the browser
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
