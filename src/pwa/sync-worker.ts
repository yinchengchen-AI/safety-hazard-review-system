import { offlineDB } from './offline-db';

const RETRY_DELAYS = [1000, 5000, 30000];
let syncing = false;

type SyncResult = { synced: number; failed: number };

export async function syncNow(): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const ops = await offlineDB.listQueue();
    for (const op of ops) {
      try {
        const payload = op.payload as { photos?: { id: string; storageKey?: string }[] } | undefined;
        if (payload?.photos?.length) {
          for (const photoMeta of payload.photos) {
            const draft = await offlineDB.getPhoto(photoMeta.id);
            if (draft) {
              const fd = new FormData();
              fd.append('file', draft.blob, `${draft.id}.jpg`);
              const res = await fetch('/api/photos', { method: 'POST', body: fd });
              if (!res.ok) throw new Error('photo upload failed');
              const { storageKey } = (await res.json()) as { storageKey: string };
              photoMeta.storageKey = storageKey;
              await offlineDB.deletePhoto(draft.id);
            }
          }
        }
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [op] }),
        });
        if (!res.ok) throw new Error(`sync failed: ${res.status}`);
        const { results } = (await res.json()) as {
          results: Array<{ clientId: string; status: string }>;
        };
        if (results[0]?.status === 'synced') {
          await offlineDB.deleteQueue(op.clientId);
          synced++;
        } else {
          await scheduleRetry(op.clientId);
          failed++;
        }
      } catch {
        await scheduleRetry(op.clientId);
        failed++;
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}

async function scheduleRetry(clientId: string): Promise<void> {
  await offlineDB.incRetry(clientId);
  const ops = await offlineDB.listQueue();
  const op = ops.find((o) => o.clientId === clientId);
  if (op && op.retryCount >= 3) {
    try {
      await fetch('/api/sync/notify-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
    } catch {
      // best-effort notification
    }
  } else {
    const delay = RETRY_DELAYS[Math.min(op?.retryCount ?? 0, RETRY_DELAYS.length - 1)];
    setTimeout(() => {
      void syncNow();
    }, delay);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void syncNow();
  });
}
