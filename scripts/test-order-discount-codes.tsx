import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import type { AtelierSettings, DiscountCode, Sale } from '../src/types';
import { formatCurrency } from '../src/utils/formatters';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';
import { workspaceStorage } from '../src/utils/workspaceStorage';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  alert: (message: string) => { throw Error(message); },
  confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
  cancelAnimationFrame: clearTimeout,
});
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};

const originalCode: DiscountCode = {
  id: 'existing', code: 'EXISTENTE10', type: 'percentage', value: 10, active: true, createdAt: '2026-11-10',
};
const storageKey = 'atelie_workspace_finance_v1';
workspaceStorage.setItem(storageKey, JSON.stringify({
  products: [{
    ...DEFAULT_PRODUCTS[0], id: 'p', name: 'Vela de teste', actualPrice: 100, currentStock: 10,
    isIntermediate: false, isCustomRecipe: false, productFamily: undefined, fragrance: undefined,
  }],
  materials: [], sales: [], customers: [], purchases: [], productions: [], suppliers: [], todos: [], projects: [],
  paymentMethods: ['PIX'],
  settings: { ...DEFAULT_SETTINGS, discountCodes: [originalCode] },
  finance: { version: 1, entries: [], bills: [] }, stockMovements: [],
}));

const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
const rootNode = document.querySelector('#root')!;
let root = createRoot(rootNode);
const saved = (): { settings: AtelierSettings; sales: Sale[] } =>
  JSON.parse(workspaceStorage.getItem(storageKey)!);

async function click(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  assert(target, selector);
  await act(async () => target.click());
}

async function button(text: string, scope: ParentNode = document) {
  const target = [...scope.querySelectorAll('button')].find(item => item.textContent?.trim() === text);
  assert(target, text);
  await act(async () => target.click());
}

async function fill(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  assert(input, selector);
  const select = input instanceof dom.window.HTMLSelectElement;
  const prototype = select ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event(select ? 'change' : 'input', { bubbles: true }));
  });
}

async function openNewOrder() {
  await click('[aria-label="Voltar ao Início"]');
  await click('#btn-home-quick-sale');
  await fill('[aria-label="Nome avulso"]', 'Cliente fictícia');
  await button('Continuar para produtos');
  await fill('#order-product-search-combobox-model', 'product:p');
  await button('Adicionar');
  await button('Conferir pedido');
}

async function checkInvoice(label: string, discount: number) {
  await button('Ver fatura');
  const frame = document.querySelector<HTMLIFrameElement>('iframe');
  assert(frame);
  const invoice = new JSDOM(frame.srcdoc).window.document;
  assert(invoice.querySelector('.summary')?.textContent?.includes(label));
  assert(invoice.querySelector('.summary .discount')?.textContent?.includes(formatCurrency(discount)));
  await click('[aria-label="Fechar fatura"]');
}

await act(async () => root.render(<App />));
await button('Gestão');
await click('button[aria-label="Códigos de desconto"]');
const editor = '[aria-labelledby="discount-codes-heading"]';
assert(document.querySelector(editor)?.textContent?.includes(originalCode.code));
await fill(`${editor} input:not([type])`, '  vip 15  ');
await fill(`${editor} input[type="number"]`, '15');
await button('Adicionar código');
const reusable = saved().settings.discountCodes!.find(code => code.code === 'VIP15');
assert(reusable);
await click('[aria-label="Editar código VIP15"]');
await fill(`${editor} input[type="number"]`, '12.5');
await button('Salvar alteração');
const reusableRow = document.querySelector('[aria-label="Editar código VIP15"]')!.closest('li')!;
await button('Pausar', reusableRow);
assert.equal(saved().settings.discountCodes!.find(code => code.id === reusable.id)?.active, false);
await button('Ativar', reusableRow);
const registered = saved().settings.discountCodes!;
assert.deepEqual(registered[0], originalCode);
assert.equal(registered.find(code => code.id === reusable.id)?.value, 12.5);

await click('[aria-label="Configurações do Ateliê"]');
assert(!document.querySelector('.liare-form-dialog')?.textContent?.includes('Códigos de desconto'));
await button('Salvar Configurações');
assert.deepEqual(saved().settings.discountCodes, registered);

await openNewOrder();
await button('Código de uso único');
await button('Concluir Pedido');
assert.equal(saved().sales.length, 0, 'Não salva um código sem nome e valor.');
const formAlert = document.querySelector('.liare-new-order [role="alert"]')?.textContent;
assert(formAlert?.includes('código de uso único'), formAlert ?? 'O formulário deve explicar a falta de nome ou valor.');
await fill('[aria-label="Nome do código de uso único"]', ' PRESENTE30 ');
await fill('[aria-label="Valor do desconto de uso único"]', '30');
await button('Adicionar desconto');
await button('% manual', document.querySelector('[aria-label="Desconto 2"]')!);
await fill('[aria-label="Desconto 2"] [aria-label="Valor do desconto"]', '5');
await button('Adicionar desconto');
await button('R$ manual', document.querySelector('[aria-label="Desconto 3"]')!);
await fill('[aria-label="Desconto 3"] [aria-label="Valor do desconto"]', '7');
await fill('[aria-label="Frete cobrado"]', '12');
await button('Concluir Pedido');
const combinedOrder = saved().sales[0];
assert.deepEqual(combinedOrder.discounts, [
  { code: 'PRESENTE30', type: 'percentage', value: 30, amount: 30 },
  { type: 'percentage', value: 5, amount: 5 },
  { type: 'fixed', value: 7, amount: 7 },
]);
assert.equal(combinedOrder.discountAmount, 42);
assert.equal(combinedOrder.totalRevenue, 70);
assert.deepEqual(saved().settings.discountCodes, registered);
await checkInvoice('PRESENTE30 · 30%', 42);

await act(async () => root.unmount());
root = createRoot(rootNode);
await act(async () => root.render(<App />));
await button('Pedidos');
await button(`Pedido #${String(combinedOrder.orderNumber).padStart(6, '0')}`);
await checkInvoice('PRESENTE30 · 30%', 42);

await button('Editar pedido');
await button('Continuar para produtos');
await fill('[aria-label="Quantidade de Vela de teste"]', '2');
await button('Conferir pedido');
await click('[aria-label="Remover desconto 2"]');
assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Desconto 2"] [aria-label="Valor do desconto"]')?.value, '7');
await button('Salvar alterações');
const editedOrder = saved().sales[0];
assert.equal(editedOrder.id, combinedOrder.id);
assert.deepEqual(editedOrder.discounts?.map(discount => discount.amount), [60, 7]);
assert.equal(editedOrder.discountAmount, 67);
assert.equal(editedOrder.totalRevenue, 145);
await checkInvoice('PRESENTE30 · 30%', 67);

await openNewOrder();
await button('Código');
const choices = document.querySelector<HTMLSelectElement>('[aria-label="Cupom de desconto"]')!;
assert.equal(choices.value, '');
assert(!choices.textContent?.includes('PRESENTE30'));
await fill('[aria-label="Cupom de desconto"]', reusable.id);
await button('Concluir Pedido');
assert.equal(saved().sales.find(sale => sale.discountCodeId === reusable.id)?.discountAmount, 12.5);
await checkInvoice('VIP15 · 12,5%', 12.5);

await act(async () => root.unmount());
console.log('Códigos de desconto: gestão, uso único, soma de percentuais e reais, edição, remoção, recálculo e fatura passaram.');
