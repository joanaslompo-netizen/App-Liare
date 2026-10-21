import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import type { Product } from '../src/types';
import { formatCurrency } from '../src/utils/formatters';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => { throw Error(message); } });
const { createRoot } = await import('react-dom/client');
const { ProductsView } = await import('../src/components/ProductsView');
const { DEFAULT_PRODUCTS, DEFAULT_MATERIALS } = await import('../src/utils/storage');
const mother: Product = { ...DEFAULT_PRODUCTS[0], id: 'mother', name: 'Receita mãe', customName: 'Receita mãe',
  productFamily: 'Teste', fragrance: undefined, parentRecipeId: undefined, isFamilyMother: true,
  isCustomRecipe: false, isIntermediate: false, actualPrice: 40, useProductionStages: false };
const secondMother = { ...mother, id: 'second-mother', name: 'Outra mãe', actualPrice: 60 };
const child = { ...mother, id: 'child', name: 'Variação', customName: 'Variação', parentRecipeId: mother.id,
  isFamilyMother: false, actualPrice: 15, currentStock: 3 };
let saved: Product | undefined;
let root = createRoot(document.querySelector('#root')!);
const noop = () => {};
const render = async (products: Product[]) => act(async () => root.render(<ProductsView products={products}
  materials={DEFAULT_MATERIALS} defaultHourlyRate={35} defaultFixedCostPercent={12} defaultProfitMargin={50}
  onSaveProduct={(value) => { saved = value; }} onDeleteProduct={noop} onDuplicateProduct={noop} />));
const click = async (selector: string) => {
  const button = document.querySelector<HTMLButtonElement>(selector);
  assert(button, selector);
  await act(async () => button.click());
};
const select = async (value: string) => act(async () => {
  const input = document.querySelector<HTMLSelectElement>('#parent-recipe')!;
  input.value = value;
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
});
const price = () => document.querySelector<HTMLInputElement>('#input-product-actual-price')!;
const checkPrice = (expected: number, inherited = true) => {
  assert.equal(Number(price().value), expected);
  assert.equal(price().readOnly, inherited);
  const form = document.querySelector('.liare-form-dialog')!;
  const label = [...form.querySelectorAll('dt')].find((el) => el.textContent === 'Valor de venda:')!;
  assert.equal(label.nextElementSibling?.textContent, formatCurrency(expected));
};
const save = async () => click('#btn-save-product');
const reset = async () => {
  await act(async () => root.unmount());
  root = createRoot(document.querySelector('#root')!);
  saved = undefined;
};

// Older variants show the current mother's price when opened, before saving.
await render([mother, secondMother, child]);
await click('#btn-edit-product-child');
checkPrice(40);
assert(document.querySelector('#product-price-help')?.textContent?.includes(mother.name));
await save();
assert.equal(saved?.actualPrice, 40);
assert.equal(saved?.parentRecipeId, mother.id);
assert.equal(saved?.currentStock, 3);
await reset();

// Changing the link updates both input and cost summary; detaching makes the price editable.
await render([mother, secondMother, child]);
await click('#btn-edit-product-child');
await select(secondMother.id);
checkPrice(60);
await select('');
checkPrice(60, false);
await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(price(), '65');
  price().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
checkPrice(65, false);
await save();
assert.equal(saved?.actualPrice, 65);
assert.equal(saved?.parentRecipeId, undefined);
await reset();

// An independent recipe can be linked and saved with the mother's explicit zero price.
await render([{ ...mother, actualPrice: 0 }, { ...child, parentRecipeId: undefined }]);
await click('#btn-edit-product-child');
checkPrice(15, false);
await select(mother.id);
checkPrice(0);
await save();
assert.equal(saved?.actualPrice, 0);
assert.equal(saved?.parentRecipeId, mother.id);
await act(async () => root.unmount());
console.log('Preço da receita mãe: reabertura, resumo, vínculo, troca de mãe, valor zero, desvínculo e salvamento passaram.');
