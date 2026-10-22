import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { virtualFragranceMaterials as materials, virtualFragranceProduct, ingredient } from './virtualFragranceFixtures';
import { getProductionPlan, buildProductionRecord } from '../src/utils/productionPlanning';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent'])
  Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => { throw Error(message); } });
const { createRoot } = await import('react-dom/client');
const { ViewProductionModal, StageProgressModal } = await import('../src/components/ProductionDetails');
const product = { ...virtualFragranceProduct, useProductionStages: true,
  productionStages: [
    { id: 'cup', name: 'Mesclado e preparo do copo', order: 0, laborMinutes: 0 },
    { id: 'base', name: 'Base', order: 1, laborMinutes: 0 },
    { id: 'top', name: 'Chantilly', order: 2, laborMinutes: 0 },
  ],
  items: [
    { ...ingredient('cup-wax', 'Cera de coco', 15), productionStageId: 'cup' },
    { ...virtualFragranceProduct.items[0], quantity: 80, productionStageId: 'base' },
    { ...virtualFragranceProduct.items[0], id: 'top-wax', quantity: 80, productionStageId: 'top' },
  ],
};
const production = buildProductionRecord(getProductionPlan(product, 5, materials, [product]), '2026-10-22', 'Organizar bancada', true);
const stateBefore = JSON.stringify({ production, materials, product });
const root = createRoot(document.querySelector('#root')!);
const render = async (node: React.ReactNode) => act(async () => root.render(node));
const fill = async (node: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(node, value);
  node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const stage = (name: string) => document.querySelector<HTMLElement>(`[aria-label="Planejamento: ${name}"]`)!;
const quantities = (section: Element) => Object.fromEntries([...section.querySelectorAll('li')].map(row =>
  [row.querySelector('span')!.textContent, row.querySelectorAll('span')[1].textContent]));

// A saved production uses its composition snapshot even if the live recipe changes.
await render(<ViewProductionModal production={production} product={{ ...product, items: [] }} products={[product]} materials={materials} onClose={() => {}} />);
assert(stage('Base'));
assert.deepEqual(quantities(stage('Mesclado e preparo do copo')), { 'Cera de coco': '75 g' });
assert.deepEqual(quantities(stage('Base')), { 'Cera de coco': '360 g', Vanilla: '20 g', Chocolate: '20 g' });
assert.deepEqual(quantities(stage('Chantilly')), { 'Cera de coco': '360 g', Vanilla: '20 g', Chocolate: '20 g' });
assert.deepEqual(quantities(document.querySelector('[aria-label="Total geral de insumos"]')!), { 'Cera de coco': '795 g', Vanilla: '40 g', Chocolate: '40 g' });
const quantity = document.querySelector('section[aria-label="Planejamento dos insumos"] input[type="number"]') as HTMLInputElement;
await fill(quantity, '3');
assert.deepEqual(quantities(stage('Base')), { 'Cera de coco': '216 g', Vanilla: '12 g', Chocolate: '12 g' });
await fill(quantity, '');
assert(document.body.textContent?.includes('Informe uma quantidade inteira'));
await fill(quantity, '5');
const partial = { ...production, stageProgress: production.stageProgress!.map(progress => ({ ...progress, completedQuantity: progress.stageId === 'cup' ? 2 : 0 })) };
await render(<ViewProductionModal production={partial} product={product} products={[product]} materials={materials} onClose={() => {}} />);
await act(async () => (document.querySelector('section[aria-label="Planejamento dos insumos"] input[type="checkbox"]') as HTMLInputElement).click());
assert.deepEqual(quantities(stage('Mesclado e preparo do copo')), { 'Cera de coco': '45 g' });
assert.deepEqual(quantities(stage('Base')), { 'Cera de coco': '360 g', Vanilla: '20 g', Chocolate: '20 g' });
assert.deepEqual(quantities(document.querySelector('[aria-label="Total geral de insumos"]')!), { 'Cera de coco': '765 g', Vanilla: '40 g', Chocolate: '40 g' });

let advances = 0;
await render(<StageProgressModal production={production} product={product} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
const baseButton = [...document.querySelectorAll('button')].find(button => button.querySelector('p')?.textContent === 'Base')!;
await act(async () => baseButton.click());
let stageQuantity = document.querySelector<HTMLInputElement>('#production-stage-quantity')!;
assert.equal(stageQuantity.value, '5', 'A próxima etapa começa com a quantidade planejada mesmo sem unidades liberadas.');
await fill(stageQuantity, '3');
assert(document.body.textContent?.includes('216 g'));
const register = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Registrar etapa')!;
assert(register.disabled, 'A simulação não libera etapas fora da ordem.');
await act(async () => register.click());
assert.equal(advances, 0);
assert.equal(JSON.stringify({ production, materials, product }), stateBefore, 'Consultar/simular não altera estoque, custos, etapas ou a ordem.');
await render(<StageProgressModal production={partial} product={product} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
stageQuantity = document.querySelector<HTMLInputElement>('#production-stage-quantity')!;
assert.equal(stageQuantity.value, '2');
assert(!([...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Registrar etapa')!).disabled);
await fill(stageQuantity, '3');
assert(([...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Registrar etapa')!).disabled);
assert.equal(advances, 0);
await act(async () => root.unmount());
console.log('Planejamento: cinco unidades por etapa, ingredientes virtuais separados, soma geral, simulação, restante parcial, snapshot preservado e baixa bloqueada até liberar a etapa passaram.');
