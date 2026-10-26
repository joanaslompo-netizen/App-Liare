import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { virtualFragranceMaterials as materials, virtualFragranceProduct as product, virtualFragranceWorkspace } from './virtualFragranceFixtures';
import { workspaceStorage } from '../src/utils/workspaceStorage';
import { getProductModels } from '../src/utils/productModels';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'localStorage'])
  Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message),
  requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
dom.window.confirm = () => true;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
const { createRoot } = await import('react-dom/client');
const { ProductsView } = await import('../src/components/ProductsView');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
const click = async (selector: string) => {
  const node = document.querySelector<HTMLElement>(selector); assert(node, selector);
  await act(async () => node.click());
};
const button = async (text: string) => {
  const node = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text); assert(node, text);
  await act(async () => node.click());
};
const fill = async (selector: string, value: string) => {
  const node = document.querySelector<HTMLInputElement>(selector); assert(node, selector);
  await act(async () => {
    const proto = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value);
    node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};
const chooseMaterial = async (selector: string, text: string) => {
  await act(async () => (document.querySelector(selector) as HTMLInputElement).focus());
  const option = [...document.querySelectorAll('li')].find(node => node.textContent?.includes(text));
  assert(option, `A lista precisa incluir ${text}`);
  await act(async () => option.click());
};
const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
let savedProduct: any;
const empty = { ...product, items: [], productionStages: undefined, fragranceMode: 'auto' as const };
await act(async () => root.render(<ProductsView products={[empty]} materials={materials}
  defaultHourlyRate={0} defaultFixedCostPercent={0} defaultProfitMargin={0}
  onSaveProduct={value => { savedProduct = value; }} onDeleteProduct={() => {}} onDuplicateProduct={() => {}} />));
await click('#btn-edit-product-vela');
await chooseMaterial('#select-recipe-material-search', 'Cera aromatizada');
await chooseMaterial('#recipe-virtual-category-0', 'Milk-shake de Chocolate');
assert(document.body.textContent?.includes('sem estoque próprio'));
await fill('#input-recipe-qty', '100');
await click('#btn-add-recipe-item');
await click('#btn-save-product');
assert.equal(alerts.length, 0, alerts.join('; '));
assert.equal(savedProduct.items[0].categorySelections.aroma, 'Milk-shake de Chocolate');
assert.equal(savedProduct.fragrance, 'Milk-shake de Chocolate');
close(savedProduct.materialsCost, 39.1);
close(savedProduct.embeddedLaborCost, 0.1);
await act(async () => root.unmount());

const saved = () => JSON.parse(workspaceStorage.getItem('atelie_workspace_finance_v1')!);
const stock = (id: string) => saved().materials.find((m: any) => m.id === id).currentStock;
const mount = async (staged: boolean) => {
  const fixture = virtualFragranceWorkspace();
  fixture.products = [{ ...savedProduct, useProductionStages: staged,
    productionStages: staged ? [{ id: 'base', name: 'Base', order: 0, laborMinutes: 0 }, { id: 'finish', name: 'Finalizar', order: 1, laborMinutes: 0 }] : undefined,
    items: savedProduct.items.map((item: any) => ({ ...item, productionStageId: staged ? 'base' : undefined })) }];
  workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(fixture));
  root = createRoot(document.querySelector('#root')!);
  await act(async () => root.render(<App />));
  await click('[aria-label="Abrir atalhos rápidos"]'); await button('Produções'); await click('#btn-add-production');
  const search = document.querySelector<HTMLInputElement>('input[id$="-model"]')!;
  await act(async () => { search.focus(); search.click(); });
  const modelId = getProductModels(fixture.products, 'production')[0].id;
  const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(node => node.dataset.modelId === modelId)!;
  assert(option);
  await act(async () => option.click());
  await fill('[data-production-row] input[type="number"]', '4');
  await click('#btn-start-productions');
};
await mount(false);
assert.equal(stock('Cera de coco'), 640);
assert.equal(stock('Vanilla'), 80); assert.equal(stock('Chocolate'), 80);
assert.equal(stock('Milk-shake de Chocolate'), 0); assert.equal(stock('Cera aromatizada'), 0);
assert.equal(saved().products[0].currentStock, 4);
close(saved().productions[0].totalCost, 156.4);
assert.deepEqual(new Set(saved().stockMovements.filter((move: any) => move.type === 'material').map((move: any) => move.targetId)), new Set(['Cera de coco', 'Vanilla', 'Chocolate']));
await act(async () => root.unmount());

await mount(true);
assert.equal(stock('Vanilla'), 100, 'Iniciar as etapas ainda não baixa ingredientes.');
const productionId = saved().productions[0].id;
await click(`[data-advance-production="${productionId}"]`);
await fill('.liare-production-detail input[type="number"]', '2');
await button('Registrar etapa');
assert.equal(stock('Cera de coco'), 820); assert.equal(stock('Vanilla'), 90); assert.equal(stock('Chocolate'), 90);
assert.equal(saved().products[0].currentStock, 0);
assert(document.querySelector('.liare-production-detail'), 'O registro parcial continua aberto.');
await button('Registrar etapa');
assert(document.querySelector('.liare-production-detail button[aria-pressed="true"]')?.textContent?.includes('Finalizar'));
await button('Concluir etapa e adicionar ao estoque');
assert.equal(stock('Cera de coco'), 640); assert.equal(stock('Vanilla'), 80); assert.equal(stock('Chocolate'), 80);
assert.equal(stock('Milk-shake de Chocolate'), 0); assert.equal(stock('Cera aromatizada'), 0);
assert.equal(saved().productions[0].status, 'completed');
assert.equal(saved().products[0].currentStock, 4);
close(saved().productions[0].totalCost, 156.4);
assert.equal(alerts.length, 0, alerts.join('; '));
await act(async () => root.unmount());
root = createRoot(document.querySelector('#root')!);
await act(async () => root.render(<App />));
assert.equal(stock('Vanilla'), 80, 'Consumo persistido após reabrir.');
await act(async () => root.unmount());
console.log('App: selecionar essência virtual, salvar aroma/custo, produzir diretamente ou em etapas parciais, consumir só ingredientes reais e reabrir sem estoque virtual passou.');
process.exit(0);
