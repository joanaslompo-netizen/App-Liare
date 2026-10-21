import assert from 'node:assert/strict';
import { Material, Product, RecipeItem } from '../types';
import { inheritRecipe, synchronizeRecipeFamilies } from './recipeFamilies';
import { cascadeRecalculateAllProducts } from './storage';

const materials = [
  { id: 'wax', name: 'Cera', category: 'Ceras', unitCost: 0.05 },
  { id: 'lavender', name: 'Lavanda', category: 'Essências', unitCost: 0.3 },
  { id: 'tea', name: 'Chá Branco', category: 'Essências', unitCost: 0.4 },
  { id: 'label', name: 'Etiqueta', category: 'Embalagens', unitCost: 1 },
  { id: 'virtual', name: 'Cera aromatizada', category: 'Ceras', isMadeInAtelier: true,
    isVirtualRecipe: true, batchYield: 110, recipeItems: [
      { id: 'v-wax', type: 'material', targetId: 'wax', quantity: 100 },
      { id: 'v-aroma', type: 'material', selectionMode: 'category', targetCategory: 'Essências', quantity: 10 },
    ] },
] as Material[];
const row = (id: string, targetId: string, quantity: number): RecipeItem => ({
  id, targetId, quantity, type: 'material', name: targetId, unit: 'g', unitCost: 0, totalCost: 0,
});
const mother = {
  id: 'mother', name: 'Lapidado', productFamily: 'Lapidado', items: [row('wax-row', 'wax', 80), row('aroma-row', 'lavender', 8)],
  batchYield: 1, productionTimeMinutes: 10, hourlyRate: 30, fixedCostPercent: 0,
  otherCosts: 0, profitMarginPercent: 50, actualPrice: 40, currentStock: 10,
} as Product;
const child = { ...mother, id: 'tea-child', parentRecipeId: 'mother', fragrance: 'Chá Branco', currentStock: 3,
  actualPrice: 45, items: [row('wax-row', 'wax', 80), row('aroma-row', 'tea', 8)] };
const changed = { ...mother, items: [row('wax-row', 'wax', 90), row('aroma-row', 'lavender', 9), row('label-row', 'label', 1)] };
const snapshot = JSON.stringify(child);
const result = cascadeRecalculateAllProducts(materials, [changed, child])[1];
assert.equal(result.items.length, 3);
assert.equal(result.items[1].targetId, 'tea');
assert.equal(result.items[1].quantity, 9);
assert.equal(result.currentStock, 3);
assert.equal(result.actualPrice, mother.actualPrice);
assert.equal(result.materialsCost, 9.1);
assert.equal(result.netProfit, 40 - 9.1);
assert.equal(result.calculatedMarginPercent, ((40 - 9.1) / 40) * 100);
assert.equal(JSON.stringify(child), snapshot);
assert.equal(result.name, 'Lapidado — Chá Branco');
const removed = inheritRecipe(result, { ...changed, items: changed.items.slice(1) }, materials);
assert.equal(removed.items.some((item) => item.targetId === 'wax'), false);
const virtualMother = { ...mother, items: [{ ...row('virtual-row', 'virtual', 110), categorySelections: { 'v-aroma': 'lavender' } }] };
const virtualChild = { ...child, items: [{ ...row('another-row', 'virtual', 110), categorySelections: { 'v-aroma': 'tea' } }] };
assert.equal(inheritRecipe(virtualChild, virtualMother, materials).items[0].categorySelections?.['v-aroma'], 'tea');
const unrelated = { ...child, id: 'unrelated', parentRecipeId: undefined };
assert.equal(synchronizeRecipeFamilies([changed, unrelated], materials)[1], unrelated);
// Saving a mother with a new price updates every linked variant, including older prices.
const secondChild = { ...child, id: 'second-child', actualPrice: 0, imageUrl: 'variant.png', minStock: 2 };
const family = cascadeRecalculateAllProducts(materials, [{ ...mother, actualPrice: 60 }, child, secondChild, unrelated]);
assert.deepEqual(family.map((p) => p.actualPrice), [60, 60, 60, 45]);
assert.equal(family[2].imageUrl, secondChild.imageUrl);
assert.equal(family[2].minStock, secondChild.minStock);
assert.equal(family[1].items[1].targetId, 'tea');
assert.equal(family[1].currentStock, child.currentStock);
// Zero is an explicit price; do not fall back to the child's previous or suggested price.
assert.equal(cascadeRecalculateAllProducts(materials, [{ ...mother, actualPrice: 0 }, child])[1].actualPrice, 0);
// New variants and re-linked variants use the mother's price immediately.
assert.equal(inheritRecipe({ ...child, actualPrice: 12 }, mother, materials).actualPrice, 40);
const grandchild = { ...child, id: 'grandchild', parentRecipeId: child.id, actualPrice: 5 };
assert.equal(synchronizeRecipeFamilies([grandchild, child, { ...mother, actualPrice: 70 }], materials)[0].actualPrice, 70);
const detached = { ...child, parentRecipeId: undefined, actualPrice: 25 };
assert.equal(cascadeRecalculateAllProducts(materials, [mother, detached])[1].actualPrice, 25);
assert.doesNotThrow(() => synchronizeRecipeFamilies([
  { ...mother, parentRecipeId: child.id }, child,
], materials));
console.log('Recipe family checks passed: composition, aromas, virtual recipes, pricing and independent stock.');
