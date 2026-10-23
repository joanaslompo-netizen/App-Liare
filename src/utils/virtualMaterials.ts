import type { Material, Product, RecipeItem } from '../types';
import { UNIT_SHORT } from './formatters';

export const makeVariableKey = (rowId: string, materialId: string, itemId: string) =>
  `${rowId}::${materialId}::${itemId}`;

/** Choices below an ingredient belong to that ingredient and selected formula. */
function childChoices(choices: Record<string, string>, item: RecipeItem, materialId: string) {
  const prefix = `${item.id}::${materialId}::`;
  return { ...item.categorySelections, ...Object.fromEntries(Object.entries(choices)
    .filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value])) };
}

export function getCategoryMaterialOptions(materials: Material[], category: string, unit?: string, ancestors: string[] = []) {
  const reachesAncestor = (material: Material, visiting = new Set<string>()): boolean => {
    if (ancestors.includes(material.id) || visiting.has(material.id)) return true;
    if (!material.isVirtualRecipe) return false;
    const next = new Set(visiting).add(material.id);
    return (material.recipeItems || []).some(item => item.type === 'material' && item.selectionMode !== 'category'
      && materials.some(child => child.id === item.targetId && reachesAncestor(child, next)));
  };
  return materials.filter(material => material.category === category && material.usageType !== 'durable'
    && (!unit || material.unit === unit || UNIT_SHORT[material.unit] === unit)
    && !reachesAncestor(material));
}

export function materialRecipeCosts(material: Material, materials: Material[], choices: Record<string, string> = {},
  visiting = new Set<string>(), products: Product[] = []): { unitCost: number; laborUnitCost: number; preparationUnitCost: number; ownLaborUnitCost: number } {
  const zero = { unitCost: 0, laborUnitCost: 0, preparationUnitCost: 0, ownLaborUnitCost: 0 };
  if (material.usageType === 'durable') return zero;
  if ((!material.isMadeInAtelier && !material.isVirtualRecipe) || !material.recipeItems?.length || !material.batchYield)
    return { ...zero, unitCost: material.unitCost || 0 };
  if (visiting.has(material.id)) return zero;
  const next = new Set(visiting).add(material.id);
  let ingredients = 0, componentLabor = 0;
  for (const item of material.recipeItems) {
    if (item.type === 'product') {
      const product = products.find(p => p.id === item.targetId);
      ingredients += item.quantity * (product?.unitCostFromBatch ?? item.unitCost ?? 0);
      componentLabor += item.quantity * ((product?.laborCost || 0) + (product?.embeddedLaborCost || 0)) / Math.max(1, product?.batchYield || 1);
      continue;
    }
    const options = item.selectionMode === 'category' && item.targetCategory
      ? getCategoryMaterialOptions(materials, item.targetCategory, item.unit, [...next])
      : materials.filter(m => m.id === item.targetId);
    const selected = item.selectionMode === 'category' ? options.find(m => m.id === choices[item.id]) : options[0];
    const candidates = selected ? [selected] : options;
    if (!candidates.length) { ingredients += (item.unitCost || 0) * item.quantity; continue; }
    const costs = candidates.map(child => materialRecipeCosts(child, materials, childChoices(choices, item, child.id), next, products));
    ingredients += item.quantity * costs.reduce((sum, cost) => sum + cost.unitCost, 0) / costs.length;
    componentLabor += item.quantity * costs.reduce((sum, cost) => sum + cost.laborUnitCost, 0) / costs.length;
  }
  const labor = Math.max(0, material.productionTimeMinutes || 0) / 60 * Math.max(0, material.hourlyRate || 0);
  const preparation = labor + (ingredients + labor) * Math.max(0, material.recipeFixedCostPercent || 0) / 100
    + Math.max(0, material.recipeOtherCosts || 0);
  const yieldQty = Math.max(0.0001, material.batchYield);
  return { unitCost: (ingredients + preparation) / yieldQty, laborUnitCost: (labor + componentLabor) / yieldQty,
    preparationUnitCost: preparation / yieldQty, ownLaborUnitCost: labor / yieldQty };
}

export const estimateMaterialUnitCost = (material: Material, materials: Material[], visiting = new Set<string>(), choices?: Record<string, string>) =>
  materialRecipeCosts(material, materials, choices, visiting).unitCost;

export interface VirtualRequirement {
  key: string;
  recipeItemId: string;
  virtualMaterialId: string;
  virtualMaterialName: string;
  category: string;
  unit: string;
  quantityPerBatch: number;
  ancestors: string[];
  savedSelection: boolean;
}

/** Display hierarchy alongside the unchanged flat ingredients used for stock/costs. */
export interface ExpandedRecipeNode {
  item: RecipeItem;
  isVirtualRecipe: boolean;
  children: ExpandedRecipeNode[];
}

/** Expand only virtual materials. Physical made materials/products consume their own stock. */
export function expandVirtualRecipeItems(items: RecipeItem[], materials: Material[], products: Product[] = [],
  variableSelections: Record<string, string> = {}) {
  const leaves: RecipeItem[] = [], requirements: VirtualRequirement[] = [], errors: string[] = [];
  const tree: ExpandedRecipeNode[] = [];
  let preparationCost = 0, virtualLaborCost = 0;
  for (const root of items) {
    const rootPrefix = `${root.id}::${root.targetId}::`;
    const dynamic = Object.fromEntries(Object.entries(variableSelections).filter(([key]) => key.startsWith(rootPrefix))
      .map(([key, value]) => [key.slice(rootPrefix.length), value]));
    const visit = (item: RecipeItem, scale: number, path: string[], saved: Record<string, string>,
      chosenAtProduction: Record<string, string>, ancestors: string[], owner?: Material): ExpandedRecipeNode | undefined => {
      const quantity = item.quantity * scale;
      if (item.type === 'product') {
        const product = products.find(p => p.id === item.targetId);
        if (!product) { errors.push(`O componente "${item.name}" não foi encontrado.`); return; }
        const resolved = { ...item, quantity, name: product.name, unitCost: product.unitCostFromBatch > 0 ? product.unitCostFromBatch : product.totalCost };
        leaves.push(resolved);
        return { item: resolved, isVirtualRecipe: false, children: [] };
      }
      let material: Material | undefined;
      if (item.selectionMode === 'category' && item.targetCategory) {
        const recipeItemId = [...path, item.id].join('::');
        requirements.push({ key: rootPrefix + recipeItemId, recipeItemId,
          virtualMaterialId: owner?.id || root.targetId, virtualMaterialName: owner?.name || root.name,
          category: item.targetCategory, unit: item.unit, quantityPerBatch: quantity,
          ancestors, savedSelection: !!saved[item.id] });
        const chosenId = saved[item.id] || chosenAtProduction[item.id];
        material = getCategoryMaterialOptions(materials, item.targetCategory, item.unit, ancestors).find(m => m.id === chosenId);
        if (!material) { errors.push(`Escolha um material de ${item.targetCategory} em "${owner?.name || root.name}".`); return; }
      } else {
        material = materials.find(m => m.id === item.targetId);
        if (!material) { errors.push(`O material "${item.name}" não foi encontrado.`); return; }
      }
      if (material.usageType === 'durable') return;
      if (!material.isVirtualRecipe) {
        const resolved: RecipeItem = { ...item, selectionMode: 'fixed', targetId: material.id, name: material.name,
          unit: UNIT_SHORT[material.unit] || item.unit, quantity, unitCost: material.inventoryUnitCost ?? material.unitCost };
        leaves.push(resolved);
        return { item: resolved, isVirtualRecipe: false, children: [] };
      }
      if (ancestors.includes(material.id)) { errors.push(`A fórmula de "${material.name}" contém uma referência circular.`); return; }
      if (!material.recipeItems?.length || !Number.isFinite(material.batchYield) || material.batchYield! <= 0) {
        errors.push(`Confira os ingredientes e o rendimento de "${material.name}".`); return;
      }
      const isRoot = item === root;
      const nextSaved = isRoot ? (root.categorySelections || {}) : childChoices(saved, item, material.id);
      const nextDynamic = isRoot ? dynamic : childChoices(chosenAtProduction, item, material.id);
      const costs = materialRecipeCosts(material, materials, { ...nextDynamic, ...nextSaved }, new Set(ancestors), products);
      preparationCost += costs.preparationUnitCost * quantity;
      virtualLaborCost += costs.ownLaborUnitCost * quantity;
      const nextPath = isRoot ? [] : [...path, item.id, material.id];
      const children = material.recipeItems.map(child => visit(child, quantity / material.batchYield!, nextPath, nextSaved,
        nextDynamic, [...ancestors, material.id], material)).filter((node): node is ExpandedRecipeNode => !!node);
      return { item: { ...item, targetId: material.id, name: material.name, quantity, unit: UNIT_SHORT[material.unit] || item.unit },
        isVirtualRecipe: true, children };
    };
    const node = visit(root, 1, [], {}, {}, []);
    if (node) tree.push(node);
  }
  return { leaves, requirements, errors, preparationCost, virtualLaborCost, tree };
}

export function getVirtualMaterialRequirements(material: Material, materials: Material[], choices: Record<string, string> = {}) {
  return expandVirtualRecipeItems([{ id: 'draft', type: 'material', targetId: material.id, name: material.name,
    quantity: 1, unit: material.unit, unitCost: 0, totalCost: 0, categorySelections: choices }], materials).requirements;
}
