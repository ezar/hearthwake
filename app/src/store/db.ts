// A small promise wrapper over IndexedDB: one database, one object store per kind of record.
const DB_NAME = 'hearthwake';
const DB_VERSION = 1;
export const STORES = ['souls', 'settings'] as const;
export type StoreName = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('Could not open the database'));
    };
  });
  return opening;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  act: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = act(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? req.error ?? new Error('Database error'));
      }),
  );
}

export const dbGet = <T>(store: StoreName, key: string) =>
  run<T | undefined>(store, 'readonly', s => s.get(key));
export const dbGetAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', s => s.getAll());
export const dbPut = (store: StoreName, key: string, value: unknown) =>
  run(store, 'readwrite', s => s.put(value, key)).then(() => undefined);
export const dbDelete = (store: StoreName, key: string) =>
  run(store, 'readwrite', s => s.delete(key)).then(() => undefined);

// Tests start each case from an empty database.
export async function resetDbForTests(): Promise<void> {
  if (opening) (await opening).close();
  opening = null;
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
