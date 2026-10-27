import { workspaceStorage } from '../src/utils/workspaceStorage';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_MATERIALS } from '../src/utils/storage';
import type { Sale } from '../src/types';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const item = { id: 'custom_line', productId: 'placeholder', productName: 'Personalizado de teste', isCustom: true,
  quantity: 2, unitPrice: 75, unitCost: 10, totalCost: 20,
  customRecipeItems: [{ id: 'wax_line', type: 'material' as const, targetId: 'wax', name: 'Cera', unit: 'g', quantity: 5, unitCost: 2, totalCost: 10 }] };
const sale: Sale = { id: 'custom_order', orderNumber: 1, date: '2026-10-27', createdAt: '2026-10-27',
  productId: 'placeholder', productName: item.productName, quantity: 2, unitPrice: 75, unitCost: 10, totalRevenue: 150,
  totalCost: 20, totalProfit: 130, marginPercent: 130 / 150 * 100, customerName: 'Cliente de teste', orderType: 'encomenda',
  financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'pendente_entrega', commercialStatus: 'confirmed', items: [item] };
function seed(stock: number) {
  workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify({ materials: [{ ...DEFAULT_MATERIALS[0], id: 'wax', name: 'Cera',
    unit: 'g', packageUnit: 'g', packageQuantity: 1, packagePrice: 2, unitCost: 2, currentStock: stock, isMadeInAtelier: false, isVirtualRecipe: false }],
    products: [], purchases: [], productions: [], sales: [sale], customers: [], suppliers: [], paymentMethods: [], settings: DEFAULT_SETTINGS,
    todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [] }));
}
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root: ReturnType<typeof createRoot>;
const saved = () => JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
const produce = () => document.querySelector<HTMLButtonElement>('[aria-label="Produzir uma unidade de Personalizado de teste"]');
async function button(text: string) { const element = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === text);assert(element, text);await act(async () => element.click()); }
async function open() {
  const element = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Cliente de teste') && button.textContent?.includes('un a entregar'));
  assert(element);await act(async () => element.click());assert(document.querySelector('[data-testid=order-detail]'));
}
async function mount() { root = createRoot(document.querySelector('#root')!);await act(async () => root.render(<App />));await open(); }
seed(4);await mount();assert(produce(), 'O pedido salvo mostra Produzir +1 antes de existir uma receita interna.');
const insufficient = JSON.stringify(saved());await act(async () => produce()!.click());
assert(alerts.some(message => /insuficiente/i.test(message)));assert.equal(JSON.stringify(saved()), insufficient, 'Falta de insumo não deixa produção, reserva ou baixa parcial.');
await act(async () => root.unmount());alerts.length = 0;
seed(100);await mount();
const detail = document.querySelector('[data-testid=order-detail]');
await act(async () => produce()!.click());
assert.equal(document.querySelector('[data-testid=order-detail]'), detail, 'Produzir mantém a ficha aberta.');
assert.equal(saved().materials[0].currentStock, 95);assert.equal(saved().productions.length, 1);
assert.equal(saved().products.length, 1);assert.equal(saved().products[0].isCustomRecipe, true);
assert.equal(saved().products[0].currentStock, 1);assert.equal(saved().sales[0].items[0].reservedQuantity, 1);
assert.equal(saved().sales[0].items[0].customProducedQuantity, 1);
const productId = saved().products[0].id;
assert(produce(), 'A segunda unidade ainda pode ser produzida.');
await act(async () => root.unmount());await mount();assert(produce(), 'Reabrir mantém o botão para as unidades pendentes.');
await act(async () => produce()!.click());
assert.equal(saved().materials[0].currentStock, 90);assert.equal(saved().productions.length, 2);
assert.equal(saved().products.length, 1);assert.equal(saved().products[0].id, productId);
assert.equal(saved().products[0].currentStock, 2);assert.equal(saved().sales[0].items[0].reservedQuantity, 2);
assert.equal(produce(), null, 'Produção deixa de ser oferecida quando todas as unidades estão separadas.');
assert.equal(saved().sales[0].totalRevenue, 150);assert.equal(saved().finance.entries.length, 0);
await button('Registrar entrega');await button('Registrar entrega');
assert.equal(saved().products[0].currentStock, 1);assert.equal(saved().materials[0].currentStock, 90);
await button('Registrar entrega');await button('Registrar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'entregue');assert.equal(saved().products[0].currentStock, 0);
assert.equal(saved().productions.length, 2);assert.equal(saved().materials[0].currentStock, 90, 'Entregar uma unidade já produzida não baixa os insumos novamente.');
assert.equal(saved().sales[0].items[0].customProducedQuantity, 2);
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());
console.log('Personalizados salvos: botão antes da receita interna, baixa/reserva, produção parcial, reabertura, limite do pedido, entrega sem segunda baixa e insuficiência sem alterações parciais passaram.');
process.exit(0);
