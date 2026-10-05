import assert from 'node:assert/strict';
import { Material, RecipeItem, Product } from '../types';
import { estimateMaterialUnitCost, getVirtualRecipeLaborCost, recalculateProductPricing } from './storage';

const sheet = { id: 'sheet', name: 'Folha', category: 'Papéis', unit: 'folha', unitCost: 2 } as Material;
const print = { id: 'print', name: 'Impressão', category: 'Impressão', unit: 'un', unitCost: 1 } as Material;
const labels = {
  id: 'labels', name: 'Rótulos', unit: 'un', isMadeInAtelier: true, recipeYieldMode: 'manual',
  batchYield: 4, productionTimeMinutes: 15, hourlyRate: 40,
  recipeItems: [
    { id: 'sheet-row', type: 'material', targetId: 'sheet', quantity: 1 },
    { id: 'print-row', type: 'material', targetId: 'print', quantity: 1 },
  ],
} as Material;
const materials = [sheet, print, labels];
assert.equal(estimateMaterialUnitCost(labels, materials), 3.25);
assert.equal(estimateMaterialUnitCost({ ...labels, productionTimeMinutes: undefined }, materials), 0.75);
const item = { id: 'label-row', type: 'material', targetId: 'labels', quantity: 2, unitCost: 0 } as RecipeItem;
assert.equal(getVirtualRecipeLaborCost([item], materials), 0);
const virtualMaterials = [sheet, print, { ...labels, isVirtualRecipe: true }];
assert.equal(getVirtualRecipeLaborCost([item], virtualMaterials), 5);
assert.equal(estimateMaterialUnitCost(virtualMaterials[2], virtualMaterials), 3.25);
const piece = {
  id: 'piece', items: [item], productionTimeMinutes: 0, hourlyRate: 0,
  fixedCostPercent: 0, otherCosts: 0, batchYield: 1, profitMarginPercent: 0, actualPrice: 20,
} as Product;
assert.equal(recalculateProductPricing(piece, materials, [piece]).materialsCost, 6.5);
const nested = { ...labels, id: 'kit', batchYield: 1, productionTimeMinutes: 0,
  recipeItems: [item] };
assert.equal(estimateMaterialUnitCost(nested, [...materials, nested]), 6.5);
assert.equal(labels.batchYield, 4);
console.log('Material cost checks passed: mixed input units, manual yield, labor, virtual recipes and downstream product cost.');
