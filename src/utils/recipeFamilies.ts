import { Material, Product, RecipeItem } from '../types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isAroma = (item: RecipeItem, materials: Material[]) => {
  const category = item.targetCategory || materials.find((m) => m.id === item.targetId)?.category || '';
  return /essencia|aroma|fragrancia/.test(normalize(category));
};

/** Keep only the variant's aroma choices; quantities and all other ingredients come from the mother. */
export const inheritRecipe = (variant: Product, mother: Product, materials: Material[]): Product => {
  const used = new Set<string>();
  const items = mother.items.map((base) => {
    const old = variant.items.find((item) => !used.has(item.id) && item.id === base.id)
      || variant.items.find((item) => !used.has(item.id) && item.type === base.type && item.targetId === base.targetId)
      || (isAroma(base, materials) ? variant.items.find((item) => !used.has(item.id) && item.type === base.type && isAroma(item, materials)) : undefined);
    if (old) used.add(old.id);
    const result = { ...base };
    if (old && isAroma(base, materials) && isAroma(old, materials)) {
      result.targetId = old.targetId;
      result.name = old.name;
      result.unit = old.unit;
      result.selectionMode = old.selectionMode;
      result.targetCategory = old.targetCategory;
    }
    // Virtual recipes carry their aroma choice on the outer recipe row.
    const material = materials.find((m) => m.id === base.targetId);
    if (old?.categorySelections && material?.recipeItems) {
      const selections = { ...base.categorySelections };
      for (const requirement of material.recipeItems) {
        const selectedId = old.categorySelections[requirement.id];
        const selected = materials.find((m) => m.id === selectedId);
        if (isAroma(requirement, materials) && selected?.category === requirement.targetCategory) {
          selections[requirement.id] = selectedId;
        }
      }
      result.categorySelections = selections;
    }
    return result;
  });
  const family = mother.productFamily || mother.name;
  return {
    ...variant,
    parentRecipeId: mother.id,
    productFamily: family,
    name: variant.customName || (variant.fragrance ? `${family} — ${variant.fragrance}` : family),
    category: mother.category,
    isIntermediate: mother.isIntermediate,
    items,
    batchYield: mother.batchYield,
    useProductionStages: mother.useProductionStages,
    productionStages: mother.productionStages?.map((stage) => ({ ...stage })),
    productionTimeMinutes: mother.productionTimeMinutes,
    hourlyRate: mother.hourlyRate,
    fixedCostPercent: mother.fixedCostPercent,
    otherCosts: mother.otherCosts,
    profitMarginPercent: mother.profitMarginPercent,
  };
};

/** Explicit IDs avoid linking unrelated recipes just because their family names match. */
export const synchronizeRecipeFamilies = (products: Product[], materials: Material[]): Product[] => {
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved = new Map<string, Product>();
  const resolve = (product: Product, visiting = new Set<string>()): Product => {
    if (resolved.has(product.id)) return resolved.get(product.id)!;
    if (visiting.has(product.id)) return product;
    const mother = product.parentRecipeId ? byId.get(product.parentRecipeId) : undefined;
    const next = new Set(visiting).add(product.id);
    const result = mother && !next.has(mother.id)
      ? inheritRecipe(product, resolve(mother, next), materials)
      : product;
    resolved.set(product.id, result);
    return result;
  };
  return products.map((product) => resolve(product));
};
