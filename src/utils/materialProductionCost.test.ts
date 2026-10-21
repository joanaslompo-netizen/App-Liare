import assert from 'node:assert/strict';
import { Material, RecipeItem, Product } from '../types';
import { estimateMaterialUnitCost, getVirtualRecipeLaborCost, recalculateProductPricing, getRecipeItemEmbeddedLaborCost } from './storage';
import { getProductFinancialSplit, getRecipeCostSummary } from './financials';

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
assert.equal(getRecipeItemEmbeddedLaborCost(item, materials, []), 5); // Two labels: 2 x R$2.50 of labor.
const virtualMaterials = [sheet, print, { ...labels, isVirtualRecipe: true }];
assert.equal(getVirtualRecipeLaborCost([item], virtualMaterials), 5);
assert.equal(estimateMaterialUnitCost(virtualMaterials[2], virtualMaterials), 3.25);
const piece = {
  id: 'piece', items: [item], productionTimeMinutes: 0, hourlyRate: 0,
  fixedCostPercent: 0, otherCosts: 0, batchYield: 1, profitMarginPercent: 0, actualPrice: 20,
} as Product;
const pricedPiece = recalculateProductPricing(piece, materials, [piece]);
assert.equal(pricedPiece.materialsCost, 6.5);
assert.equal(pricedPiece.embeddedLaborCost, 5);
const split = getProductFinancialSplit(pricedPiece);
assert.equal(split.businessCostPerUnit, 1.5);
assert.equal(split.laborRemunerationPerUnit, 5);
const totals = getRecipeCostSummary({
  materialsCost: pricedPiece.materialsCost, embeddedLaborCost: pricedPiece.embeddedLaborCost,
  laborCost: pricedPiece.laborCost, fixedCost: pricedPiece.fixedCost,
  otherCosts: pricedPiece.otherCosts, batchYield: pricedPiece.batchYield,
  salePrice: pricedPiece.actualPrice,
});
assert.equal(totals.materials, 1.5);
assert.equal(totals.componentLabor, 5);
assert.equal(totals.costs, 1.5);
assert.equal(totals.profit, 18.5);
assert.equal(totals.marginPercent, 92.5);
const nested = { ...labels, id: 'kit', batchYield: 1, productionTimeMinutes: 0,
  recipeItems: [item] };
assert.equal(estimateMaterialUnitCost(nested, [...materials, nested]), 6.5);
const nestedItem = { ...item, id: 'nested-row', targetId: 'kit', quantity: 1 };
assert.equal(getRecipeItemEmbeddedLaborCost(nestedItem, [...materials, nested], []), 5);
assert.equal(estimateMaterialUnitCost(nested, [...materials, nested]) - getRecipeItemEmbeddedLaborCost(nestedItem, [...materials, nested], []), 1.5);
assert.equal(labels.batchYield, 4);
const withOverhead = { ...labels, recipeFixedCostPercent: 10, recipeOtherCosts: 1.7 };
assert.equal(estimateMaterialUnitCost(withOverhead, [...materials, withOverhead]), 4);
assert.equal(recalculateProductPricing(piece, [sheet, print, withOverhead], [piece]).materialsCost, 8);
console.log('Material cost checks passed: mixed input units, manual yield, labor, virtual recipes and downstream product cost.');
