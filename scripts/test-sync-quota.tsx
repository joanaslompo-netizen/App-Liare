import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_SETTINGS } from '../src/utils/storage';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => assert.fail(message), confirm: () => true, requestAnimationFrame: (f: () => void) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {}; dom.window.scrollTo = () => {};
const fixture = { materials: [], products: [], productions: [], purchases: [], sales: [], customers: [], paymentMethods: [], suppliers: [], settings: DEFAULT_SETTINGS, todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [], revision: 1 };
const scenario = { cloud: fixture, uploads: 0, profiles: 0, quota: true };
(globalThis as any).__syncQuota = scenario;
const mocks: Record<string, string> = {
  firebase: `export const auth={},googleProvider={},db={};export const signInWithPopup=async()=>{},firebaseSignOut=async()=>{};
    export const onAuthStateChanged=(_auth,callback)=>{let active=true;queueMicrotask(()=>{if(active)callback({uid:'quota-owner',email:'test@example.com'});});return ()=>{active=false;};};`,
  cloud: `const s=globalThis.__syncQuota;
    export {createWorkspaceSyncBase,mergeWorkspaceData,compactWorkspaceForCloud,CloudSyncConflictError} from ${JSON.stringify(resolve('src/services/cloudSync.ts'))};
    export const syncUserProfile=async()=>{s.profiles++;};export const fetchWorkspaceFromCloud=async()=>s.cloud;
    export const fetchPreviousWorkspaceFromCloud=async()=>null;export const subscribeToWorkspace=()=>()=>{};
    export const executeFinanceInCloud=async()=>{throw Error('Unexpected financial operation');};
    export const uploadWorkspaceToCloud=async(_uid,data)=>{s.uploads++;if(s.quota)throw Object.assign(Error('Free daily write units per project: quota exceeded'),{code:'resource-exhausted'});s.cloud={...data,revision:s.cloud.revision+1};return s.cloud;};`,
};
const bundle = await build({ entryPoints: ['src/App.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'quota-lifecycle', setup(build) {
  build.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'mock' }));
  build.onResolve({ filter: /\/services\/cloudSync$/ }, () => ({ path: 'cloud', namespace: 'mock' }));
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
} }] });
const nativeSetTimeout = globalThis.setTimeout, nativeClearTimeout = globalThis.clearTimeout, nativeNow = Date.now;
let now = Date.parse('2026-10-22T17:00:00Z');
Date.now = () => now;
const timers = new Map<any, { delay: number; callback: () => any }>();
globalThis.setTimeout = ((callback: any, delay: number, ...args: any[]) => {
  if (delay >= 10000) { const id = {}; timers.set(id, { delay, callback: () => callback(...args) }); return id; }
  return nativeSetTimeout(callback, delay, ...args);
}) as any;
globalThis.clearTimeout = ((id: any) => { if (!timers.delete(id)) nativeClearTimeout(id); }) as any;
const module = { exports: {} as any };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const App = module.exports.default;
const snapshotKey = 'liare:liare_connected_v1:atelie_workspace_finance_v1', pendingKey = 'liare:liare_connected_v1:atelie_cloud_sync_pending_v1';
localStorage.setItem(snapshotKey, JSON.stringify(fixture));
const { createRoot } = await import('react-dom/client');
let root = createRoot(document.querySelector('#root')!);
async function mount() { await act(async () => root.render(<App />)); }
async function editName(name: string) {
  const before = JSON.parse(localStorage.getItem(snapshotKey)!).settings.atelierName;
  await act(async () => (document.querySelector('[aria-label="Configurações do Ateliê"]') as HTMLElement).click());
  const input = [...document.querySelectorAll('input')].find(input => input.value === before)!;
  assert(input);
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, name); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await act(async () => input.closest('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
}
async function runTimer(predicate: (delay: number) => boolean) {
  const task = [...timers].find(([, task]) => predicate(task.delay));
  if (!task) return false;
  timers.delete(task[0]); await act(async () => task[1].callback()); return true;
}
await mount();
assert.equal(scenario.profiles, 0, 'Opening the app never writes a profile');
assert.equal(await runTimer(delay => delay === 15000), false, 'Idle opening schedules no upload');
await editName('Primeira alteração'); await editName('Alterações agrupadas');
assert.equal([...timers.values()].filter(task => task.delay === 15000).length, 1);
await runTimer(delay => delay === 15000);
assert.equal(scenario.uploads, 1);
await editName('Pendente após quota');
assert.equal(await runTimer(delay => delay === 15000), false, 'New edits do not restart an exhausted quota');
await act(async () => root.unmount()); root = createRoot(document.querySelector('#root')!); await mount();
await runTimer(delay => delay === 15000);
assert.equal(scenario.uploads, 1, 'Reload retains the pause');
assert.equal(localStorage.getItem(pendingKey), 'true');
scenario.quota = false; now += 27 * 60 * 60 * 1000;
assert(await runTimer(delay => delay > 60 * 60 * 1000), 'There is one wake-up for the next daily renewal');
assert(await runTimer(delay => delay === 15000));
assert.equal(scenario.uploads, 2);
assert.equal(localStorage.getItem(pendingKey), null);
assert.equal(scenario.cloud.settings.atelierName, 'Pendente após quota');
assert.equal(scenario.profiles, 0);
await act(async () => root.unmount());
globalThis.setTimeout = nativeSetTimeout; globalThis.clearTimeout = nativeClearTimeout; Date.now = nativeNow;
console.log('PASS sync lifecycle: idle zero writes, grouped edits, quota exactly once, pause across reload, pending local data and automatic recovery at the next daily renewal.');
process.exit(0);
