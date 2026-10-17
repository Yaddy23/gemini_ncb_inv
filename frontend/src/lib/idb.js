// Tiny promise-based IndexedDB wrapper shared by the app and the service
// worker. Must stay environment-agnostic: no window/localStorage/axios here,
// only globalThis.indexedDB (available in both window and worker contexts).

const DB_NAME = 'bims-offline';
const DB_VERSION = 2;
export const STORE_QUEUE = 'queue';     // offline scan queue items
export const STORE_CATALOG = 'catalog'; // offline book catalog {ISBN, TITLE, QTY, reservedQty}
export const STORE_SETTINGS = 'settings'; // key/value records (e.g. current access token)

let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG, { keyPath: 'ISBN' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Wrap an IDBRequest in a promise
function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function objectStore(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function idbPut(name, value) {
  const store = await objectStore(name, 'readwrite');
  return wrap(store.put(value));
}

// Replace the entire contents of a store in a single transaction
// (used for catalog refreshes)
export async function idbReplaceAll(name, values) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    store.clear();
    values.forEach(value => store.put(value));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll(name) {
  const store = await objectStore(name, 'readonly');
  return wrap(store.getAll());
}

export async function idbGet(name, key) {
  const store = await objectStore(name, 'readonly');
  return wrap(store.get(key));
}

export async function idbDelete(name, key) {
  const store = await objectStore(name, 'readwrite');
  return wrap(store.delete(key));
}

export async function idbClear(name) {
  const store = await objectStore(name, 'readwrite');
  return wrap(store.clear());
}
