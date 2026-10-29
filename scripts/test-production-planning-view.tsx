import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { virtualFragranceMaterials as materials, virtualFragranceProduct, ingredient } from './virtualFragranceFixtures';
import { getProductionPlan, buildProductionRecord } from '../src/utils/productionPlanning';
import { autoMaterials, autoProducts, ingredient as autoIngredient } from './automaticManufacturingFixtures';

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
assert(!('forecast' in production), 'A hierarquia da previsão não aumenta os registros salvos.');
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
type ForecastRow = { name: string; quantity: string; children: ForecastRow[] };
const readRow = (node: Element): ForecastRow => {
  const row = node.querySelector(':scope > [data-forecast-row]')!;
  return { name: row.children[0].textContent!, quantity: [...row.children[1].childNodes].filter(child => child.nodeType === 3).map(child => child.textContent).join(''),
    children: [...node.querySelectorAll(':scope > div > ul > li')].map(readRow) };
};
const forecast = (section: Element) => [...section.querySelectorAll(':scope > ul[aria-label="Previsão de insumos"] > li')].map(readRow);
const leaf = (name: string, quantity: string): ForecastRow => ({ name, quantity, children: [] });
const virtualForecast = (wax: number, aroma: number): ForecastRow[] => [{ name: 'Cera aromatizada', quantity: `${wax + aroma * 2} g`,
  children: [leaf('Cera de coco', `${wax} g`), { name: 'Milk-shake de Chocolate', quantity: `${aroma * 2} g`,
    children: [leaf('Vanilla', `${aroma} g`), leaf('Chocolate', `${aroma} g`)] }] }];

// A saved production can be consulted without writing its records.
await render(<ViewProductionModal production={production} product={product} products={[product]} materials={materials} onClose={() => {}} />);
assert(stage('Base'));
assert.deepEqual(forecast(stage('Mesclado e preparo do copo')), [leaf('Cera de coco', '75 g')]);
assert.deepEqual(forecast(stage('Base')), virtualForecast(360, 20));
assert.deepEqual(forecast(stage('Chantilly')), virtualForecast(360, 20));
assert.deepEqual(quantities(document.querySelector('[aria-label="Total geral de insumos"]')!), { 'Cera de coco': '795 g', Vanilla: '40 g', Chocolate: '40 g' });
const quantity = document.querySelector('section[aria-label="Planejamento dos insumos"] input[type="number"]') as HTMLInputElement;
await fill(quantity, '3');
assert.deepEqual(forecast(stage('Base')), virtualForecast(216, 12));
await fill(quantity, '');
assert(document.body.textContent?.includes('Informe uma quantidade inteira'));
await fill(quantity, '5');
const partial = { ...production, stageProgress: production.stageProgress!.map(progress => ({ ...progress, completedQuantity: progress.stageId === 'cup' ? 2 : 0 })) };
await render(<ViewProductionModal production={partial} product={product} products={[product]} materials={materials} onClose={() => {}} />);
await act(async () => (document.querySelector('section[aria-label="Planejamento dos insumos"] input[type="checkbox"]') as HTMLInputElement).click());
assert.deepEqual(forecast(stage('Mesclado e preparo do copo')), [leaf('Cera de coco', '45 g')]);
assert.deepEqual(forecast(stage('Base')), virtualForecast(360, 20));
assert.deepEqual(quantities(document.querySelector('[aria-label="Total geral de insumos"]')!), { 'Cera de coco': '765 g', Vanilla: '40 g', Chocolate: '40 g' });

let advances = 0;
await render(<StageProgressModal production={production} product={product} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
const baseButton = [...document.querySelectorAll('button')].find(button => button.querySelector('p')?.textContent === 'Base')!;
await act(async () => baseButton.click());
let stageQuantity = document.querySelector<HTMLInputElement>('#production-stage-quantity')!;
assert.equal(stageQuantity.value, '5', 'A próxima etapa começa com a quantidade planejada mesmo sem unidades liberadas.');
await fill(stageQuantity, '3');
assert(document.body.textContent?.includes('216 g'));
assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), virtualForecast(216, 12));
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

// The first phase remains readable after all units have moved to the next one.
const firstDone = { ...production, stageProgress: production.stageProgress!.map(stage => ({ ...stage, completedQuantity: stage.stageId === 'cup' ? 5 : 0 })) };
const firstDoneBefore = JSON.stringify(firstDone);
await render(<StageProgressModal key="first-done" production={firstDone} initialStageKey="cup:step" product={product} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
assert.equal(document.querySelector('button[aria-pressed="true"] p')!.textContent, 'Mesclado e preparo do copo');
assert.equal((document.querySelector('#production-stage-quantity') as HTMLInputElement).value, '5');
assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), [leaf('Cera de coco', '75 g')]);
assert(document.body.textContent?.includes('Esta etapa já foi registrada.'));
assert([...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Registrar etapa')!.disabled);
await fill(document.querySelector('#production-stage-quantity')!, '3');
assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), [leaf('Cera de coco', '45 g')]);
await fill(document.querySelector('#production-stage-quantity')!, '8');
assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), [leaf('Cera de coco', '120 g')]);
assert.equal(advances, 0);
assert.equal(JSON.stringify(firstDone), firstDoneBefore, 'Inspecting completed-stage inputs preserves quantities, costs and stock.');

// Older batches saved loose wax/fragrance; newer batches saved the same mix
// as a virtual recipe. The hierarchy stays consistent across the third unit.
const loose = getProductionPlan({ ...product, items: product.items.filter(item => item.productionStageId === 'base') }, 1, materials, [product]).deductions;
const older = buildProductionRecord(getProductionPlan(product, 3, materials, [product]), '2026-10-21', '', true);
older.recipeItemsSnapshot = [...product.items.filter(item => item.productionStageId !== 'base'), ...loose.map(item => ({ ...item, quantity: item.quantityPerBatch, productionStageId: 'base' }))];
older.stageProgress![0].completedQuantity = 3;
const newer = buildProductionRecord(getProductionPlan(product, 5, materials, [product]), '2026-10-29', '', true);
newer.stageProgress![0].completedQuantity = 5;
const grouped = [older, newer];
const groupedBefore = JSON.stringify(grouped);
await render(<StageProgressModal key="consistent-base" production={older} groupProductions={grouped} initialStageKey="base:step" product={product} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
for (let units = 1; units <= 5; units++) {
  await fill(document.querySelector('#production-stage-quantity')!, String(units));
  assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), virtualForecast(72 * units, 4 * units));
  assert(!document.body.textContent?.includes('usam uma composição anterior'));
}
await render(<StageProgressModal key="changed-base" production={older} groupProductions={grouped} initialStageKey="base:step" product={{ ...product, items: product.items.map(item => item.productionStageId === 'base' ? { ...item, quantity: item.quantity * 2 } : item) }} products={[product]} materials={materials} onClose={() => {}} onAdvance={() => { advances++; }} />);
await fill(document.querySelector('#production-stage-quantity')!, '3');
assert.deepEqual(forecast(document.querySelector('ul[aria-label="Previsão de insumos"]')!.parentElement!), virtualForecast(144 * 3, 8 * 3), 'Current quantities replace the earlier formula in future projections.');
assert.equal(JSON.stringify(grouped), groupedBefore);
assert.equal(advances, 0);

// Physical recipes show the full required item first, then only the missing amount's ingredients.
const physicalProduct = { ...autoProducts[1], useProductionStages: true,
  productionStages: [{ id: 'make', name: 'Montagem', order: 0, laborMinutes: 0 }],
  items: autoProducts[1].items.map(item => ({ ...item, productionStageId: 'make' })) };
const physicalProduction = buildProductionRecord(getProductionPlan(physicalProduct, 1, autoMaterials, autoProducts), '2026-10-23', '', true);
await render(<StageProgressModal key="physical" production={physicalProduction} product={physicalProduct} products={autoProducts} materials={autoMaterials} onClose={() => {}} onAdvance={() => { advances++; }} />);
const physicalList = document.querySelector('ul[aria-label="Previsão de insumos"]')!;
assert.deepEqual(forecast(physicalList.parentElement!), [
  { name: 'Decoração', quantity: '2 un', children: [leaf('Mistura pronta', '10 g')] },
  { name: 'Mistura pronta', quantity: '50 g', children: [leaf('Cera', '36 g'), leaf('Essência', '4 g')] },
]);
assert(physicalList.textContent?.includes('Usar 1 un do estoque pronto. Fabricar automaticamente 1 un com:'));
assert(physicalList.textContent?.includes('Usar 10 g do estoque pronto. Fabricar automaticamente 40 g com:'));

// Planning multiple stages shares ready stock, so it is not promised twice.
const sharedProduct = { ...physicalProduct, productionStages: [
  { id: 'first', name: 'Primeira', order: 0, laborMinutes: 0 },
  { id: 'second', name: 'Segunda', order: 1, laborMinutes: 0 },
], items: ['first', 'second'].map(id => ({ ...autoIngredient('blend', 'material', 15), id, productionStageId: id })) };
const sharedProduction = buildProductionRecord(getProductionPlan(sharedProduct, 1, autoMaterials, autoProducts), '2026-10-23', '', true);
await render(<ViewProductionModal key="shared" production={sharedProduction} product={sharedProduct} products={autoProducts} materials={autoMaterials} onClose={() => {}} />);
assert.deepEqual(forecast(stage('Primeira')), [leaf('Mistura pronta', '15 g')]);
assert.deepEqual(forecast(stage('Segunda')), [{ name: 'Mistura pronta', quantity: '15 g', children: [leaf('Cera', '9 g'), leaf('Essência', '1 g')] }]);
assert(stage('Segunda').textContent?.includes('Usar 5 g do estoque pronto. Fabricar automaticamente 10 g com:'));
assert.deepEqual(quantities(document.querySelector('[aria-label="Total geral de insumos"]')!), { 'Mistura pronta': '20 g', Cera: '9 g', Essência: '1 g' });
assert.equal(advances, 0, 'Previsões não registram produção.');
await act(async () => root.unmount());
console.log('Planejamento: receita antes dos insumos, composição aninhada, fabricação só da falta, estoque compartilhado entre etapas, soma geral, simulação, snapshot preservado e baixa bloqueada até liberar a etapa passaram.');
