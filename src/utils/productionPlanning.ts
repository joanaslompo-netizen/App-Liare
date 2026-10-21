import type {
  Material,
  Product,
  Production,
  ProductionIngredientDeduction,
} from "../types";
import { UNIT_SHORT } from "./formatters";
import { localDateString } from "./localDate";
import { getVirtualRecipeLaborCost } from "./storage";

export const makeVariableKey = (
  productItemId: string,
  virtualMaterialId: string,
  recipeItemId: string,
) => `${productItemId}::${virtualMaterialId}::${recipeItemId}`;

export function getProductionVariableRequirements(
  selectedProduct: Product,
  materials: Material[],
) {
  return selectedProduct.items.flatMap((productItem) => {
    if (productItem.type !== "material") return [];
    const virtualMaterial = materials.find(
      (m) => m.id === productItem.targetId,
    );
    if (
      !virtualMaterial?.isVirtualRecipe ||
      !virtualMaterial.recipeItems?.length
    )
      return [];

    const virtualYield = Math.max(0.0001, virtualMaterial.batchYield || 1);
    const scalePerProductBatch = productItem.quantity / virtualYield;

    return virtualMaterial.recipeItems
      .filter(
        (recipeItem) =>
          recipeItem.type === "material" &&
          recipeItem.selectionMode === "category" &&
          recipeItem.targetCategory &&
          !productItem.categorySelections?.[recipeItem.id],
      )
      .map((recipeItem) => ({
        key: makeVariableKey(productItem.id, virtualMaterial.id, recipeItem.id),
        virtualMaterialId: virtualMaterial.id,
        virtualMaterialName: virtualMaterial.name,
        category: recipeItem.targetCategory as string,
        quantityPerBatch: recipeItem.quantity * scalePerProductBatch,
        unit: recipeItem.unit,
      }));
  });
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
  const { deductions, hasStockShortage, hasMissingVariableSelection } = (() => {
    let shortage = false;
    let missingVariable = false;

    type PendingDeduction = Omit<
      ProductionIngredientDeduction,
      "quantityTotal" | "totalCost" | "stockBefore" | "stockAfter"
    >;
    const aggregated = new Map<string, PendingDeduction>();

    const addIngredient = (
      id: string,
      targetId: string,
      type: "material" | "product",
      name: string,
      unit: string,
      quantityPerBatch: number,
      unitCost: number,
    ) => {
      const key = `${type}:${targetId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantityPerBatch += quantityPerBatch;
        return;
      }
      aggregated.set(key, {
        id,
        targetId,
        type,
        name,
        unit,
        quantityPerBatch,
        unitCost,
      });
    };

    selectedProduct.items.forEach((item) => {
      if (item.type === "material") {
        const mat = materials.find((m) => m.id === item.targetId);

        // Moldes/ferramentas ficam vinculados à receita, mas não são consumidos.
        if (mat?.usageType === "durable") return;

        if (mat?.isVirtualRecipe && mat.recipeItems?.length) {
          const virtualYield = Math.max(0.0001, mat.batchYield || 1);
          const scalePerProductBatch = item.quantity / virtualYield;

          mat.recipeItems.forEach((recipeItem) => {
            const expandedQuantityPerBatch =
              recipeItem.quantity * scalePerProductBatch;

            if (
              recipeItem.type === "material" &&
              recipeItem.selectionMode === "category" &&
              recipeItem.targetCategory
            ) {
              const selectionKey = makeVariableKey(
                item.id,
                mat.id,
                recipeItem.id,
              );
              const chosenId =
                item.categorySelections?.[recipeItem.id] ||
                variableSelections[selectionKey];
              const chosen = materials.find(
                (m) =>
                  m.id === chosenId &&
                  !m.isVirtualRecipe &&
                  m.category === recipeItem.targetCategory,
              );

              if (!chosen) {
                missingVariable = true;
                return;
              }

              if (chosen.usageType !== "durable") {
                addIngredient(
                  `${item.id}_${recipeItem.id}`,
                  chosen.id,
                  "material",
                  chosen.name,
                  UNIT_SHORT[chosen.unit] || recipeItem.unit,
                  expandedQuantityPerBatch,
                  chosen.inventoryUnitCost ?? chosen.unitCost,
                );
              }
              return;
            }

            if (recipeItem.type === "material") {
              const childMat = materials.find(
                (m) => m.id === recipeItem.targetId,
              );
              if (childMat) {
                if (childMat.usageType !== "durable") {
                  addIngredient(
                    `${item.id}_${recipeItem.id}`,
                    childMat.id,
                    "material",
                    childMat.name,
                    UNIT_SHORT[childMat.unit] || recipeItem.unit,
                    expandedQuantityPerBatch,
                    childMat.inventoryUnitCost ?? childMat.unitCost,
                  );
                }
              } else {
                addIngredient(
                  `${item.id}_${recipeItem.id}`,
                  recipeItem.targetId,
                  "material",
                  recipeItem.name,
                  recipeItem.unit,
                  expandedQuantityPerBatch,
                  recipeItem.unitCost,
                );
              }
              return;
            }

            const childProduct = products.find(
              (p) => p.id === recipeItem.targetId,
            );
            const childUnitCost = childProduct
              ? childProduct.unitCostFromBatch > 0
                ? childProduct.unitCostFromBatch
                : childProduct.totalCost
              : recipeItem.unitCost;
            addIngredient(
              `${item.id}_${recipeItem.id}`,
              recipeItem.targetId,
              "product",
              childProduct?.name || recipeItem.name,
              recipeItem.unit,
              expandedQuantityPerBatch,
              childUnitCost,
            );
          });

          return;
        }

        addIngredient(
          item.id,
          item.targetId,
          "material",
          mat?.name || item.name,
          mat ? UNIT_SHORT[mat.unit] || item.unit : item.unit,
          item.quantity,
          mat?.inventoryUnitCost ?? mat?.unitCost ?? item.unitCost,
        );
        return;
      }

      const subProd = products.find((p) => p.id === item.targetId);
      const subUnitCost = subProd
        ? subProd.unitCostFromBatch > 0
          ? subProd.unitCostFromBatch
          : subProd.totalCost
        : item.unitCost;
      addIngredient(
        item.id,
        item.targetId,
        "product",
        subProd?.name || item.name,
        item.unit,
        item.quantity,
        subUnitCost,
      );
    });

    const list: ProductionIngredientDeduction[] = Array.from(
      aggregated.values(),
    ).map((item) => {
      const quantityTotal = item.quantityPerBatch * parsedBatchCount;
      let stockBefore = 0;

      if (item.type === "material") {
        stockBefore =
          materials.find((m) => m.id === item.targetId)?.currentStock ?? 0;
      } else {
        stockBefore =
          products.find((p) => p.id === item.targetId)?.currentStock ?? 0;
      }

      const stockAfter = stockBefore - quantityTotal;
      if (stockAfter < 0) shortage = true;

      return {
        ...item,
        quantityTotal,
        totalCost: item.unitCost * quantityTotal,
        stockBefore,
        stockAfter,
      };
    });

    return {
      deductions: list,
      hasStockShortage: shortage,
      hasMissingVariableSelection: missingVariable,
    };
  })();
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
        getVirtualRecipeLaborCost(selectedProduct.items, materials)) *
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
