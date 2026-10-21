import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, StrictMode, useState } from 'react';

const dom = new JSDOM('<!doctype html><main style="overflow:hidden;transform:translateX(0)"><div id="root"></div></main>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const viewport = Object.assign(new dom.window.EventTarget(), { height: 667, width: 375, offsetTop: 0, offsetLeft: 0 });
Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
let openings = 0;
dom.window.HTMLDialogElement.prototype.showModal = function () { openings++; this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const { createRoot } = await import('react-dom/client');
const { ModalFrame } = await import('../src/components/ModalFrame');
const root = createRoot(document.querySelector('#root')!);
let saves = 0;

function Scenario() {
  const [open, setOpen] = useState(true), [nested, setNested] = useState(false), [draft, setDraft] = useState('');
  return <>
    <button id="reopen" onClick={() => setOpen(true)}>Reabrir</button>
    {open && <ModalFrame onClose={() => setOpen(false)} className="liare-form-dialog">
      <div>
        <header className="liare-modal-header"><h2>Formulário extenso</h2><button id="close-parent" onClick={() => setOpen(false)}>Fechar</button></header>
        <form className="liare-modal-body" onSubmit={event => { event.preventDefault(); saves++; }}>
          <input aria-label="Rascunho" value={draft} onChange={event => setDraft(event.target.value)} />
          <button type="button" id="open-nested" onClick={() => setNested(true)}>Abrir cliente rápido</button>
          <p>{'Conteúdo longo. '.repeat(200)}</p><button type="submit">Salvar</button>
        </form>
        {nested && <ModalFrame onClose={() => setNested(false)}><div><header className="liare-modal-header"><h3>Cliente rápido</h3></header><div className="liare-modal-body"><input aria-label="Nome" /></div></div></ModalFrame>}
      </div>
    </ModalFrame>}
  </>;
}
const click = async (selector: string) => act(async () => (document.querySelector(selector) as HTMLElement).click());
await act(async () => root.render(<StrictMode><Scenario /></StrictMode>));
let parent = document.querySelector('dialog')!;
assert.equal(parent.parentElement, document.body, 'A janela escapa dos contêineres que cortam conteúdo');
assert(document.body.classList.contains('liare-modal-open'));
assert(parent.getAttribute('aria-labelledby'));
assert.equal(parent.style.getPropertyValue('--modal-height'), '667px');
const beforeRerender = openings;
const input = parent.querySelector('input')!;
await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Pedido em preenchimento');
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
assert.equal(openings, beforeRerender, 'Editar não reabre a janela nem reinicia o foco');
await click('#open-nested');
assert.equal(document.querySelectorAll('dialog[open]').length, 2);
assert.equal(document.querySelectorAll('form').length, 1, 'A janela sobreposta não cria um formulário aninhado');
viewport.height = 310; viewport.offsetTop = 52;
await act(async () => viewport.dispatchEvent(new dom.window.Event('resize')));
for (const dialog of document.querySelectorAll('dialog')) {
  assert.equal(dialog.style.getPropertyValue('--modal-height'), '310px');
  assert.equal(dialog.style.getPropertyValue('--modal-top'), '52px');
}
const nested = document.querySelectorAll('dialog')[1];
await act(async () => nested.dispatchEvent(new dom.window.Event('cancel', { bubbles: true, cancelable: true })));
assert.equal(document.querySelectorAll('dialog[open]').length, 1, 'Fechar a janela superior preserva a principal');
assert(document.body.classList.contains('liare-modal-open'), 'A página continua bloqueada enquanto há uma janela aberta');
assert.equal(document.querySelector('input')!.value, 'Pedido em preenchimento');
assert.equal(saves, 0, 'Abrir e fechar não salva formulários nem altera dados');
await click('#close-parent');
assert.equal(document.querySelector('dialog'), null);
assert(!document.body.classList.contains('liare-modal-open'), 'A página volta a rolar ao fechar a última janela');
await click('#reopen');
assert.equal(document.querySelector('input')!.value, 'Pedido em preenchimento');
parent = document.querySelector('dialog')!;
await act(async () => parent.dispatchEvent(new dom.window.Event('cancel', { bubbles: true, cancelable: true })));
assert.equal(document.querySelector('dialog'), null);
await act(async () => root.render(<ModalFrame embedded onClose={() => { throw Error('Fechamento inesperado'); }}><div>Fluxo em página</div></ModalFrame>));
assert.equal(document.querySelector('dialog'), null, 'Fluxos em página continuam embutidos');
assert(!document.body.classList.contains('liare-modal-open'));
await act(async () => root.unmount());
console.log('Pop-ups: portal, teclado/viewport, janelas sobrepostas, cancelamento, desbloqueio da página e rascunhos preservados.');

// Exercise the real quick-menu → new-material → close flow after moving overlays to portals.
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
const { workspaceStorage } = await import('../src/utils/workspaceStorage');
const { DEFAULT_SETTINGS } = await import('../src/utils/storage');
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify({
  materials: [], products: [], purchases: [], productions: [], projects: [], sales: [],
  customers: [], suppliers: [], todos: [], stockMovements: [], paymentMethods: [],
  settings: DEFAULT_SETTINGS, finance: { version: 1, entries: [], bills: [] },
}));
const { default: App } = await import('../src/App');
const appRoot = createRoot(document.querySelector('#root')!);
await act(async () => appRoot.render(<App />));
await click('[aria-label="Abrir atalhos rápidos"]');
assert.equal(document.querySelectorAll('dialog[open]').length, 1);
assert(document.querySelector('dialog')!.textContent!.includes('Ações rápidas'));
await click('[aria-label="Fechar ações rápidas"]');
assert.equal(document.querySelector('dialog'), null);
await click('[aria-label="Abrir atalhos rápidos"]');
await act(async () => {
  const button = [...document.querySelectorAll('dialog button')].find(node => node.textContent?.trim() === 'Novo material') as HTMLElement;
  assert(button); button.click();
});
assert.equal(document.querySelectorAll('dialog[open]').length, 1, 'A janela de destino substitui o menu');
assert(document.querySelector('dialog')!.textContent!.includes('Cadastrar Novo Material'));
await click('dialog [aria-label="Fechar janela"]');
assert.equal(document.querySelector('dialog'), null);
assert(!document.body.classList.contains('liare-modal-open'));
await act(async () => appRoot.unmount());
console.log('App integrado: atalhos abrem/fecham e dão lugar ao cadastro de material sem prender a tela.');
process.exit(0);
