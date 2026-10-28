import { workspaceStorage } from '../src/utils/workspaceStorage';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_MATERIALS, DEFAULT_PRODUCTS } from '../src/utils/storage';
import type { Sale } from '../src/types';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
const confirmations: string[] = [];
let confirmResponse = true;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: (message: string) => { confirmations.push(message); return confirmResponse; },
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const item = { id: 'custom_line', productId: 'placeholder', productName: 'Personalizado de teste', isCustom: true,
  quantity: 2, unitPrice: 75, unitCost: 10, totalCost: 20,
  customRecipeItems: [{ id: 'wax_line', type: 'material' as const, targetId: 'wax', name: 'Cera', unit: 'g', quantity: 5, unitCost: 2, totalCost: 10 }] };
const sale: Sale = { id: 'custom_order', orderNumber: 1, date: '2026-10-27', createdAt: '2026-10-27',
  productId: 'placeholder', productName: item.productName, quantity: 2, unitPrice: 75, unitCost: 10, totalRevenue: 150,
  totalCost: 20, totalProfit: 130, marginPercent: 130 / 150 * 100, customerName: 'Cliente de teste', orderType: 'encomenda',
  financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'pendente_entrega', commercialStatus: 'confirmed', items: [item] };
function seed(stock: number, customize?: (workspace: any) => void) {
  const workspace: any = { materials: [{ ...DEFAULT_MATERIALS[0], id: 'wax', name: 'Cera',
    unit: 'g', packageUnit: 'g', packageQuantity: 1, packagePrice: 2, unitCost: 2, currentStock: stock, isMadeInAtelier: false, isVirtualRecipe: false }],
    products: [], purchases: [], productions: [], sales: [structuredClone(sale)], customers: [], suppliers: [], paymentMethods: [], settings: DEFAULT_SETTINGS,
    todos: [], projects: [], finance: { version: 1, entries: [], bills: [] }, stockMovements: [] };
  customize?.(workspace);
  workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(workspace));
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
confirmResponse = false;
const insufficient = JSON.stringify(saved());await act(async () => produce()!.click());
assert.equal(confirmations.length, 1);assert(confirmations[0].includes('Cera: necessário 5 g; disponível 4 g; faltam 1 g.'));
assert.equal(alerts.length, 0);assert.equal(JSON.stringify(saved()), insufficient, 'Cancelar o aviso não altera produção, reserva ou estoque.');
confirmResponse = true;await act(async () => produce()!.click());
assert.equal(saved().materials[0].currentStock, 0);assert.equal(saved().productions.length, 1);assert.equal(saved().products[0].currentStock, 1);
assert.equal(saved().productions[0].deductedItems[0].quantityTotal, 5);assert.equal(saved().productions[0].deductedItems[0].stockBefore, 4);assert.equal(saved().productions[0].deductedItems[0].stockAfter, 0);
assert.equal(saved().productions[0].costPerUnit, 10, 'O custo completo da composição continua registrado.');
assert(saved().productions[0].notes.includes('Produção autorizada com estoque insuficiente'));
assert.equal(saved().stockMovements.find((move: any) => move.targetId === 'wax').quantity, -4, 'A movimentação física corresponde ao saldo efetivamente baixado.');
assert.equal(saved().sales[0].items[0].reservedQuantity, 1);assert(document.querySelector('[data-testid=order-detail]'));
await act(async () => root.unmount());await mount();await act(async () => produce()!.click());
assert(confirmations.at(-1)!.includes('disponível 0 g; faltam 5 g.'));
assert.equal(saved().materials[0].currentStock, 0);assert.equal(saved().productions.length, 2);assert.equal(saved().products[0].currentStock, 2);
assert.equal(saved().stockMovements.filter((move: any) => move.targetId === 'wax').length, 1, 'Sem saldo não é criada uma baixa física fictícia.');
assert.equal(saved().sales[0].totalRevenue, 150);assert.equal(saved().finance.entries.length, 0);
await button('Registrar entrega');await button('Confirmar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'entregue');assert.equal(saved().materials[0].currentStock, 0);
assert.equal(saved().productions.length, 2);assert.equal(saved().products[0].currentStock, 0, 'Entregar não produz nem baixa insumos novamente.');
await act(async () => root.unmount());alerts.length = 0;
const confirmationCount = confirmations.length;
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
await button('Registrar entrega');
const decrease = document.querySelector<HTMLButtonElement>('[aria-label="Diminuir quantidade de Personalizado de teste"]');assert(decrease);await act(async () => decrease.click());
await button('Confirmar entrega');
assert.equal(saved().products[0].currentStock, 1);assert.equal(saved().materials[0].currentStock, 90);
await button('Registrar entrega');await button('Confirmar entrega');
assert.equal(saved().sales[0].deliveryStatus, 'entregue');assert.equal(saved().products[0].currentStock, 0);
assert.equal(saved().productions.length, 2);assert.equal(saved().materials[0].currentStock, 90, 'Entregar uma unidade já produzida não baixa os insumos novamente.');
assert.equal(saved().sales[0].items[0].customProducedQuantity, 2);
assert.equal(confirmations.length, confirmationCount, 'Estoque suficiente não pede confirmação.');
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());

const component = { ...DEFAULT_PRODUCTS[0], id: 'component', name: 'Laço pronto', isIntermediate: true, items: [], currentStock: 0, batchYield: 1, unitCostFromBatch: 2, materialsCost: 2, totalCost: 2, laborCost: 0 };
const withComponent = (workspace: any) => {
  workspace.products.push(structuredClone(component));
  workspace.sales[0].items[0].customRecipeItems.push({ id: 'component_line', type: 'product', targetId: component.id, name: component.name, unit: 'un', quantity: 1, unitCost: 2, totalCost: 2 });
};
seed(4, withComponent);await mount();
let count = confirmations.length;await act(async () => produce()!.click());
assert.equal(confirmations.length, count + 1, 'Uma única confirmação lista todos os itens em falta.');
assert(confirmations.at(-1)!.includes('Cera: necessário 5 g; disponível 4 g; faltam 1 g.'));
assert(confirmations.at(-1)!.includes('Laço pronto: necessário 1 un; disponível 0 un; faltam 1 un.'));
assert.equal(saved().productions.length, 1);assert(saved().products.every((product: any) => product.currentStock >= 0));
assert.equal(saved().productions[0].costPerUnit, 12);assert.equal(saved().materials[0].currentStock, 0);
await act(async () => root.unmount());

const withAutomaticComponent = (workspace: any) => {
  withComponent(workspace);
  Object.assign(workspace.products[0], { name: 'Componente automático', unitCostFromBatch: 4, totalCost: 4, materialsCost: 4,
    items: [{ id: 'component_wax', type: 'material', targetId: 'wax', name: 'Cera', unit: 'g', quantity: 2, unitCost: 2, totalCost: 4 }] });
};
seed(4, withAutomaticComponent);await mount();await act(async () => produce()!.click());
assert(confirmations.at(-1)!.includes('Cera: necessário 7 g; disponível 4 g; faltam 3 g.'));
assert.equal(saved().productions[0].automaticManufacturing[0].quantity, 1);
assert.equal(saved().materials[0].currentStock, 0);assert.equal(saved().products.find((product: any) => product.id === component.id).currentStock, 0);
assert.equal(saved().productions[0].costPerUnit, 14);
await act(async () => root.unmount());

// A shortage override never hides an invalid recipe or a component already
// being made in a staged production.
seed(4, workspace => { workspace.sales[0].items[0].customRecipeItems[0].targetId = 'missing'; });
await mount();count = confirmations.length;const invalidBefore = JSON.stringify(saved());await act(async () => produce()!.click());
assert.equal(confirmations.length, count);assert(alerts.at(-1)!.includes('não foi encontrado'));assert.equal(JSON.stringify(saved()), invalidBefore);
await act(async () => root.unmount());alerts.length = 0;
seed(4, workspace => { withAutomaticComponent(workspace);workspace.productions.push({ id: 'active', productId: component.id, status: 'in_progress', quantityProduced: 0, date: '2026-10-27', deductedItems: [], totalCost: 0 }); });
await mount();count = confirmations.length;const activeBefore = JSON.stringify(saved());await act(async () => produce()!.click());
assert.equal(confirmations.length, count);assert(alerts.at(-1)!.includes('em andamento'));assert.equal(JSON.stringify(saved()), activeBefore);
await act(async () => root.unmount());
console.log('Personalizados salvos: aviso único de todas as faltas, cancelar sem mudanças, confirmar com saldo parcial/zero, custo e estoque físico corretos, componentes automáticos, reabrir, entregar sem segunda baixa e proteções de receita preservadas passaram.');
process.exit(0);
