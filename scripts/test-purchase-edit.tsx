import { workspaceStorage } from '../src/utils/workspaceStorage';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_MATERIALS } from '../src/utils/storage';
import { applyFinanceCommand, emptyFinance, accountBalance } from '../src/utils/financeLedger';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const fixture = { materials: ['wax','jar'].map(id => ({ ...DEFAULT_MATERIALS[0], id, name: id === 'wax' ? 'Cera' : 'Copo',
  unit: 'un' as const, packageUnit: 'un' as const, packageQuantity: 10, packagePrice: 20, unitCost: 2, currentStock: 0 })),
  products: [], purchases: [], productions: [], sales: [], customers: [], paymentMethods: [], suppliers: [], todos: [], projects: [],
  settings: DEFAULT_SETTINGS, finance: emptyFinance(), stockMovements: [] };
const initial = applyFinanceCommand(fixture, { type: 'purchase', purchase: { id: 'purchase', supplierName: 'Loja Teste',
  date: '2026-10-01', createdAt: '2026-10-01', shippingCost: 0, totalAmount: 100, invoiceNumber: 'NF-1', notes: 'Compra original',
  items: [{ id: 'line', materialId: 'wax', materialName: 'Cera', quantity: 2, unit: 'un', totalPrice: 100, packagePrice: 100 }] },
  updateStock: true, paidNow: true, dueDate: '2026-10-01', account: 'Principal' });
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(initial));
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
const saved = () => JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
async function click(selector: string) { const element = document.querySelector<HTMLElement>(selector);assert(element, selector);await act(async () => element.click()); }
async function button(text: string) { const element = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === text);assert(element, text);await act(async () => element.click()); }
async function fill(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(selector);assert(element, selector);
  await act(async () => { const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
await act(async () => root.render(<App />));
await button('Materiais');
// The material inventory provides the existing entry point to the purchases history.
const disclosure = [...document.querySelectorAll('summary')].find(summary => summary.textContent?.includes('Mais opções: histórico'));
assert(disclosure);await act(async () => disclosure.click());
const history = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Compras de Materiais');
assert(history, 'Acesso ao histórico de compras');await act(async () => history.click());
await click('[aria-label="Editar compra de Loja Teste"]');
assert.equal((document.querySelector('[aria-label="Quantidade do item 1"]') as HTMLInputElement).value, '2');
assert.equal((document.querySelector('[aria-label="Valor do item 1"]') as HTMLInputElement).value, '100');
assert.equal((document.querySelector('#purchase-date') as HTMLInputElement).value, '2026-10-01');
assert.equal((document.querySelector('[aria-label="Nome do fornecedor avulso"]') as HTMLInputElement).value, 'Loja Teste');
await fill('[aria-label="Quantidade do item 1"]', '3');
await fill('[aria-label="Valor do item 1"]', '150');
const search = document.querySelector('#combobox-material-search') as HTMLInputElement;assert(search);
await act(async () => search.focus());
await fill('#combobox-material-search', 'Copo');
const jar = [...document.querySelectorAll<HTMLElement>('ul li')].find(element => element.textContent?.includes('Copo'));assert(jar);await act(async () => jar.click());
await fill('#purchase-quantity', '1');await fill('#purchase-item-total', '20');await button('Inserir Item');
await button('Salvar alterações');
assert.equal(alerts.length, 0, alerts.join('; '));
assert.equal(saved().purchases.length, 1);assert.equal(saved().purchases[0].id, 'purchase');assert.equal(saved().purchases[0].items.length, 2);
assert.deepEqual(saved().materials.map((material: any) => material.currentStock), [30, 10]);
assert.equal(saved().purchases[0].totalAmount, 170);assert.equal(accountBalance(saved().finance, 'Principal'), -17000);
assert(document.body.textContent?.includes('Compra atualizada.'));
// Details use the same editor; cancelling an unfinished edit changes nothing.
await click('button[title="Ver detalhes"]');await button('Editar compra');
const beforeCancel = JSON.stringify(saved());await fill('[aria-label="Valor do item 1"]', '1');await button('Cancelar');
assert.equal(JSON.stringify(saved()), beforeCancel);
await click('[aria-label="Editar compra de Loja Teste"]');await click('[aria-label="Remover item 2"]');await button('Salvar alterações');
assert.equal(saved().purchases[0].items.length, 1);assert.deepEqual(saved().materials.map((material: any) => material.currentStock), [30, 0]);
assert.equal(accountBalance(saved().finance, 'Principal'), -15000);
await act(async () => root.unmount());root = createRoot(document.querySelector('#root')!);await act(async () => root.render(<App />));
assert.equal(saved().purchases.length, 1);assert.equal(saved().purchases[0].edits.length, 2);
assert.equal(saved().materials[0].currentStock, 30);assert.equal(accountBalance(saved().finance, 'Principal'), -15000);
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());
console.log('Compras no app: abrir edição preenchida, corrigir linha, incluir/remover material, pagamento corrigido, cancelar edição e reabrir mantendo uma única compra passaram.');
process.exit(0);
