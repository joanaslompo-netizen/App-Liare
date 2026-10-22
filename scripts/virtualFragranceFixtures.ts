import type { Material, Product, RecipeItem } from '../src/types';
import { DEFAULT_MATERIALS, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, recalculateProductPricing } from '../src/utils/storage';

export const ingredient = (id: string, targetId: string, quantity: number): RecipeItem => ({
  id, targetId, name: targetId, quantity, type: 'material', unit: 'g', unitCost: 0, totalCost: 0,
});
const raw = (id: string, category: string, price: number, stock: number): Material => ({
  ...DEFAULT_MATERIALS[0], id, name: id, category, unit: 'g', unitCost: price,
  inventoryUnitCost: undefined, currentStock: stock, usageType: 'consumable', isVirtualRecipe: false,
});
export const virtualFragranceMaterials: Material[] = [
  raw('Cera de coco', 'Ceras', 0.1, 1000),
  raw('Vanilla', 'Essências', 2, 100),
  raw('Chocolate', 'Essências', 4, 100),
  { ...raw('Milk-shake de Chocolate', 'Essências', 3.01, 0), isVirtualRecipe: true, isMadeInAtelier: true,
    batchYield: 100, productionTimeMinutes: 6, hourlyRate: 10, recipeItems: [ingredient('vanilla', 'Vanilla', 50), ingredient('chocolate', 'Chocolate', 50)] },
  { ...raw('Cera aromatizada', 'Ceras', 0, 0), isVirtualRecipe: true, isMadeInAtelier: true, batchYield: 1000,
    recipeItems: [ingredient('wax', 'Cera de coco', 900), { ...ingredient('aroma', 'category:Essências', 100), selectionMode: 'category', targetCategory: 'Essências' }] },
];
const base: Product = { ...DEFAULT_PRODUCTS[0], id: 'vela', name: 'Vela teste', isFamilyMother: false,
  isCustomRecipe: false, parentRecipeId: undefined, currentStock: 0, isIntermediate: false, batchYield: 1,
  items: [{ ...ingredient('mixture', 'Cera aromatizada', 100), categorySelections: { aroma: 'Milk-shake de Chocolate' } }],
  useProductionStages: false, productionStages: undefined, productionTimeMinutes: 0, hourlyRate: 0,
  fixedCostPercent: 0, otherCosts: 0, profitMarginPercent: 0, actualPrice: 80 };
export const virtualFragranceProduct = recalculateProductPricing(base, virtualFragranceMaterials, [base]);
export const virtualFragranceWorkspace = () => ({ materials: structuredClone(virtualFragranceMaterials),
  products: [structuredClone(virtualFragranceProduct)], productions: [], purchases: [], sales: [], customers: [],
  paymentMethods: [], suppliers: [], settings: DEFAULT_SETTINGS, todos: [], projects: [],
  finance: { version: 1, entries: [], bills: [] }, stockMovements: [] });
