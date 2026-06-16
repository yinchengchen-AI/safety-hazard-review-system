import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'shr-offline';
const VERSION = 1;

export type DraftPhoto = { id: string; reviewId: string; blob: Blob; takenAt: number };
export type DraftReview = {
  id: string;
  caseId: string;
  reviewId: string;
  items: Array<{ itemId: string; result: string; note?: string }>;
  conclusion?: string;
  summary?: string;
  updatedAt: number;
};
export type PendingOp = {
  clientId: string;
  opType: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('reviewId', 'reviewId');
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'clientId' });
        }
      },
    });
  }
  return dbPromise;
}

export const offlineDB = {
  async addPhoto(blob: Blob, reviewId: string): Promise<DraftPhoto> {
    const photo: DraftPhoto = { id: crypto.randomUUID(), reviewId, blob, takenAt: Date.now() };
    const db = await getDB();
    await db.put('photos', photo);
    return photo;
  },
  async getPhotos(reviewId: string): Promise<DraftPhoto[]> {
    const db = await getDB();
    return db.getAllFromIndex('photos', 'reviewId', reviewId);
  },
  async getPhoto(id: string): Promise<DraftPhoto | undefined> {
    const db = await getDB();
    return db.get('photos', id);
  },
  async deletePhoto(id: string) {
    const db = await getDB();
    await db.delete('photos', id);
  },
  async saveDraft(draft: DraftReview) {
    const db = await getDB();
    await db.put('drafts', { ...draft, updatedAt: Date.now() });
  },
  async getDraft(id: string): Promise<DraftReview | undefined> {
    const db = await getDB();
    return db.get('drafts', id);
  },
  async enqueue(op: Omit<PendingOp, 'createdAt' | 'retryCount'>) {
    const db = await getDB();
    await db.put('queue', { ...op, createdAt: Date.now(), retryCount: 0 });
  },
  async listQueue(): Promise<PendingOp[]> {
    const db = await getDB();
    return db.getAll('queue');
  },
  async deleteQueue(clientId: string) {
    const db = await getDB();
    await db.delete('queue', clientId);
  },
  async incRetry(clientId: string) {
    const db = await getDB();
    const op = await db.get('queue', clientId);
    if (op) {
      op.retryCount += 1;
      await db.put('queue', op);
    }
  },
};
