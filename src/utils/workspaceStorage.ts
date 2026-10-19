import { WORKSPACE_ID } from '../config/workspace';

// Old workspaces and Firebase authentication keep their original storage.
const scopedKey = (key: string) => `liare:${WORKSPACE_ID}:${key}`;
const pendingValues = new Map<string, string | null>();
const failedKeys = new Set<string>();
const listeners = new Set<() => void>();
function changed(key: string, failed: boolean) {
  const wasLimited = failedKeys.size > 0;
  if (failed) failedKeys.add(key); else failedKeys.delete(key);
  if (wasLimited !== (failedKeys.size > 0)) listeners.forEach(listener => listener());
}
let database: IDBDatabase | null = null;
const durableValues = new Map<string, string>();
const versions = new Map<string, number>();

// IndexedDB has a separate, larger quota than localStorage. Hydrate before React
// reads the workspace so an older localStorage snapshot cannot win on restart.
export async function initializeWorkspaceStorage(): Promise<void> {
  if (!globalThis.indexedDB) return;
  try {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(`liare:${WORKSPACE_ID}:cache`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('values');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cache bloqueado'));
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction('values', 'readonly');
      const request = transaction.objectStore('values').openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { durableValues.set(String(cursor.key), cursor.value); cursor.continue(); }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { database = null; durableValues.clear(); }
}

function persistFallback(key: string, value: string | null) {
  if (!database) return;
  const version = (versions.get(key) || 0) + 1;
  versions.set(key, version);
  try {
    const transaction = database.transaction('values', 'readwrite');
    const store = transaction.objectStore('values');
    if (value === null) store.delete(key); else store.put(value, key);
    transaction.oncomplete = () => {
      if (versions.get(key) !== version) return;
      if (value === null) durableValues.delete(key); else durableValues.set(key, value);
      // Only discard the old, smaller-cache copy after the replacement commits.
      try { globalThis.localStorage.removeItem(key); } catch { /* retained safely */ }
      pendingValues.delete(key);
      changed(key, false);
    };
    transaction.onabort = transaction.onerror = () => { if (versions.get(key) === version) changed(key, true); };
  } catch { changed(key, true); }
}

export const workspaceStorage = {
  getItem(key: string): string | null {
    const scoped = scopedKey(key);
    if (pendingValues.has(scoped)) return pendingValues.get(scoped) ?? null;
    if (durableValues.has(scoped)) return durableValues.get(scoped)!;
    try { return globalThis.localStorage.getItem(scoped); }
    catch { return null; }
  },
  setItem(key: string, value: string): boolean {
    const scoped = scopedKey(key);
    // Keep the current session usable if the browser cannot persist its cache.
    pendingValues.set(scoped, value);
    if (database) {
      persistFallback(scoped, value);
      return false; // Persistence completes asynchronously; memory remains current.
    }
    try {
      globalThis.localStorage.setItem(scoped, value);
      pendingValues.delete(scoped);
      changed(scoped, false);
      return true;
    } catch {
      changed(scoped, true);
      return false;
    }
  },
  removeItem(key: string): boolean {
    const scoped = scopedKey(key);
    pendingValues.set(scoped, null);
    if (database) {
      persistFallback(scoped, null);
      return false;
    }
    try {
      globalThis.localStorage.removeItem(scoped);
      pendingValues.delete(scoped);
      changed(scoped, false);
      return true;
    } catch {
      changed(scoped, true);
      return false;
    }
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  isLimited: () => failedKeys.size > 0,
};
