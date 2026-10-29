import assert from 'node:assert/strict';
import { productionWorkspace } from '../../scripts/productionFixtures';
import { buildProductionRecord, getProductionPlan } from './productionPlanning';
import { applyProductionStageAdvances, groupActiveProductions, planGroupedStageAdvance, previewGroupedStage, summarizeProductionGroup } from './productionFlow';
import { autoMaterials, autoProducts } from '../../scripts/automaticManufacturingFixtures';

const fixture = productionWorkspace();
const product = fixture.products[0];
const make = (id: string, quantity: number, date = '2026-10-28') => ({
  ...buildProductionRecord(getProductionPlan(product, quantity, fixture.materials, fixture.products), date, id, true), id,
});
let workspace = { ...fixture, productions: [make('first', 4), make('second', 3, '2026-10-29')] };
const before = structuredClone(workspace);
const quantities = () => summarizeProductionGroup(workspace.productions).stages.map(stage => stage.quantity);
const advance = (key: string, quantity: number) => {
  const plan = planGroupedStageAdvance(workspace.productions, key, quantity, product, workspace.materials, workspace.products);
  assert(plan.canRegister);
  assert.deepEqual(plan.errors, []);
  const previous = workspace;
  workspace = applyProductionStageAdvances(workspace, plan.advances);
  assert.equal(applyProductionStageAdvances(workspace, plan.advances), workspace, 'Retries never consume stock or add finished goods twice.');
  assert.notEqual(workspace, previous);
  return plan;
};
assert.equal(groupActiveProductions(workspace.productions).length, 1);
assert.deepEqual(quantities(), [7, 0]);
assert.equal(summarizeProductionGroup(workspace.productions).remaining, 7);
assert(!planGroupedStageAdvance(workspace.productions, 'label:final', 1, product, workspace.materials, workspace.products).canRegister);
assert(!planGroupedStageAdvance(workspace.productions, 'base:step', 1.5, product, workspace.materials, workspace.products).canRegister);
assert.deepEqual(workspace, before, 'Grouping and preview do not modify stored records.');
const combined = advance('base:step', 5);
assert.deepEqual(combined.advances.map(item => [item.production.id, item.production.stageProgress![0].completedQuantity]), [['first', 4], ['second', 1]]);
assert.equal(combined.forecast.find(node => node.item.targetId === 'wax')!.quantityTotal, 50);
assert.equal(workspace.materials.find(item => item.id === 'wax')!.currentStock, 950);
assert.deepEqual(quantities(), [2, 5]);
advance('label:final', 3);
assert.deepEqual(quantities(), [2, 2]);
assert.equal(summarizeProductionGroup(workspace.productions).remaining, 4);
assert.equal(workspace.products[0].currentStock, 3);
advance('label:final', 2);
assert.deepEqual(quantities(), [2, 0]);
assert.equal(workspace.productions[0].status, 'completed');
assert.equal(workspace.productions[0].notes, 'first');
assert.equal(workspace.productions[0].targetQuantity, 4, 'Historical batch quantities are preserved.');
workspace.productions.push(make('third', 5, '2026-10-29'));
assert.equal(groupActiveProductions(workspace.productions).length, 1);
assert.deepEqual(quantities(), [7, 0]);
assert.equal(summarizeProductionGroup(workspace.productions).remaining, 7);
advance('base:step', 7);
advance('label:final', 7);
assert.equal(groupActiveProductions(workspace.productions).length, 0);
assert.equal(workspace.products[0].currentStock, 12);
assert.deepEqual(quantities(), [0, 0]);
assert.equal(workspace.productions.length, 3, 'Grouping does not merge or erase history.');
assert.equal(workspace.materials[0].currentStock, 880);

// Each part of a combined phase consumes its own saved recipe, while sharing
// the real stock (including automatic preparation of missing components).
const a = make('a', 2), b = make('b', 2);
b.recipeItemsSnapshot = b.recipeItemsSnapshot!.map(item => item.targetId === 'vanilla' ? { ...item, targetId: 'tea', name: 'Chá Branco' } : item);
const different = planGroupedStageAdvance([a, b], 'base:step', 4, { ...product, items: [] }, fixture.materials, fixture.products);
assert(different.canRegister);
assert.equal(different.advances[0].deductions.find(item => item.targetId === 'vanilla')!.quantityTotal, 2);
assert.equal(different.advances[1].deductions.find(item => item.targetId === 'tea')!.quantityTotal, 2);
assert.equal(different.advances[1].deductions.find(item => item.targetId === 'wax')!.stockBefore, 980);
const firstStageDone = [a, b].map(production => ({ ...production,
  stageProgress: production.stageProgress!.map(stage => ({ ...stage, completedQuantity: stage.stageId === 'base' ? 2 : 0 })) }));
const firstStageBefore = structuredClone({ firstStageDone, materials: fixture.materials, products: fixture.products });
const firstStagePreview = previewGroupedStage(firstStageDone, 'base:step', 4, { ...product, items: [] }, fixture.materials, fixture.products);
assert.deepEqual(firstStagePreview.errors, []);
assert.equal(firstStagePreview.forecast.find(node => node.item.targetId === 'wax')!.quantityTotal, 40);
assert.equal(firstStagePreview.forecast.find(node => node.item.targetId === 'vanilla')!.quantityTotal, 2);
assert.equal(firstStagePreview.forecast.find(node => node.item.targetId === 'tea')!.quantityTotal, 2, 'Completed phases retain each batch snapshot in their previews.');
assert(!('advances' in firstStagePreview), 'A consultation cannot construct progress updates.');
assert(!planGroupedStageAdvance(firstStageDone, 'base:step', 4, product, fixture.materials, fixture.products).canRegister, 'Consulting inputs never reopens a completed phase.');
const expandedPreview = previewGroupedStage(firstStageDone, 'base:step', 7, product, fixture.materials, fixture.products);
assert.equal(expandedPreview.forecast.find(node => node.item.targetId === 'wax')!.quantityTotal, 70, 'Simulation includes all requested units, even above the remaining batch quantity.');
assert.deepEqual({ firstStageDone, materials: fixture.materials, products: fixture.products }, firstStageBefore);
const completedRecords = firstStageDone.map(production => ({ ...production, status: 'completed' as const, quantityProduced: 2 }));
assert.equal(previewGroupedStage(completedRecords, 'base:step', 3, product, fixture.materials, fixture.products).forecast.find(node => node.item.targetId === 'wax')!.quantityTotal, 30);
const source = { ...fixture, productions: [a, b] };
const stale = structuredClone(source);
stale.productions[1].notes = 'Changed elsewhere';
const staleBefore = structuredClone(stale);
assert.throws(() => applyProductionStageAdvances(stale, different.advances), /outra alteração/);
assert.deepEqual(stale, staleBefore, 'A stale second record cannot partially save the first record.');
const staleStock = { ...source, materials: source.materials.map(item => item.id === 'wax' ? { ...item, currentStock: 900 } : item) };
assert.throws(() => applyProductionStageAdvances(staleStock, different.advances), /estoque mudou/);
assert.equal(staleStock.productions[0].stageProgress![0].completedQuantity, 0);
const lowStock = fixture.materials.map(item => item.id === 'wax' ? { ...item, currentStock: 25 } : item);
const shortage = planGroupedStageAdvance([a, b], 'base:step', 4, product, lowStock, fixture.products);
assert(shortage.shortage, 'A shared shortage is detected even when each batch would fit separately.');
assert.equal(applyProductionStageAdvances({ ...source, materials: lowStock }, shortage.advances).materials[0].currentStock, 0);
const veryLowStock = fixture.materials.map(item => item.id === 'wax' ? { ...item, currentStock: 5 } : item);
const multipleShortages = planGroupedStageAdvance([a, b], 'base:step', 4, product, veryLowStock, fixture.products);
assert.equal(multipleShortages.forecast.find(node => node.item.targetId === 'wax')!.stockAfter, -35, 'The warning sums all missing inputs, including multiple allocations at zero stock.');

const physicalProduct = { ...autoProducts[1], useProductionStages: true,
  productionStages: [{ id: 'make', name: 'Montagem', order: 0, laborMinutes: 0 }],
  items: autoProducts[1].items.map(item => ({ ...item, productionStageId: 'make' })) };
const physicalRecords = ['physical-a', 'physical-b'].map(id => ({
  ...buildProductionRecord(getProductionPlan(physicalProduct, 1, autoMaterials, autoProducts), '2026-10-29', '', true), id,
}));
const physicalPlan = planGroupedStageAdvance(physicalRecords, 'make:final', 2, physicalProduct, autoMaterials, autoProducts);
assert(physicalPlan.canRegister);
const decoration = physicalPlan.forecast.find(node => node.item.targetId === 'decoration')!;
assert.equal(decoration.stockQuantity, 1);
assert.equal(decoration.manufactureQuantity, 3, 'Both batches share ready component stock, preparing only the combined deficit.');
const physicalSource = { productions: physicalRecords, products: autoProducts, materials: autoMaterials };
const physicalResult = applyProductionStageAdvances(physicalSource, physicalPlan.advances);
assert.equal(physicalResult.products.find(item => item.id === 'decoration')!.currentStock, 0);
assert.equal(physicalResult.products.find(item => item.id === physicalProduct.id)!.currentStock, (physicalProduct.currentStock || 0) + 2);
assert.equal(applyProductionStageAdvances(physicalResult, physicalPlan.advances), physicalResult);
const activeComponent = { ...physicalRecords[0], id: 'already-making-decoration', productId: 'decoration' };
assert.throws(() => applyProductionStageAdvances({ ...physicalSource, productions: [...physicalRecords, activeComponent] }, physicalPlan.advances), /em andamento/);

const untracked = [a, b].map(production => ({ ...production, stockTrackingEnabled: false }));
let untrackedSource = { ...fixture, productions: untracked };
for (const key of ['base:step', 'label:final']) {
  const plan = planGroupedStageAdvance(untrackedSource.productions, key, 4, product, untrackedSource.materials, untrackedSource.products);
  untrackedSource = applyProductionStageAdvances(untrackedSource, plan.advances);
}
assert.equal(untrackedSource.products[0].currentStock, 0);
assert.deepEqual(untrackedSource.materials, fixture.materials);
assert.equal(groupActiveProductions(untrackedSource.productions).length, 0);
assert.equal(groupActiveProductions([a, { ...b, productId: 'another-aroma' }]).length, 2, 'Aromas remain distinct products.');
assert.equal(groupActiveProductions([{ ...a, status: undefined, quantityProduced: 2 }]).length, 0, 'Legacy completed history stays outside active work.');
console.log('Produção agrupada: filas exclusivas, conclusão parcial, novos registros, baixa conjunta, snapshots, estoque compartilhado, histórico, repetição e conflitos passaram.');
