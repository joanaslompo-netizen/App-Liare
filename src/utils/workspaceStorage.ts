import { WORKSPACE_ID } from '../config/workspace';

// Keep device caches and pending edits from the former base isolated.
// Firebase authentication continues to use its own existing storage.
const scopedKey = (key: string) => `liare:${WORKSPACE_ID}:${key}`;
export const workspaceStorage = {
  getItem: (key: string) => globalThis.localStorage.getItem(scopedKey(key)),
  setItem: (key: string, value: string) => globalThis.localStorage.setItem(scopedKey(key), value),
  removeItem: (key: string) => globalThis.localStorage.removeItem(scopedKey(key)),
};
