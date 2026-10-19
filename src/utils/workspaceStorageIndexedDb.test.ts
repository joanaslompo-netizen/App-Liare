import assert from 'node:assert/strict';
import { initializeWorkspaceStorage, workspaceStorage } from './workspaceStorage';

const disk = new Map<string, string>();
const legacy = new Map<string, string>();
let fail = false;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => legacy.get(key) ?? null,
  setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); },
  removeItem: (key: string) => legacy.delete(key),
} });
// Asynchronous transaction harness: changes become durable only at commit.
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
  open() {
    const request: any = {};
    setTimeout(() => {
      request.result = { transaction(_name: string, mode: string) {
        let action = () => {};
        const transaction: any = { objectStore: () => ({
          put(value: string, key: string) { action = () => disk.set(key, value); },
          delete(key: string) { action = () => disk.delete(key); },
          openCursor() {
            const cursorRequest: any = {};
            const entries = [...disk]; let i = 0;
            const next = () => { const entry = entries[i++]; cursorRequest.result = entry ? { key: entry[0], value: entry[1], continue: () => setTimeout(next, 0) } : null; cursorRequest.onsuccess(); if (!entry) setTimeout(() => transaction.oncomplete(), 0); };
            setTimeout(next, 0); return cursorRequest;
          },
        }) };
        if (mode === 'readwrite') setTimeout(() => { if (fail) transaction.onabort(); else { action(); transaction.oncomplete(); } }, 0);
        return transaction;
      } };
      request.onsuccess();
    }, 0); return request;
  },
} });
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
const key = 'liare:liare_connected_v1:snapshot';
legacy.set(key, 'old');
await initializeWorkspaceStorage();
assert.equal(workspaceStorage.getItem('snapshot'), 'old');
workspaceStorage.setItem('snapshot', 'new');
assert.equal(workspaceStorage.getItem('snapshot'), 'new');
assert.equal(legacy.get(key), 'old', 'Keep the old copy until commit');
await tick();
assert.equal(disk.get(key), 'new');
assert.equal(legacy.has(key), false);
await initializeWorkspaceStorage();
assert.equal(workspaceStorage.getItem('snapshot'), 'new', 'Reload reads the durable replacement');
workspaceStorage.setItem('snapshot', 'first');
workspaceStorage.setItem('snapshot', 'latest');
await tick();
assert.equal(workspaceStorage.getItem('snapshot'), 'latest');
assert.equal(disk.get(key), 'latest');
fail = true;
workspaceStorage.setItem('snapshot', 'unsaved');
await tick();
assert.equal(workspaceStorage.isLimited(), true);
assert.equal(disk.get(key), 'latest', 'Failed transaction preserves last durable copy');
assert.equal(workspaceStorage.getItem('snapshot'), 'unsaved');
fail = false;
workspaceStorage.setItem('snapshot', 'recovered');
await tick();
assert.equal(workspaceStorage.isLimited(), false);
workspaceStorage.removeItem('snapshot');
assert.equal(workspaceStorage.getItem('snapshot'), null);
await tick();
assert.equal(disk.has(key), false);
console.log('IndexedDB: quota cheia, reinício, gravações consecutivas, falha, recuperação e remoção verificados.');
