import assert from 'node:assert/strict';
import { productionWorkspace } from '../../scripts/productionFixtures';
import { buildProductionRecord, getProductionPlan } from './productionPlanning';
import { applyProductionStageAdvances, groupActiveProductions, planGroupedStageAdvance, previewGroupedStage, projectProductionCost, summarizeProductionGroup } from './productionFlow';
import { resolveProductionRecipe } from './productionRecipe';
import type { Product } from '../types';

const fixture = productionWorkspace(), originalProduct = fixture.products[0];
const make = () => ({ ...fixture, productions: [buildProductionRecord(getProductionPlan(originalProduct, 5, fixture.materials, fixture.products), '2026-10-29', '', true)] });
const withProduct = (workspace: ReturnType<typeof make>, product: Product) => ({ ...workspace, products: workspace.products.map(item => item.id === product.id ? { ...product, currentStock: item.currentStock } : item) });
const stage = (workspace: ReturnType<typeof make>, key: string, units: number) => {
  const product = workspace.products[0];
  const plan = planGroupedStageAdvance(workspace.productions, key, units, product, workspace.materials, workspace.products);
  assert(plan.canRegister, `${key} allows ${units} units`);
  assert.deepEqual(plan.errors, []);
  const result = applyProductionStageAdvances(workspace, plan.advances);
  assert.equal(applyProductionStageAdvances(result, plan.advances), result);
  return result;
};
const stock = (workspace: ReturnType<typeof make>, id: string) => workspace.materials.find(item => item.id === id)!.currentStock;
const queues = (workspace: ReturnType<typeof make>) => summarizeProductionGroup(workspace.productions, workspace.products[0]).stages.map(item => item.quantity);

let workspace = stage(make(), 'base:step', 2);
const past = structuredClone(workspace);
const updated = { ...originalProduct, batchYield: 5, productionStages: originalProduct.productionStages!.map(stage => stage.id === 'base' ? { ...stage, name: 'Preparo atualizado' } : stage) };
workspace = withProduct(workspace, updated);
const snapshot = structuredClone(workspace);
const preview = previewGroupedStage(workspace.productions, 'base:step', 3, updated, workspace.materials, workspace.products);
assert.equal(preview.forecast.find(node => node.item.targetId === 'wax')!.quantityTotal, 60);
assert.deepEqual(workspace, snapshot, 'Opening and projecting never rewrites the project or inventory.');
assert(projectProductionCost(workspace.productions[0], updated, workspace.materials, workspace.products) > projectProductionCost(past.productions[0], originalProduct, past.materials, past.products));
workspace = stage(workspace, 'base:step', 3);
assert.equal(stock(workspace, 'wax'), 920);
assert.deepEqual(workspace.productions[0].recipeHistory![0].stages, past.productions[0].stageProgress);
assert.deepEqual(workspace.productions[0].recipeHistory![0].items, past.productions[0].recipeItemsSnapshot);
assert.equal(workspace.productions[0].batchYield, 5);
workspace = stage(workspace, 'label:final', 5);
assert.equal(stock(workspace, 'label'), 90);
assert.equal(workspace.products[0].currentStock, 5);
assert.equal(workspace.productions[0].status, 'completed');
assert.equal(resolveProductionRecipe(workspace.productions[0], originalProduct), workspace.productions[0], 'Completed history is never recalculated.');

// Inserting a step applies only to unfinished pieces, including those that
// already passed other steps. Queues still count each piece exactly once.
let inserted = stage(stage(make(), 'base:step', 5), 'label:final', 2);
const insertedProduct = { ...originalProduct, productionStages: [originalProduct.productionStages![0],
  { id: 'new', name: 'Decoração nova', order: 0.5, laborMinutes: 1 }, originalProduct.productionStages![1]],
  items: [...originalProduct.items, { ...originalProduct.items[1], id: 'new-row', targetId: 'tea', name: 'Chá Branco', quantity: 10, productionStageId: 'new' }] };
inserted = withProduct(inserted, insertedProduct);
assert.deepEqual(queues(inserted), [0, 3, 0]);
assert.equal(groupActiveProductions(inserted.productions, inserted.products).length, 1);
inserted = stage(inserted, 'new:step', 3);
assert.deepEqual(queues(inserted), [0, 0, 3]);
assert.equal(stock(inserted, 'wax'), 950);
inserted = stage(inserted, 'label:final', 3);
assert.equal(inserted.products[0].currentStock, 5);
assert.equal(stock(inserted, 'tea'), 97);

// Merging two steps cannot reconsume wax already used in the first one.
let merged = stage(stage(make(), 'base:step', 5), 'label:final', 2);
const mergedProduct = { ...originalProduct, productionStages: [{ ...originalProduct.productionStages![0], name: 'Montagem e finalização' }],
  items: originalProduct.items.map(item => ({ ...item, productionStageId: 'base' })) };
merged = withProduct(merged, mergedProduct);
assert.deepEqual(queues(merged), [3]);
const merging = planGroupedStageAdvance(merged.productions, 'base:final', 3, mergedProduct, merged.materials, merged.products);
assert.deepEqual(merging.advances[0].deductions.map(item => [item.targetId, item.quantityTotal]), [['label', 3]]);
const priorCost = merged.productions[0].totalCost;
merged = applyProductionStageAdvances(merged, merging.advances);
assert.equal(stock(merged, 'wax'), 950);
assert.equal(stock(merged, 'label'), 95);
assert.equal(merged.productions[0].totalCost, priorCost + 3, 'Already registered labor is not charged twice.');
assert.equal(merged.products[0].currentStock, 5);
assert.equal(new Set(merged.stockMovements.map(item => item.id)).size, merged.stockMovements.length, 'Recipe updates cannot reuse movement IDs after stage counters change.');
let rebuiltRows = stage(stage(make(), 'base:step', 5), 'label:final', 2);
const rebuiltProduct = { ...mergedProduct, items: mergedProduct.items.map(item => ({ ...item, id: `rebuilt-${item.id}` })) };
rebuiltRows = withProduct(rebuiltRows, rebuiltProduct);
const rebuiltPlan = planGroupedStageAdvance(rebuiltRows.productions, 'base:final', 3, rebuiltProduct, rebuiltRows.materials, rebuiltRows.products);
assert.deepEqual(rebuiltPlan.advances[0].deductions.map(item => [item.targetId, item.quantityTotal]), [['label', 3]], 'Recreated rows with uniquely matching ingredients preserve earlier work.');
rebuiltRows = applyProductionStageAdvances(rebuiltRows, rebuiltPlan.advances);
assert.equal(stock(rebuiltRows, 'wax'), 950);
assert.equal(rebuiltRows.products[0].currentStock, 5);

// Removing the last pending step does not create finished stock just by opening.
let removed = stage(make(), 'base:step', 5);
removed = withProduct(removed, { ...originalProduct, items: originalProduct.items.filter(item => item.productionStageId === 'base'), productionStages: [originalProduct.productionStages![0]] });
const removedBefore = structuredClone(removed);
assert.deepEqual(queues(removed), [0, 5]);
assert.deepEqual(removed, removedBefore);
const newAfterRemoval = buildProductionRecord(getProductionPlan(removed.products[0], 5, removed.materials, removed.products), '2026-10-29', '', true);
const mixedRemoval = { ...removed, productions: [...removed.productions, newAfterRemoval] };
const mixedStages = summarizeProductionGroup(mixedRemoval.productions, removed.products[0]);
assert.equal(mixedStages.stages.filter(stage => stage.stageName === 'Fabricação').length, 1, 'A stock confirmation does not split the same recipe phase into two cards.');
assert.equal(mixedStages.stages.reduce((sum, stage) => sum + stage.quantity, 0), mixedStages.remaining);
removed = stage(removed, 'current_recipe_release:final', 5);
assert.equal(removed.products[0].currentStock, 5);
assert.equal(stock(removed, 'label'), 100);

// Reordering preserves work even when the last outstanding step now comes first.
let reordered = stage(make(), 'base:step', 5);
reordered = withProduct(reordered, { ...originalProduct, productionStages: originalProduct.productionStages!.map(stage => ({ ...stage, order: stage.id === 'label' ? 0 : 1 })) });
assert.deepEqual(queues(reordered), [5, 0]);
reordered = stage(reordered, 'label:step', 5);
assert.equal(reordered.products[0].currentStock, 5);
assert.equal(stock(reordered, 'wax'), 950);

// Added ingredients do not reopen an already registered phase; future phases
// and unregistered units immediately use their updated quantities instead.
let added = stage(make(), 'base:step', 5);
const addedProduct = { ...originalProduct, items: [...originalProduct.items,
  { ...originalProduct.items[1], id: 'new-base-row', targetId: 'tea', productionStageId: 'base' },
  { ...originalProduct.items[1], id: 'new-label-row', targetId: 'tea', productionStageId: 'label' }] };
added = withProduct(added, addedProduct);
assert.deepEqual(queues(added), [0, 5]);
added = stage(added, 'label:final', 5);
assert.equal(stock(added, 'tea'), 95);
assert.equal(added.products[0].currentStock, 5);

const pending = make();
const prepared = planGroupedStageAdvance(pending.productions, 'base:step', 2, originalProduct, pending.materials, pending.products);
const changedDuringSave = withProduct(pending, { ...originalProduct, items: originalProduct.items.map(item => ({ ...item, quantity: item.quantity * 2 })) });
assert.throws(() => applyProductionStageAdvances(changedDuringSave, prepared.advances), /receita foi atualizada/);
assert.equal(stock(changedDuringSave, 'wax'), 1000);
assert.equal(changedDuringSave.productions[0].totalCost, 0);
console.log('Receita atual: quantidades, rendimento, fases adicionadas/unidas/removidas/reordenadas, filas exclusivas, histórico, custos, idempotência e proteção contra receita desatualizada passaram.');
