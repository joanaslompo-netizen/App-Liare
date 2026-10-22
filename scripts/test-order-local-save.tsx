import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true, requestAnimationFrame: (f: () => void) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
const fixture = {
  materials: [], products: [{ ...DEFAULT_PRODUCTS[0], id: 'p', name: 'Vela teste', actualPrice: 50, currentStock: 10, isIntermediate: false, isCustomRecipe: false, productFamily: undefined, fragrance: undefined }],
  sales: [], purchases: [], productions: [], customers: [], suppliers: [], todos: [], projects: [], paymentMethods: ['PIX'],
  settings: DEFAULT_SETTINGS, finance: { version: 1, entries: [], bills: [] }, stockMovements: [], revision: 1,
};
const scenario = { cloud: fixture as any, uploads: 0, financeCalls: 0, quota: true, delayedRead: null as Promise<any> | null, delayedUpload: null as Promise<any> | null, errors: new Set<(error: Error) => void>() };
(globalThis as any).__orderLocalSave = scenario;
const quotaError = Object.assign(new Error('Quota limit exceeded. Free daily write units per project'), { code: 'resource-exhausted' });
const mocks: Record<string, string> = {
  firebase: `export const auth={},googleProvider={},db={}; export const signInWithPopup=async()=>{},firebaseSignOut=async()=>{};
    export const onAuthStateChanged=(_auth,callback)=>{let active=true;queueMicrotask(()=>{if(active)callback({uid:'test',email:'test@example.com'});});return ()=>{active=false;};};`,
  cloud: `const s=globalThis.__orderLocalSave;
    export {createWorkspaceSyncBase,mergeWorkspaceData,compactWorkspaceForCloud,CloudSyncConflictError} from ${JSON.stringify(resolve('src/services/cloudSync.ts'))};
    export const syncUserProfile=async()=>{};
    export const fetchWorkspaceFromCloud=()=>s.delayedRead || Promise.resolve(s.cloud);
    export const fetchPreviousWorkspaceFromCloud=async()=>null;
    export const subscribeToWorkspace=(_uid,_data,error)=>{s.errors.add(error);return ()=>s.errors.delete(error);};
    export const executeFinanceInCloud=async()=>{s.financeCalls++;throw Object.assign(Error('Quota limit exceeded. Free daily write units per project'),{code:'resource-exhausted'});};
    export const uploadWorkspaceToCloud=async(_uid,data)=>{s.uploads++;if(s.delayedUpload)return s.delayedUpload;if(s.quota)throw Object.assign(Error('Quota limit exceeded'),{code:'resource-exhausted'});s.cloud={...data,revision:(s.cloud.revision||0)+1};return s.cloud;};`,
};
const bundle = await build({ entryPoints: ['src/App.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'cloud-quota', setup(build) {
  build.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'mock' }));
  build.onResolve({ filter: /\/services\/cloudSync$/ }, () => ({ path: 'cloud', namespace: 'mock' }));
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
} }] });
const module = { exports: {} as any };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const App = module.exports.default;
const snapshotKey = 'liare:liare_connected_v1:atelie_workspace_finance_v1';
const pendingKey = 'liare:liare_connected_v1:atelie_cloud_sync_pending_v1';
localStorage.setItem(snapshotKey, JSON.stringify(fixture));
const saved = () => JSON.parse(localStorage.getItem(snapshotKey)!);
const { createRoot } = await import('react-dom/client');
let root = createRoot(document.querySelector('#root')!);
const click = async (text: string) => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
  assert(button, `Botão ${text}`);
  await act(async () => button.click());
};
const fill = async (label: string, value: string) => {
  const input = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  assert(input, `Campo ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
async function prepareOrder(name: string) {
  await click('Pedidos');
  await click('Registrar Novo Pedido / Venda');
  await fill('Nome avulso', name);
  await click('Continuar para produtos');
  const model = document.querySelector('#order-product-search-combobox-model') as HTMLSelectElement;
  assert(model);
  await act(async () => { model.value = 'product:p'; model.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  await fill('Quantidade do produto', '2');
  await click('Adicionar');
  await click('Conferir pedido');
  await fill('Valor já pago', '35');
}
async function mount() { await act(async () => root.render(<App />)); }
async function remount() { await act(async () => root.unmount()); root = createRoot(document.querySelector('#root')!); await mount(); }
async function cloudPanel() {
  await act(async () => (document.querySelector('[aria-label="Configurações do Ateliê"]') as HTMLElement).click());
  await click('Gerenciar Aparelhos Conectados');
}
await mount();
await act(async () => scenario.errors.forEach(onError => onError(quotaError)));
await prepareOrder('Cliente com cota bloqueada');
await click('Concluir Pedido');
assert.equal(alerts.length, 0, alerts.join('; '));
assert.equal(scenario.financeCalls, 0, 'Salvar pedido nunca exige a transação remota');
assert.equal(scenario.uploads, 0, 'Uma cota já bloqueada não é chamada novamente ao salvar');
assert.equal(saved().sales.length, 1);
assert.equal(saved().sales[0].customerName, 'Cliente com cota bloqueada');
assert.equal(saved().finance.entries[0].amountCents, 3500);
assert.equal(saved().sales[0].items[0].reservedQuantity, 2);
assert.equal(localStorage.getItem(pendingKey), 'true');
assert(document.querySelector('[data-testid="order-detail"]'), 'Pedido salvo pode ser aberto para gerar fatura');
const firstId = saved().sales[0].id;
await remount();
assert.equal(saved().sales[0].id, firstId, 'Reabertura preserva o pedido pendente contra a nuvem antiga');
assert.equal(saved().finance.entries.length, 1);

// The same local document syncs after the outage without creating a second receipt.
scenario.quota = false;
await cloudPanel();
await click('Enviar agora');
assert.equal(localStorage.getItem(pendingKey), null);
assert.equal(scenario.cloud.sales.length, 1);
assert.equal(scenario.cloud.finance.entries.length, 1);
await click('Fechar');

// A connected account is allowed to save while its initial cloud read hangs/offline.
scenario.delayedRead = new Promise(() => {});
Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
await remount();
await prepareOrder('Cliente sem conexão');
await click('Concluir Pedido');
assert.equal(saved().sales.length, 2);
assert.equal(saved().finance.entries.length, 2);
assert.equal(scenario.financeCalls, 0);
assert.equal(alerts.length, 0, alerts.join('; '));
scenario.delayedRead = null;
Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
await remount();

// An old upload response cannot clear a newer order or its pending flag.
let resolveUpload!: (value: any) => void;
scenario.delayedUpload = new Promise(resolve => { resolveUpload = resolve; });
await cloudPanel();
await click('Enviar agora');
await click('Fechar');
await prepareOrder('Cliente durante envio');
await click('Concluir Pedido');
const latestId = saved().sales[0].id;
await act(async () => resolveUpload({ ...scenario.cloud, revision: 10 }));
assert.equal(saved().sales.length, 3);
assert(saved().sales.some((sale: any) => sale.id === latestId));
assert.equal(localStorage.getItem(pendingKey), 'true');
scenario.delayedUpload = null;
await cloudPanel();
await click('Enviar agora');
await click('Fechar');
assert.equal(scenario.cloud.sales.length, 3);
assert.equal(scenario.cloud.finance.entries.length, 3);

// A real device-storage failure keeps the form; retry reuses its document ID.
await prepareOrder('Cliente com falha no aparelho');
const nativeSet = dom.window.Storage.prototype.setItem;
dom.window.Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
await click('Concluir Pedido');
assert(document.querySelector('.liare-new-order'), 'Falha local não fecha o formulário');
assert(alerts.at(-1)?.includes('Não foi possível confirmar a cópia'));
dom.window.Storage.prototype.setItem = nativeSet;
await click('Concluir Pedido');
assert.equal(saved().sales.length, 4, 'Uma nova tentativa não duplica o pedido mantido na sessão');
assert.equal(saved().finance.entries.length, 4, 'Uma nova tentativa não duplica o pagamento inicial');
await act(async () => root.unmount());
console.log('PASS pedidos: cota bloqueada, salvamento local, reabertura, sincronização sem duplicar, abertura offline, envio em andamento e falha real de persistência com nova tentativa.');
process.exit(0);
