import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { getRecipeCostSummary } from '../src/utils/financials';
import { formatCurrency, formatPercent } from '../src/utils/formatters';

const costs = { materialsCost: 40, embeddedLaborCost: 8, laborCost: 6, fixedCost: 4.6, otherCosts: 2, batchYield: 2, salePrice: 50 };
const summary = getRecipeCostSummary(costs);
assert.equal(summary.materials, 16);
assert.equal(summary.labor, 7);
assert.equal(summary.materialsAndLabor, 23);
assert.equal(summary.total, 26.3);
assert.equal(summary.profit, 23.7);
assert.equal(summary.marginPercent, 47.4);
assert.equal(getRecipeCostSummary({ ...costs, salePrice: 0 }).marginPercent, null);
assert(Math.abs(getRecipeCostSummary({ ...costs, salePrice: 20 }).profit + 6.3) < 1e-9);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (m: string) => { throw Error(m); }, confirm: () => true });
const { createRoot } = await import('react-dom/client');
const { ProductsView } = await import('../src/components/ProductsView');
const { DEFAULT_PRODUCTS } = await import('../src/utils/storage');
const component = { ...DEFAULT_PRODUCTS[0], id: 'component', name: 'Componente', batchYield: 1, laborCost: 8, embeddedLaborCost: 0, isIntermediate: true };
const product = { ...DEFAULT_PRODUCTS[0], ...costs, id: 'test', name: 'Produto de teste', productFamily: undefined, fragrance: undefined,
  isIntermediate: false, isFamilyMother: false, parentRecipeId: undefined, isCustomRecipe: false,
  actualPrice: 50, productionTimeMinutes: 6, hourlyRate: 60, fixedCostPercent: 10, useProductionStages: false, productionStages: [],
  items: [{ id: 'c', type: 'product' as const, targetId: component.id, name: component.name, quantity: 1, unit: 'un', unitCost: 40, totalCost: 40 }] };
const root = createRoot(document.querySelector('#root')!);
const noop = () => {};
await act(async () => root.render(<ProductsView products={[product, component]} materials={[]} defaultHourlyRate={60}
  defaultFixedCostPercent={10} defaultProfitMargin={50} onSaveProduct={noop} onDeleteProduct={noop} onDuplicateProduct={noop} />));
const section = (parent: ParentNode) => parent.querySelector('[aria-label="Resumo de custos e venda"]')!;
const value = (parent: ParentNode, label: string) => [...parent.querySelectorAll('dt')].find(el => el.textContent === label)?.nextElementSibling?.textContent;
const check = (el: Element, price = 50) => {
  assert(el, 'Resumo visível');
  assert.equal(value(el, 'Custo dos materiais'), formatCurrency(16));
  assert.equal(value(el, 'Mão de obra total'), formatCurrency(7));
  assert.equal(value(el, 'Materiais + mão de obra'), formatCurrency(23));
  assert.equal(value(el, 'Custos totais'), formatCurrency(26.3));
  assert.equal(value(el, 'Lucro após os custos'), formatCurrency(price - 26.3));
  assert.equal(value(el, 'Margem de lucro'), formatPercent((price - 26.3) / price * 100));
};
const card = document.querySelector('#product-card-test')!;
check(section(card));
const ficha = card.querySelector('#btn-ficha-test') as HTMLButtonElement;
await act(async () => ficha.click());
const fichaTitle = [...document.querySelectorAll('h3')].find(el => el.textContent === 'Ficha Técnica & Precificação')!;
const fichaModal = fichaTitle.closest('.fixed')!;
check(section(fichaModal));
const closeFicha = [...fichaModal.querySelectorAll('button')].find(el => el.textContent?.trim() === 'Fechar')!;
await act(async () => closeFicha.click());
const edit = card.querySelector('[title="Editar produto e receita"]') as HTMLButtonElement;
await act(async () => edit.click());
const form = document.querySelector('.liare-form-dialog')!;
check(section(form));
const price = form.querySelector('#input-product-actual-price') as HTMLInputElement;
assert(!price.closest('details'), 'Preço de venda acessível sem expandir opções');
await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(price, '60');
  price.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
check(section(form), 60);
await act(async () => root.unmount());
console.log('Resumo: lote com componentes, mão de obra sem duplicação, custos, lucro/margem e edição de preço passaram.');
