import assert from 'node:assert/strict';
import { workspaceStorage } from './workspaceStorage';
import { loadStoredData, saveWorkspaceSnapshot } from './storage';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
}, configurable: true });
const old = JSON.stringify({ materials: [{ id: 'legacy' }], sales: [], settings: {} });
localStorage.setItem('atelie_workspace_finance_v1', old);
localStorage.setItem('atelie_cloud_sync_pending_v1', 'true');
const empty = loadStoredData();
for (const key of ['materials', 'products', 'sales', 'purchases', 'todos']) assert.deepEqual(empty[key], []);
assert.equal(workspaceStorage.getItem('atelie_cloud_sync_pending_v1'), null);
const restored = { ...empty, materials: [{id: 'restored', name: 'Material'}], finance: {version: 1, entries: [{id: 'receipt'}], bills: []}, stockMovements: [{id: 'movement'}] };
saveWorkspaceSnapshot(restored);
assert.deepEqual(loadStoredData(), restored);
assert.equal(localStorage.getItem('atelie_workspace_finance_v1'), old);
assert.equal(localStorage.getItem('atelie_cloud_sync_pending_v1'), 'true');
workspaceStorage.setItem('atelie_workspace_finance_v1', '{bad');
assert.deepEqual(loadStoredData().materials, []);
assert.equal(workspaceStorage.getItem('atelie_workspace_invalid_snapshot_v1'), '{bad');
console.log('Nova base isolada: cache antigo e fila preservados, início vazio, backup e financeiro sem alterações.');
