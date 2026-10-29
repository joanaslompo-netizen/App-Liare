import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { productionWorkspace } from './productionFixtures';
import { buildProductionRecord, getProductionPlan } from '../src/utils/productionPlanning';
import { applyProductionStageAdvances, planGroupedStageAdvance } from '../src/utils/productionFlow';
import type { ProductionProject } from '../src/types';
import { formatCurrency } from '../src/utils/formatters';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (text: string) => { throw Error(text); } });
const { createRoot } = await import('react-dom/client');
const { ProjectsView } = await import('../src/components/ProjectsView');
const { StageProgressModal } = await import('../src/components/ProductionDetails');
let root = createRoot(document.querySelector('#root')!);
const fixture = productionWorkspace(), product = fixture.products[0];
const project: ProductionProject = { id: 'project', name: 'Planejamento de teste', status: 'in_progress', createdAt: '2026-10-20', updatedAt: '2026-10-20',
  lines: [{ id: 'catalog', source: 'catalog', productId: product.id, name: 'Nome salvo anteriormente', quantity: 5, producedQuantity: 0, batchYield: 10 },
    { id: 'custom', source: 'custom', name: 'Personalizado exclusivo', quantity: 2, producedQuantity: 0, batchYield: 1, customRecipeItems: [{ ...product.items[0], quantity: 10 }] }],
  checklist: [{ id: 'manual', text: 'Anotação de trabalho', completed: true }] };
const beforeProject = JSON.stringify(project);
let saves = 0;
const renderProject = async (current = product, materials = fixture.materials) => act(async () => root.render(<ProjectsView projects={[project]} products={[current]} materials={materials} onSaveProject={() => { saves++; }} onDeleteProject={() => { saves++; }} />));
const clickText = async (text: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text);
  assert(button, text); await act(async () => button.click());
};
const materialQuantity = (name: string) => [...document.querySelectorAll('tbody tr')].find(row => row.querySelector('td')?.textContent?.startsWith(name))?.querySelectorAll('td')[1]?.textContent;
await renderProject();
await clickText('Ver materiais, receitas e anotações');
assert.equal(materialQuantity('Cera'), '70 g');
assert(document.body.textContent?.includes('Fabricação → Rotulagem'));
const latest = { ...product, name: 'Modelo atualizado', batchYield: 5, unitCostFromBatch: 20, actualPrice: 55,
  items: product.items.map(item => item.targetId === 'wax' ? { ...item, quantity: 200 } : item),
  productionStages: product.productionStages!.map(stage => stage.id === 'label' ? { ...stage, name: 'Embalagem atual' } : stage) };
await renderProject(latest);
assert.equal(materialQuantity('Cera'), '220 g', 'A saved project follows the new quantity and yield immediately.');
assert(document.body.textContent?.includes('Modelo atualizado'));
assert(!document.body.textContent?.includes('Nome salvo anteriormente'));
assert(document.body.textContent?.includes('Fabricação → Embalagem atual'));
assert(document.body.textContent?.includes(formatCurrency(120)));
assert(document.body.textContent?.includes('Personalizado exclusivo'));
assert.equal(JSON.stringify(project), beforeProject);
assert.equal(saves, 0, 'Opening and updating projections do not save or move stock.');

// Virtual-material choices also follow the latest catalog recipe.
const blend = { ...fixture.materials[0], id: 'blend', name: 'Mistura', isVirtualRecipe: true, currentStock: 0, batchYield: 100,
  recipeItems: [{ ...product.items[0], quantity: 90 }, { ...product.items[1], id: 'choice', quantity: 10, selectionMode: 'category' as const, targetCategory: fixture.materials[1].category }] };
const virtual = { ...product, batchYield: 1, items: [{ ...product.items[0], id: 'mix', targetId: 'blend', quantity: 80, categorySelections: { choice: 'tea' } }] };
await renderProject(virtual, [...fixture.materials, blend]);
assert.equal(materialQuantity('Chá Branco'), '40 g');
assert(!document.body.textContent?.includes('Escolher em:'));

await act(async () => root.unmount()); root = createRoot(document.querySelector('#root')!);
let workspace = { ...fixture, productions: [buildProductionRecord(getProductionPlan(product, 5, fixture.materials, fixture.products), '2026-10-20', '', true)] };
workspace = applyProductionStageAdvances(workspace, planGroupedStageAdvance(workspace.productions, 'base:step', 2, product, workspace.materials, workspace.products).advances);
const originalHistory = structuredClone(workspace.productions[0]);
let current = product;
const renderStage = () => root.render(<StageProgressModal production={workspace.productions[0]} product={current} products={workspace.products} materials={workspace.materials} onClose={() => {}} onAdvanceBatch={advances => {
  workspace = applyProductionStageAdvances(workspace, advances); renderStage();
}} />);
await act(async () => renderStage());
assert(document.querySelector('ul[aria-label="Previsão de insumos"]')!.textContent?.includes('30 g'));
current = { ...product, items: product.items.map(item => item.targetId === 'wax' ? { ...item, quantity: 300 } : item),
  productionStages: product.productionStages!.map(stage => stage.id === 'base' ? { ...stage, id: 'updated-base', name: 'Preparo novo' } : stage) };
current.items = current.items.map(item => item.productionStageId === 'base' ? { ...item, productionStageId: 'updated-base' } : item);
workspace = { ...workspace, products: workspace.products.map(item => item.id === current.id ? current : item) };
await act(async () => renderStage());
assert(document.querySelector('button[aria-pressed="true"]')!.textContent?.includes('Preparo novo'), 'A removed stage selection moves to the current recipe automatically.');
assert(document.querySelector('ul[aria-label="Previsão de insumos"]')!.textContent?.includes('90 g'));
assert.equal(workspace.materials[0].currentStock, 980);
await clickText('Registrar etapa');
assert.equal(workspace.materials[0].currentStock, 890);
assert.equal(workspace.productions[0].recipeHistory![0].stages[0].completedQuantity, originalHistory.stageProgress![0].completedQuantity);
assert.equal(workspace.productions[0].stageProgress![0].stageName, 'Preparo novo');
const reloaded = JSON.parse(JSON.stringify(workspace)); workspace = reloaded;
await act(async () => root.unmount()); root = createRoot(document.querySelector('#root')!);
await act(async () => renderStage());
assert(document.body.textContent?.includes('Preparo novo'));
assert.equal(workspace.materials[0].currentStock, 890);
await act(async () => root.unmount());
console.log('Projetos e etapas: atualização imediata de nome, fórmula, rendimento, custos, escolhas virtuais e fases; personalizados, checklist, estoque e histórico preservados; registro e reabertura passaram.');
