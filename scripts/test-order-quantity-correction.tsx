import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';
import { makeEntry, emptyFinance, creditBalance, accountBalance } from '../src/utils/financeLedger';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const fixture: any = { materials: [], productions: [], purchases: [], products: [{ ...DEFAULT_PRODUCTS[0], id: 'p', name: 'Vela de teste', currentStock: 5 }],
  sales: [{ id: 'order', orderNumber: 1, date: '2026-10-01', createdAt: '2026-10-01', productId: 'p', productName: 'Vela de teste', quantity: 5, unitPrice: 50, unitCost: 10,
    totalRevenue: 250, totalCost: 50, totalProfit: 200, customerId: 'c', customerName: 'Cliente de teste', financialTracking: true, legacyPaidCents: 0,
    deliveryStatus: 'entregue', deliveryActualDate: '2026-10-02', items: [{ id: 'line', productId: 'p', productName: 'Vela de teste', quantity: 5, unitPrice: 50, unitCost: 10,
      totalCost: 50, deliveredQuantity: 5, stockConsumedQuantity: 5 }], deliveryHistory: [{ id: 'delivery', itemId: 'line', kind: 'delivery', quantity: 5, date: '2026-10-02', unitRevenueCents: 5000, unitBusinessCost: 10, unitLaborRemuneration: 0 }] }],
  customers: [{ id: 'c', name: 'Cliente de teste', phone: '', createdAt: '2026-10-01' }], settings: DEFAULT_SETTINGS, suppliers: [], todos: [], projects: [], paymentMethods: [], stockMovements: [],
  finance: { ...emptyFinance(), entries: [makeEntry('receipt', 250, { id: 'receipt', saleId: 'order', customerId: 'c', date: '2026-10-02', account: 'Principal', allocatedCents: 25000 })] } };
const saved = () => JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(fixture));
const { createRoot } = await import('react-dom/client');const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
async function mount() { await act(async () => root.render(<App />));await button('Pedidos');await button('Pedido #000001'); }
async function button(text: string) { const element = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === text);assert(element, text);await act(async () => element.click()); }
async function quantity(value: string) { const element = document.querySelector<HTMLInputElement>('[aria-label="Quantidade de Vela de teste"]')!;assert(element);await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(element, value);element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); }
await mount();const before = JSON.stringify(saved());const receipt = JSON.stringify(saved().finance.entries[0]);
await button('Editar itens');assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Quantidade de Vela de teste"]')!.min, '1');
await quantity('2');assert(document.querySelector('[aria-label="Correção das entregas registradas"]')?.textContent?.includes('5 → 2'));
await button('Cancelar alterações');assert.equal(JSON.stringify(saved()), before);
await button('Editar itens');await quantity('2');await button('Salvar itens do pedido');
assert.equal(alerts.length, 0, alerts.join('; '));assert(document.querySelector('[data-testid="order-detail"]'));
assert.equal(saved().sales.length, 1);assert.equal(saved().sales[0].orderNumber, 1);assert.equal(saved().sales[0].quantity, 2);
assert.equal(saved().sales[0].items[0].deliveredQuantity, 2);assert.equal(saved().sales[0].deliveryStatus, 'entregue');
assert.equal(saved().products[0].currentStock, 8);assert.equal(saved().sales[0].totalRevenue, 100);
assert.equal(JSON.stringify(saved().finance.entries[0]), receipt);assert.equal(creditBalance(saved().finance, 'c'), 15000);assert.equal(accountBalance(saved().finance, 'Principal', '2026-12-31'), 25000);
assert.equal(saved().sales[0].quantityCorrections[0].previousDeliveryHistory[0].quantity, 5);
assert(document.body.textContent?.includes('Correção de quantidade registrada'));
await act(async () => root.unmount());root = createRoot(document.querySelector('#root')!);await mount();
await button('Editar itens');assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Quantidade de Vela de teste"]')!.value, '2');
await quantity('1');await act(async () => document.querySelector<HTMLInputElement>('[aria-label="Repor diferença no estoque"]')!.click());
await button('Salvar itens do pedido');
assert.equal(saved().sales[0].quantity, 1);assert.equal(saved().products[0].currentStock, 8, 'Reposição desmarcada mantém o estoque');
assert.equal(saved().sales[0].quantityCorrections.length, 2);assert.equal(creditBalance(saved().finance, 'c'), 20000);assert.equal(JSON.stringify(saved().finance.entries[0]), receipt);
await act(async () => root.unmount());

// An older order marked delivered without a physical stock movement can also
// be corrected, including an anonymous overpayment, without inventing stock.
const legacy = structuredClone(fixture);delete legacy.sales[0].customerId;delete legacy.finance.entries[0].customerId;
delete legacy.sales[0].deliveryHistory;delete legacy.sales[0].items[0].deliveredQuantity;delete legacy.sales[0].items[0].stockConsumedQuantity;
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(legacy));root = createRoot(document.querySelector('#root')!);await mount();
await button('Editar itens');await quantity('2');assert(!document.querySelector('[aria-label="Repor diferença no estoque"]'));
await button('Salvar itens do pedido');assert.equal(saved().sales[0].quantity, 2);assert.equal(saved().sales[0].items[0].deliveredQuantity, 2);
assert.equal(saved().products[0].currentStock, 5);assert.equal(saved().finance.entries.length, 1);assert.equal(saved().finance.entries[0].amountCents, 25000);
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());
console.log('App: reduzir item entregue, conferir/cancelar, corrigir com ou sem reposição, preservar recebimento/crédito/histórico, reabrir e corrigir legado sem fabricar estoque passaram.');
process.exit(0);
