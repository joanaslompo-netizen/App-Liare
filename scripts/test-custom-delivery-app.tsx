import { workspaceStorage as storage } from '../src/utils/workspaceStorage';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/utils/storage';
import type { Sale } from '../src/types';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message),
  confirm: () => true, requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
const sale: Sale = {
  id: 'custom_order', orderNumber: 1, date: '2026-10-25', createdAt: '2026-10-25',
  productId: 'placeholder', productName: 'Personalizado sem materiais', quantity: 2,
  unitPrice: 75, unitCost: 0, totalRevenue: 150, totalCost: 0, totalProfit: 150, marginPercent: 100,
  customerName: 'Cliente personalizado', financialTracking: true, legacyPaidCents: 0,
  deliveryStatus: 'pendente_entrega', commercialStatus: 'confirmed',
  items: [{ id: 'custom_line', productId: 'placeholder', productName: 'Personalizado sem materiais',
    isCustom: true, quantity: 2, unitPrice: 75, unitCost: 0, totalCost: 0 }],
};
storage.setItem('atelie_workspace_finance_v1', JSON.stringify({ materials: [], products: [], purchases: [],
  productions: [], sales: [sale], customers: [], suppliers: [], paymentMethods: [], settings: DEFAULT_SETTINGS,
  todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [] }));
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
const saved = () => JSON.parse(storage.getItem('atelie_workspace_finance_v1')!);
async function button(text: string) {
  const element = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
  assert(element, text);
  await act(async () => element.click());
}
async function openOrder() {
  const element = [...document.querySelectorAll('button')].find(node => node.textContent?.includes('Cliente personalizado') && node.textContent?.includes('un a entregar'));
  assert(element);
  await act(async () => element.click());
  assert(document.querySelector('[data-testid=order-detail]'));
}
await act(async () => root.render(<App />));
await openOrder();
assert(document.body.textContent?.includes('este item pode ser entregue diretamente'));
assert(!document.querySelector('[aria-label^="Produzir uma unidade"]'), 'Sem composição não há promessa de uma produção manual obrigatória.');
await button('Registrar entrega');
await button('Registrar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'parcial');
const productId = saved().sales[0].items[0].customProductId;
assert(productId);
assert.equal(saved().products.length, 1);
assert.equal(saved().products[0].currentStock, 0);
assert.deepEqual(saved().stockMovements.map((move: any) => move.quantity), [1, -1]);
assert.equal(alerts.length, 0, alerts.join('; '));
await act(async () => root.unmount());
root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
await openOrder();
await button('Registrar entrega');
await button('Registrar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'entregue');
assert.equal(saved().sales[0].items[0].customProductId, productId);
assert.equal(saved().sales[0].items[0].customProducedQuantity, 2);
assert.equal(saved().sales[0].deliveryHistory.length, 2);
assert.equal(saved().sales[0].totalRevenue, 150);
assert.equal(saved().products.length, 1);
assert.equal(saved().products[0].currentStock, 0);
assert.equal(saved().materials.length, 0);
assert.equal(saved().finance.entries.length, 0);
assert.equal(alerts.length, 0, alerts.join('; '));
await act(async () => root.unmount());
console.log('PASS app: personalizado com apenas nome e preço entregue pela ficha, persistido ao reabrir e concluído sem produção manual nem duplicação.');
process.exit(0);
