import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act, StrictMode } from 'react';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { DEFAULT_SETTINGS } from '../src/utils/storage';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: () => {}, confirm: () => true, requestAnimationFrame: (f: () => void) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};
const scenario = { profile: deferred(), cloud: deferred(), reads: 0, subscriptions: new Set<any>(), auth: new Set<any>() };
(globalThis as any).__cloudStartup = scenario;
const mocks: Record<string, string> = {
  firebase: `
    export const auth={},googleProvider={};
    export const signInWithPopup=async()=>{},firebaseSignOut=async()=>{};
    export const onAuthStateChanged=(_auth,callback)=>{
      const s=globalThis.__cloudStartup;s.auth.add(callback);
      queueMicrotask(()=>{if(s.auth.has(callback))callback({uid:'test',displayName:'Teste',email:'test@example.com'});});
      return ()=>s.auth.delete(callback);
    };`,
  cloud: `
    const s=globalThis.__cloudStartup;
    export const syncUserProfile=()=>s.profile.promise;
    export const fetchWorkspaceFromCloud=()=>{s.reads++;return s.cloud.promise;};
    export const fetchPreviousWorkspaceFromCloud=async()=>null;
    export const subscribeToWorkspace=(_uid,onData)=>{s.subscriptions.add(onData);return ()=>s.subscriptions.delete(onData);};
    export const uploadWorkspaceToCloud=async()=>{throw Error('Unexpected write');};
    export const executeFinanceInCloud=async()=>{throw Error('Unexpected finance write');};
    export const createWorkspaceSyncBase=()=>({schema:1,entities:{},settings:'',paymentMethods:''});
    export const compactWorkspaceForCloud=data=>data;
    export const mergeWorkspaceData=(_base,local)=>local;
    export class CloudSyncConflictError extends Error {}`,
};
const bundle = await build({
  entryPoints: ['src/App.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
  plugins: [{ name: 'slow-cloud', setup(build) {
    build.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'mock' }));
    build.onResolve({ filter: /\/services\/cloudSync$/ }, () => ({ path: 'cloud', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }],
});
const module = { exports: {} as any };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const App = module.exports.default;
const fixture = { materials: [], products: [], productions: [], purchases: [], sales: [], customers: [], paymentMethods: [], suppliers: [], settings: DEFAULT_SETTINGS, todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [] };
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(fixture));
const { createRoot } = await import('react-dom/client');
let root = createRoot(document.querySelector('#root')!);
const click = async (text: string) => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
  assert(button, `Botão ${text}`);
  await act(async () => button.click());
};
await act(async () => root.render(<StrictMode><App /></StrictMode>));
assert.equal(scenario.reads, 1, 'A busca inicia mesmo com o perfil sem resposta; StrictMode não duplica a inicialização.');
await act(async () => (document.querySelector('[aria-label="Configurações do Ateliê"]') as HTMLElement).click());
await click('Gerenciar Aparelhos Conectados');
assert(document.body.textContent?.includes('Sincronizando com a nuvem'));
assert(document.body.textContent?.includes('continuar usando os dados deste aparelho'));
await click('Fechar');
assert.equal(document.querySelector('dialog'), null, 'A janela fecha durante uma consulta lenta.');
await act(async () => (document.querySelector('[aria-label="Configurações do Ateliê"]') as HTMLElement).click());
const name = [...document.querySelectorAll('input')].find(input => input.value === DEFAULT_SETTINGS.atelierName)!;
assert(name);
await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(name, 'Edição durante a espera');
  name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const form = name.closest('form')!;
await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
await act(async () => scenario.cloud.resolve({ ...fixture, revision: 2, settings: { ...DEFAULT_SETTINGS, atelierName: 'Versão da nuvem' } }));
assert.equal(JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!).settings.atelierName, 'Edição durante a espera', 'A resposta tardia não sobrescreve a edição local.');
assert.equal(scenario.subscriptions.size, 1);
await act(async () => root.unmount());
assert.equal(scenario.subscriptions.size, 0, 'Nenhum listener vaza ao sair.');

// A response after logout/unmount must not create a hidden subscription.
scenario.cloud = deferred();
root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
await act(async () => root.unmount());
await act(async () => scenario.cloud.resolve(fixture));
assert.equal(scenario.subscriptions.size, 0);
console.log('PASS abertura: perfil sem resposta não bloqueia dados, navegação e Fechar funcionam durante espera, resposta tardia preserva edição local, StrictMode e desmontagem não vazam listeners.');
process.exit(0);
