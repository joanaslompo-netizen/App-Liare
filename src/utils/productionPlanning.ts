import type {
  Material,
  RecipeItem,
  Product,
  Production,
  ProductionIngredientDeduction,
} from "../types";
import { localDateString } from "./localDate";
import { expandVirtualRecipeItems } from './virtualMaterials';
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
  const expanded = expandVirtualRecipeItems(selectedProduct.items, materials, products, variableSelections);
  const aggregated = new Map<string, RecipeItem>();
  for (const item of expanded.leaves) {
    const key = `${item.type}:${item.targetId}`;
    const previous = aggregated.get(key);
    aggregated.set(key, { ...item, quantity: (previous?.quantity || 0) + item.quantity });
  }
  const deductions: ProductionIngredientDeduction[] = [...aggregated.values()].map(item => {
    const quantityTotal = item.quantity * parsedBatchCount;
    const stockBefore = item.type === 'material'
      ? materials.find(m => m.id === item.targetId)?.currentStock || 0
      : products.find(p => p.id === item.targetId)?.currentStock || 0;
    return { ...item, quantityPerBatch: item.quantity, quantityTotal,
      totalCost: item.unitCost * quantityTotal, stockBefore, stockAfter: stockBefore - quantityTotal };
  });
  const hasStockShortage = deductions.some(item => item.stockAfter < -0.0001);
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
      (nonIngredientCostPerBatch +
        expanded.preparationCost) *
        parsedBatchCount
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
    virtualPreparationCost: expanded.preparationCost,
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
  plans
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
          stockAfter: item.stockBefore - quantityTotal,
        });
      }),
    );
  return [...totals.values()];
}

/** Record shared stock before/after in order, without consuming staged work early. */
export function buildProductionBatch(
  plans: ProductionPlan[],
  date: string,
  notes: string,
  updateStock: boolean,
) {
  const balances = new Map<string, number>();
  return plans.map((plan) => {
    const production = buildProductionRecord(plan, date, notes, updateStock);
    if (updateStock)
      production.deductedItems = production.deductedItems.map((item) => {
        const key = `${item.type}:${item.targetId}`;
        const stockBefore = balances.get(key) ?? item.stockBefore;
        const stockAfter = Math.max(
          0,
          Number((stockBefore - item.quantityTotal).toFixed(4)),
        );
        balances.set(key, stockAfter);
        return { ...item, stockBefore, stockAfter };
      });
    if (updateStock && production.quantityProduced > 0) {
      const key = `product:${production.productId}`;
      balances.set(key, (balances.get(key) ?? plan.product.currentStock ?? 0) + production.quantityProduced);
    }
    return production;
  });
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
