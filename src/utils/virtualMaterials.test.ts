import assert from 'node:assert/strict';
import { virtualFragranceMaterials as materials, virtualFragranceProduct as product, ingredient } from '../../scripts/virtualFragranceFixtures';
import { expandVirtualRecipeItems, getCategoryMaterialOptions, materialRecipeCosts } from './virtualMaterials';
import { getProductionPlan, getProductionVariableRequirements, buildProductionRecord } from './productionPlanning';
import { estimateMaterialUnitCost, recalculateProductPricing } from './storage';
import { getProductFinancialSplit } from './financials';

const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const before = JSON.stringify({ materials, product });
assert(getCategoryMaterialOptions(materials, 'Essências', 'g').some(m => m.id === 'Milk-shake de Chocolate'));
close(estimateMaterialUnitCost(materials[4], materials, new Set(), { aroma: materials[3].id }), 0.391);
close(product.materialsCost, 39.1);
close(product.embeddedLaborCost!, 0.1);
close(getProductFinancialSplit(product).businessCostPerUnit, 39);
close(getProductFinancialSplit(product).laborRemunerationPerUnit, 0.1);
const plan = getProductionPlan(product, 4, materials, [product]);
assert.equal(plan.hasMissingVariableSelection, false);
assert.equal(plan.hasStockShortage, false);
assert.deepEqual(Object.fromEntries(plan.deductions.map(d => [d.targetId, d.quantityTotal])), {
  'Cera de coco': 360, Vanilla: 20, Chocolate: 20,
});
close(plan.totalCost, 156.4);
assert(!plan.deductions.some(d => d.targetId === materials[3].id || d.targetId === materials[4].id));
const low = getProductionPlan(product, 4, materials.map(m => m.id === 'Chocolate' ? { ...m, currentStock: 19 } : m), [product]);
assert(low.hasStockShortage, 'O alerta considera o ingrediente real da mistura.');
const staged = { ...product, useProductionStages: true, productionStages: [{ id: 'base', name: 'Base', order: 0, laborMinutes: 0 }] };
const record = buildProductionRecord(getProductionPlan(staged, 4, materials, [staged]), '2026-10-22', '', true);
assert.equal(record.deductedItems.length, 0, 'Iniciar a produção por etapas apenas planeja o consumo.');

// Nested overhead belongs to production once; labor still stays outside financial cost.
const overhead = materials.map(m => m.id === materials[3].id ? { ...m, recipeFixedCostPercent: 10, recipeOtherCosts: 2 } : m);
const repriced = recalculateProductPricing(product, overhead, [product]);
close(repriced.materialsCost, 42.31);
close(repriced.embeddedLaborCost!, 0.1);
close(getProductionPlan(repriced, 4, overhead, [repriced]).totalCost, 169.24);
const changed = materials.map(m => m.id === 'Chocolate' ? { ...m, unitCost: 6 } : m);
close(recalculateProductPricing(product, changed, [product]).materialsCost, 49.1);
const repeated = getProductionPlan({ ...product, items: [...product.items, { ...ingredient('direct', 'Vanilla', 2) }] }, 4, materials, [product]);
assert.equal(repeated.deductions.find(d => d.targetId === 'Vanilla')!.quantityTotal, 28, 'Consumo repetido é somado.');
const physical = materials.map(m => m.id === materials[3].id ? { ...m, isVirtualRecipe: false, currentStock: 100 } : m);
assert(getProductionPlan(product, 4, physical, [product]).deductions.some(d => d.targetId === materials[3].id && d.quantityTotal === 40), 'Misturas com estoque continuam consumindo o próprio estoque.');

// Category choices made at production are also expanded; old flat keys remain valid.
const unset = { ...product, items: product.items.map(item => ({ ...item, categorySelections: undefined })) };
const requirement = getProductionVariableRequirements(unset, materials)[0];
assert(getProductionPlan(unset, 4, materials, [product]).hasMissingVariableSelection);
assert.equal(requirement.key, 'mixture::Cera aromatizada::aroma');
assert.deepEqual(getProductionPlan(unset, 4, materials, [product], { [requirement.key]: materials[3].id }).deductions, plan.deductions);
const nested = materials.map(m => m.id === materials[3].id ? { ...m, recipeItems: [{ ...ingredient('nested-aroma', 'category:Essências', 100), selectionMode: 'category' as const, targetCategory: 'Essências' }] } : m);
const choices = { [requirement.key]: materials[3].id };
const deeper = getProductionVariableRequirements(unset, nested, choices);
assert.equal(deeper.length, 2);
const resolved = getProductionPlan(unset, 1, nested, [product], { ...choices, [deeper[1].key]: 'Chocolate' });
assert.equal(resolved.hasMissingVariableSelection, false);
assert.equal(resolved.deductions.find(d => d.targetId === 'Chocolate')!.quantityTotal, 10);

// Invalid references never become a deduction against a zero-stock virtual material.
const cyclic = materials.map(m => m.id === materials[3].id ? { ...m, recipeItems: [ingredient('cycle', materials[4].id, 100)] } : m);
assert(!getCategoryMaterialOptions(cyclic, 'Essências', 'g', [materials[4].id]).some(m => m.id === materials[3].id));
assert(getProductionPlan(product, 4, cyclic, [product]).hasMissingVariableSelection);
const invalidYield = materials.map(m => m.id === materials[3].id ? { ...m, batchYield: 0 } : m);
assert(getProductionPlan(product, 4, invalidYield, [product]).hasMissingVariableSelection);
const wrongUnits = materials.map(m => m.id === materials[3].id ? { ...m, unit: 'ml' as const } : m);
assert(getProductionPlan(product, 4, wrongUnits, [product]).hasMissingVariableSelection);
const missing = materials.filter(m => m.id !== 'Chocolate');
assert(expandVirtualRecipeItems(product.items, missing, [product]).errors.length);
assert.equal(materialRecipeCosts(materials[3], materials).unitCost, 3.01);
assert.equal(JSON.stringify({ materials, product }), before, 'Planejamento/custeio não alteram a base.');
console.log('Essência virtual: seleção, fórmulas aninhadas, custo/mão de obra, rendimento, baixa proporcional, insuficiência real, estoque físico, categorias na produção, ciclos e erros passaram.');
