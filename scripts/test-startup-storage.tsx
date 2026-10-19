import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS, saveWorkspaceSnapshot, loadStoredData } from '../src/utils/storage';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', storageQuota: 30000 });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: () => {}, confirm: () => true, requestAnimationFrame: (f: () => void) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {}; dom.window.scrollTo = () => {};
const fixture = { materials: [], products: [{ ...DEFAULT_PRODUCTS[0], id: 'startup-product', imageUrl: 'data:image/png;base64,' + 'a'.repeat(4000) }], purchases: [], productions: [], sales: [], customers: [], paymentMethods: [], suppliers: [], settings: DEFAULT_SETTINGS, todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [] };
assert(saveWorkspaceSnapshot(fixture));
const nativeStorage = globalThis.localStorage;
let occupied = 0;
for (let i = 0; i < nativeStorage.length; i++) { const key = nativeStorage.key(i)!; occupied += key.length + nativeStorage.getItem(key)!.length; }
const former = 'x'.repeat(30000 - occupied - 'former_backup'.length - 200);
nativeStorage.setItem('former_backup', former);
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
assert(document.querySelector('main'), 'O app deve abrir mesmo com pouco espaço restante.');
assert.equal(nativeStorage.getItem('former_backup'), former);
assert.equal(nativeStorage.getItem('liare:liare_connected_v1:atelie_products_v1'), null, 'Sem duplicar as imagens no cache por coleção.');
await act(async () => root.unmount());
// Complete write refusal is different from a merely nearly-full cache.
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: nativeStorage.getItem.bind(nativeStorage),
  setItem: () => { throw new DOMException('Storage full', 'QuotaExceededError'); },
  removeItem: nativeStorage.removeItem.bind(nativeStorage),
}, configurable: true });
const current = { ...fixture, products: [{ ...fixture.products[0], name: 'Receita mantida em memória' }] };
assert.equal(saveWorkspaceSnapshot(current), false);
root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
assert(document.querySelector('main'));
assert(document.querySelector('[role=alert]')?.textContent?.includes('Não foi possível salvar uma cópia'));
assert.equal(loadStoredData().products[0].name, 'Receita mantida em memória');
await act(async () => root.unmount());
Object.defineProperty(globalThis, 'localStorage', { value: nativeStorage, configurable: true });
nativeStorage.removeItem('former_backup');
assert(saveWorkspaceSnapshot(current));
assert.equal(workspaceStorage.isLimited(), false);
assert.equal(JSON.parse(nativeStorage.getItem('liare:liare_connected_v1:atelie_workspace_finance_v1')!).products[0].name, current.products[0].name);
console.log('Inicialização: pouco espaço e quota excedida não derrubam o app; cópia antiga preservada, sem imagens duplicadas, aviso visível e gravação recuperada.');
process.exit(0);
