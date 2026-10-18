// Drawings are stored in IndexedDB as PNG blobs keyed by animal id, so replacing an
// animal's SVG never breaks storage. Bump DB_VERSION and add a migration step in
// upgrade() whenever the schema changes; existing drawings must be carried forward.

export const DB_NAME = 'color-critters';
export const DB_VERSION = 1;
const STORE = 'drawings';

export interface DrawingRecord {
  id: string;
  png: Blob;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore(STORE, { keyPath: 'id' });
  }
  // Future: if (oldVersion < 2) { ... migrate ... }
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Let a newer app version upgrade the schema without being blocked by this tab.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function saveDrawing(id: string, png: Blob): Promise<void> {
  const record: DrawingRecord = { id, png, updatedAt: Date.now() };
  await run('readwrite', (s) => s.put(record));
}

export async function loadDrawing(id: string): Promise<Blob | undefined> {
  const record = await run<DrawingRecord | undefined>('readonly', (s) => s.get(id));
  return record?.png;
}

export async function clearDrawing(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/** For tests: drop the cached connection. */
export function closeDb(): void {
  void dbPromise?.then((db) => db.close()).catch(() => undefined);
  dbPromise = null;
}
