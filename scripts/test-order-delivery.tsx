import { workspaceStorage } from '../src/utils/workspaceStorage';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';
import { emptyFinance, makeEntry, type FinanceCommand } from '../src/utils/financeLedger';
import { OrderDeliveryEditor } from '../src/components/OrderDeliveryEditor';
import type { Sale } from '../src/types';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const sale: Sale = { id: 'order', orderNumber: 1, date: '2026-10-01', createdAt: '2026-10-01', productId: 'a', productName: 'Velas fictícias',
  quantity: 5, unitPrice: 50, unitCost: 10, totalRevenue: 250, totalCost: 50, totalProfit: 200, marginPercent: 80,
  customerId: 'client', customerName: 'Cliente fictícia', commercialStatus: 'confirmed', financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'parcial',
  items: [{ id: 'a', productId: 'a', productName: 'Vela A', quantity: 3, unitPrice: 50, unitCost: 10, totalCost: 30, deliveredQuantity: 1, reservedQuantity: 2 },
    { id: 'b', productId: 'b', productName: 'Vela B', quantity: 2, unitPrice: 50, unitCost: 10, totalCost: 20, reservedQuantity: 2 }],
  deliveryHistory: [{ id: 'old', itemId: 'a', kind: 'delivery', quantity: 1, date: '2026-10-02' }] };
const finance = emptyFinance();finance.entries.push(makeEntry('receipt', 50, { id: 'receipt', saleId: sale.id, customerId: 'client', date: '2026-10-02', method: 'Pix', allocatedCents: 5000 }));
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify({ materials: [], products: ['a', 'b'].map(id => ({ ...DEFAULT_PRODUCTS[0], id, fragrance: id === 'a' ? 'Aroma A' : 'Aroma B', currentStock: 10 })), purchases: [], productions: [], sales: [sale],
  customers: [{ id: 'client', name: 'Cliente fictícia', phone: '', createdAt: '2026-10-01' }], settings: DEFAULT_SETTINGS, finance, suppliers: [], todos: [], projects: [], paymentMethods: [], stockMovements: [] }));
const saved = () => JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
async function mount() { await act(async () => root.render(<App />)); }
async function button(text: string) { const element = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);assert(element, text);await act(async () => element.click()); }
async function click(selector: string) { const element = document.querySelector<HTMLElement>(selector);assert(element, selector);await act(async () => element.click()); }
async function fill(selector: string, value: string) { const input = document.querySelector<HTMLInputElement>(selector);assert(input, selector);await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); }
async function open() { await button('Pedidos');await button('Pedido #000001'); }
const quantity = (id: string) => document.querySelector<HTMLInputElement>(`[data-delivery-item="${id}"] input[type="number"]`)!;
const confirm = () => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Confirmar entrega')!;
await mount();await open();
const before = JSON.stringify(saved()), originalFinance = JSON.stringify(saved().finance);
await button('Registrar entrega');
let form = document.querySelector('form[aria-label="Registrar entrega de produtos"]')!;assert(form);
assert.equal(form.querySelectorAll('select').length, 0, 'Todos os produtos ficam visíveis; não há lista suspensa');
assert.equal(quantity('a').value, '2');assert.equal(quantity('b').value, '2');
assert(form.textContent?.includes('Aroma A'));assert(form.textContent?.includes('Aroma B'));
assert(form.textContent?.includes('4 peças nesta entrega'));
await button('Cancelar');assert.equal(JSON.stringify(saved()), before);
await button('Registrar entrega');
await click('[aria-label="Diminuir quantidade de Vela A"]');
await click('[data-delivery-item="b"] input[type="checkbox"]');
assert.equal(quantity('a').value, '1');assert.equal(quantity('b').value, '0');
await button('Confirmar entrega');
assert(document.querySelector('[data-testid="order-detail"]'), 'A ficha continua aberta');
assert.equal(saved().sales[0].items[0].deliveredQuantity, 2);assert.equal(saved().sales[0].items[1].deliveredQuantity || 0, 0);
assert.equal(saved().sales[0].deliveryStatus, 'parcial');assert.deepEqual(saved().products.map((product: any) => product.currentStock), [9, 10]);
assert(document.body.textContent?.includes('Ainda faltam 3 peças neste pedido.'));
await act(async () => root.unmount());root = createRoot(document.querySelector('#root')!);await mount();await open();await button('Registrar entrega');
assert.equal(quantity('a').value, '1');assert.equal(quantity('b').value, '2');
await fill('[data-delivery-item="a"] input[type="number"]', '2');assert(confirm().disabled);
await fill('[data-delivery-item="a"] input[type="number"]', '0.5');assert(confirm().disabled);
await fill('[data-delivery-item="a"] input[type="number"]', '1');assert(!confirm().disabled);
await button('Limpar seleção');assert(confirm().disabled);
await button('Selecionar tudo');assert.equal(quantity('b').value, '2');
await click('[data-delivery-item="a"] input[type="checkbox"]');await click('[aria-label="Diminuir quantidade de Vela B"]');
form = document.querySelector('form[aria-label="Registrar entrega de produtos"]')!;
const details = form.querySelector('details')!;await act(async () => { details.open = true; });
await fill('form[aria-label="Registrar entrega de produtos"] input[type="date"]', '2026-10-20');
await fill('input[placeholder="Ex.: retirado pela cliente"]', 'Retirada parcial');
await button('Confirmar entrega');
assert.equal(saved().sales[0].deliveryHistory.at(-1).date, '2026-10-20');assert.equal(saved().sales[0].deliveryHistory.at(-1).note, 'Retirada parcial');
await button('Registrar entrega');assert.equal(quantity('a').value, '1');assert.equal(quantity('b').value, '1');
await button('Confirmar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'entregue');assert.deepEqual(saved().products.map((product: any) => product.currentStock), [8, 8]);
assert(saved().sales[0].items.every((item: any) => item.reservedQuantity === 0));
assert.equal(saved().sales[0].deliveryHistory.length, 5);assert.equal(saved().stockMovements.length, 4);
assert.equal(JSON.stringify(saved().finance), originalFinance);assert.equal(saved().sales[0].totalRevenue, 250);
assert(![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Registrar entrega'));
const final = JSON.stringify(saved());await act(async () => root.unmount());root = createRoot(document.querySelector('#root')!);await mount();await open();assert.equal(JSON.stringify(saved()), final);
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());

// A rapid double submission is blocked; an uncertain response retries with the
// same operation ID, without silently creating a second physical delivery.
root = createRoot(document.querySelector('#root')!);
const calls: Extract<FinanceCommand, { type: 'deliver_items' }>[] = [];
let resolveAction: (ok: boolean) => void = () => {};
const action = (command: FinanceCommand) => { assert(command.type === 'deliver_items');calls.push(command);return new Promise<boolean>(resolve => { resolveAction = resolve; }); };
await act(async () => root.render(<OrderDeliveryEditor sale={sale} onAction={action} onCancel={() => {}} onCompleted={() => assert.fail('Falha não conclui a entrega')} />));
form = document.querySelector('form')!;
await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
assert.equal(calls.length, 1);await act(async () => resolveAction(false));
await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
assert.equal(calls.length, 2);assert.equal(calls[0].id, calls[1].id);await act(async () => resolveAction(false));
await act(async () => root.unmount());
console.log('Entrega no app: produtos visíveis, saldos preenchidos, +/- e seleção, cancelamento, entrega parcial/total, data/observação, reabertura, ficha aberta e recebimentos preservados; duplo clique e repetição protegidos.');
process.exit(0);
