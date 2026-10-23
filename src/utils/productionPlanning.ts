import type {
  Material,
  RecipeItem,
  Product,
  Production,
  ProductionIngredientDeduction,
} from "../types";
import { localDateString } from "./localDate";
import { expandVirtualRecipeItems } from './virtualMaterials';
import { planAutomaticConsumption } from './automaticManufacturing';
export { makeVariableKey } from './virtualMaterials';

export function getProductionVariableRequirements(selectedProduct: Product, materials: Material[], variableSelections: Record<string, string> = {}) {
  return expandVirtualRecipeItems(selectedProduct.items, materials, [], variableSelections).requirements.filter(r => !r.savedSelection);
}

export function getProductionPlan(
  selectedProduct: Product,
  quantityProduced: number,
  materials: Material[],
  products: Product[],
  variableSelections: Record<string, string> = {},
) {
  const batchYield =
    Number.isFinite(selectedProduct.batchYield) &&
    selectedProduct.batchYield > 0
      ? selectedProduct.batchYield
      : 1;
  const parsedBatchCount = quantityProduced / batchYield;
  const isStagedProduction = !!(
    selectedProduct.useProductionStages &&
    selectedProduct.productionStages?.length
  );
  const expanded = planAutomaticConsumption(selectedProduct.items, materials, products, parsedBatchCount, variableSelections);
  const deductions: ProductionIngredientDeduction[] = expanded.deductions;
  const hasStockShortage = expanded.hasStockShortage;
  const hasMissingVariableSelection = expanded.errors.length > 0;
  const ingredientCost = deductions.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );
  const nonIngredientCostPerBatch = selectedProduct
    ? Math.max(0, selectedProduct.totalCost - selectedProduct.materialsCost)
    : 0;
  const totalCost = selectedProduct
    ? ingredientCost +
      nonIngredientCostPerBatch * parsedBatchCount + expanded.preparationCost
    : 0;
  const unitCost = quantityProduced > 0 ? totalCost / quantityProduced : 0;

  return {
    product: selectedProduct,
    quantityProduced,
    batchYield,
    parsedBatchCount,
    isStagedProduction,
    deductions,
    hasStockShortage,
    hasMissingVariableSelection,
    errors: expanded.errors,
    virtualPreparationCost: parsedBatchCount > 0 ? expanded.preparationCost / parsedBatchCount : 0,
    automaticManufacturing: expanded.automaticManufacturing,
    sourceMaterials: materials,
    sourceProducts: products,
    totalCost,
    unitCost,
    variableSelections,
  };
}

export type ProductionPlan = ReturnType<typeof getProductionPlan>;

export function aggregateProductionDeductions(
  plans: ProductionPlan[],
  immediateOnly = false,
) {
  const totals = new Map<string, ProductionIngredientDeduction>();
  replanProductionSequence(plans, immediateOnly)
    .filter((p) => !immediateOnly || !p.isStagedProduction)
    .forEach((plan) =>
      plan.deductions.forEach((item) => {
        const key = `${item.type}:${item.targetId}`;
        const old = totals.get(key);
        const quantityTotal = (old?.quantityTotal || 0) + item.quantityTotal;
        totals.set(key, {
          ...item,
          quantityTotal,
          totalCost: (old?.totalCost || 0) + item.totalCost,
          stockBefore: old?.stockBefore ?? item.stockBefore,
          stockAfter: (old?.stockBefore ?? item.stockBefore) - quantityTotal,
        });
      }),
    );
  return [...totals.values()];
}

/** Replan against shared balances so two selected recipes cannot use the same ready component twice. */
export function replanProductionSequence(plans: ProductionPlan[], immediateOnly = true): ProductionPlan[] {
  let materials = plans[0]?.sourceMaterials || [];
  let products = plans[0]?.sourceProducts || [];
  return plans.map(original => {
    if (immediateOnly && original.isStagedProduction) return original;
    const plan = getProductionPlan(original.product, original.quantityProduced, materials, products, original.variableSelections);
    materials = materials.map(material => {
      const deduction = plan.deductions.find(item => item.type === 'material' && item.targetId === material.id);
      return deduction ? {...material, currentStock: Math.max(0, material.currentStock - deduction.quantityTotal)} : material;
    });
    products = products.map(product => {
      const deduction = plan.deductions.find(item => item.type === 'product' && item.targetId === product.id);
      const currentStock = Math.max(0, (product.currentStock || 0) - (deduction?.quantityTotal || 0)) + (product.id === plan.product.id ? plan.quantityProduced : 0);
      return {...product, currentStock};
    });
    return plan;
  });
}

/** Record shared stock before/after in order, without consuming staged work early. */
export function buildProductionBatch(
  plans: ProductionPlan[],
  date: string,
  notes: string,
  updateStock: boolean,
) {
  return replanProductionSequence(plans, true).map(plan => buildProductionRecord(plan, date, notes, updateStock));
}

export function buildProductionRecord(
  plan: ProductionPlan,
  date: string,
  notes: string,
  updateStock: boolean,
): Production {
  const {
    product: selectedProduct,
    quantityProduced,
    batchYield,
    parsedBatchCount,
    isStagedProduction,
    deductions,
    totalCost,
    unitCost,
    variableSelections,
  } = plan;
  const recordedDeductions = isStagedProduction
    ? []
    : updateStock
      ? deductions.map((deduction) => ({
          ...deduction,
          stockAfter: Math.max(0, Number(deduction.stockAfter.toFixed(4))),
        }))
      : deductions;

  const sortedStages = isStagedProduction
    ? [...(selectedProduct.productionStages || [])].sort(
        (a, b) => a.order - b.order,
      )
    : [];

  const newProduction: Production = {
    id: `prod_exec_${crypto.randomUUID()}`,
    date,
    productId: selectedProduct.id,
    productName: selectedProduct.name,
    productCategory: selectedProduct.category,
    productImageUrl: selectedProduct.imageUrl?.startsWith("data:image/")
      ? undefined
      : selectedProduct.imageUrl,
    isIntermediate: selectedProduct.isIntermediate,
    batchYield,
    batchCount: parsedBatchCount,
    quantityProduced: isStagedProduction ? 0 : quantityProduced,
    targetQuantity: isStagedProduction ? quantityProduced : undefined,
    status: isStagedProduction ? "in_progress" : "completed",
    costPerUnit: unitCost,
    totalCost: isStagedProduction ? 0 : totalCost,
    plannedTotalCost: isStagedProduction ? totalCost : undefined,
    deductedItems: recordedDeductions,
    automaticManufacturing: updateStock && !isStagedProduction ? plan.automaticManufacturing : undefined,
    stageProgress: isStagedProduction
      ? sortedStages.map((stage, index) => ({
          stageId: stage.id,
          stageName: stage.name,
          order: index,
          plannedQuantity: quantityProduced,
          completedQuantity: 0,
          laborMinutes: stage.laborMinutes || 0,
          deductedItems: [],
        }))
      : undefined,
    productionStagesSnapshot: isStagedProduction ? sortedStages : undefined,
    recipeItemsSnapshot: isStagedProduction
      ? selectedProduct.items.map((item) => ({ ...item }))
      : undefined,
    variableSelections: isStagedProduction
      ? { ...variableSelections }
      : undefined,
    stockTrackingEnabled: updateStock,
    notes: notes.trim() || undefined,
    createdAt: localDateString(),
    completedAt: isStagedProduction ? undefined : localDateString(),
  };

  return newProduction;
}
