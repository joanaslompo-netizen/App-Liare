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
export const workspaceStorage = {
  getItem(key: string): string | null {
    const scoped = scopedKey(key);
    if (pendingValues.has(scoped)) return pendingValues.get(scoped) ?? null;
    try { return globalThis.localStorage.getItem(scoped); }
    catch { return null; }
  },
  setItem(key: string, value: string): boolean {
    const scoped = scopedKey(key);
    // Keep the current session usable if the browser cannot persist its cache.
    pendingValues.set(scoped, value);
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
