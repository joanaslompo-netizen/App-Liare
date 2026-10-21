import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { getRecipeCostSummary, getProductFinancialSplit } from '../src/utils/financials';
import { formatCurrency, formatPercent } from '../src/utils/formatters';

const costs = { materialsCost: 40, embeddedLaborCost: 8, laborCost: 6, fixedCost: 4.6, otherCosts: 2, batchYield: 2, salePrice: 50 };
const summary = getRecipeCostSummary(costs);
assert.equal(summary.materials, 16);
assert.equal(summary.labor, 7);
assert.equal(summary.componentLabor, 4);
assert.equal(summary.ownLabor, 3);
assert.equal(summary.fixed, 2.3);
assert.equal(summary.materialsWithFixed, 18.3);
assert.equal(summary.subtotalWithLabor, 25.3);
assert.equal(summary.other, 1);
assert.equal(summary.total, 26.3);
assert.equal(summary.profit, 30.7);
assert.equal(summary.costs, 19.3);
const sampleSplit = getProductFinancialSplit({
  ...costs, id: 'p', laborCost: 6, embeddedLaborCost: 8,
} as any);
assert.equal(sampleSplit.businessCostPerUnit, 19.3);
assert.equal(sampleSplit.laborRemunerationPerUnit, 7);
assert(Math.abs(summary.marginPercent! - 30.7 / 50 * 100) < 1e-9);
assert.equal(getRecipeCostSummary({ ...costs, salePrice: 0 }).marginPercent, null);
assert.equal(getRecipeCostSummary({ ...costs, materialsCost: 8, fixedCost: 0, otherCosts: 0 }).marginPercent, 100);
assert.equal(getRecipeCostSummary({ ...costs, salePrice: summary.costs }).marginPercent, 0);
assert(Math.abs(getRecipeCostSummary({ ...costs, salePrice: summary.total }).profit - summary.labor) < 1e-9);
assert(Math.abs(getRecipeCostSummary({ ...costs, salePrice: 10 }).profit + 9.3) < 1e-9);

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
const check = (el: Element, price = 50, compact = false) => {
  assert(el, 'Resumo visível');
  const labels = [...el.querySelectorAll('dt')].map(element => element.textContent);
  if (compact) {
    assert.deepEqual(labels, ['Custos financeiros:', 'Custos + mão de obra:', 'Valor de venda:', 'Margem:']);
  } else {
    assert.deepEqual(labels, [
      'Materiais e componentes (sem mão de obra):', 'Custos fixos:', 'Outros custos:',
      'Custos financeiros:', 'Mão de obra dos componentes:', 'Mão de obra desta receita:',
      'Mão de obra total:', 'Custos + mão de obra:', 'Valor de venda:',
      'Lucro bruto (inclui sua mão de obra):', 'Margem:',
    ]);
    assert.equal(value(el, 'Materiais e componentes (sem mão de obra):'), formatCurrency(16));
    assert.equal(value(el, 'Custos fixos:'), formatCurrency(2.3));
    assert.equal(value(el, 'Outros custos:'), formatCurrency(1));
    assert.equal(value(el, 'Mão de obra dos componentes:'), formatCurrency(4));
    assert.equal(value(el, 'Mão de obra desta receita:'), formatCurrency(3));
    assert.equal(value(el, 'Mão de obra total:'), formatCurrency(7));
    assert.equal(value(el, 'Lucro bruto (inclui sua mão de obra):'), formatCurrency(price - 19.3));
  }
  assert.equal(value(el, 'Custos financeiros:'), formatCurrency(19.3));
  assert.equal(value(el, 'Custos + mão de obra:'), formatCurrency(26.3));
  assert.equal(value(el, 'Valor de venda:'), formatCurrency(price));
  assert.equal(value(el, 'Margem:'), formatPercent((price - 19.3) / price * 100));
  assert(el.textContent?.includes('Referência mínima de venda'));
};
const card = document.querySelector('#product-card-test')!;
check(section(card), 50, true);
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
