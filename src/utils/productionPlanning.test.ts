import assert from "node:assert/strict";
import {
  productionMaterials as materials,
  productionProducts as products,
} from "../../scripts/productionFixtures";
import {
  aggregateProductionDeductions,
  buildProductionBatch,
  getProductionPlan,
  getProductionVariableRequirements,
} from "./productionPlanning";
import { getProductModels } from "./productModels";
import type { Material } from "../types";

const snapshot = JSON.stringify({ materials, products });
const groups = getProductModels(products, "production");
assert.equal(groups.length, 2);
assert.deepEqual(
  groups.find((g) => g.id === "mother:mother")?.products.map((p) => p.id),
  ["mother", "child"],
);
const independent = { ...products[2], id: "another", name: products[2].name };
assert.equal(
  getProductModels([products[2], independent]).length,
  2,
  "Equal names do not imply a family",
);
assert.equal(
  getProductModels([
    { ...products[0], productFamily: undefined },
    { ...products[1], productFamily: undefined },
  ]).length,
  1,
  "Mother links work without a family name",
);
assert.equal(
  getProductModels([{ ...products[0], isIntermediate: true }]).length,
  0,
);
assert.equal(
  getProductModels([{ ...products[0], isIntermediate: true }], "production")
    .length,
  1,
);
assert.equal(
  getProductModels([{ ...products[0], isCustomRecipe: true }], "production")
    .length,
  0,
);
assert.equal(
  getProductModels([
    { ...products[2], productFamily: "Explícita" },
    { ...independent, productFamily: "Explícita" },
  ]).length,
  1,
);
assert.doesNotThrow(() =>
  getProductModels([{ ...products[0], parentRecipeId: "child" }, products[1]]),
);

const staged = getProductionPlan(products[0], 4, materials, products);
assert.equal(staged.parsedBatchCount, 0.4);
assert.equal(
  staged.deductions.find((d) => d.targetId === "wax")?.quantityTotal,
  40,
);
assert.equal(staged.totalCost, 56);
const child = getProductionPlan(products[1], 3, materials, products);
const stages = buildProductionBatch(
  [staged, child],
  "2026-10-21",
  "Conferir",
  true,
);
assert.equal(new Set(stages.map((s) => s.id)).size, 2);
assert(
  stages.every(
    (p) =>
      p.status === "in_progress" &&
      p.quantityProduced === 0 &&
      p.deductedItems.length === 0,
  ),
);
assert.equal(stages[0].stageProgress![0].plannedQuantity, 4);
assert.equal(stages[0].recipeItemsSnapshot![0].quantity, 100);
assert.equal(
  aggregateProductionDeductions([staged, child]).find(
    (d) => d.targetId === "wax",
  )?.quantityTotal,
  70,
);
assert.equal(aggregateProductionDeductions([staged, child], true).length, 0);

const directA = getProductionPlan(products[2], 4, materials, products);
const directB = getProductionPlan(products[2], 3, materials, products);
const batch = buildProductionBatch(
  [directA, directB, staged],
  "2026-10-21",
  "",
  true,
);
assert.equal(batch[0].deductedItems[0].stockAfter, 960);
assert.equal(batch[1].deductedItems[0].stockBefore, 960);
assert.equal(batch[1].deductedItems[0].stockAfter, 930);
assert.equal(batch[2].deductedItems.length, 0);
assert.deepEqual(
  batch.map((p) => p.quantityProduced),
  [4, 3, 0],
);
const component = { ...products[2], id: 'component', batchYield: 1, items: [], isIntermediate: true };
const assembled = { ...products[2], id: 'assembled', batchYield: 1, items: [{ ...products[2].items[0], type: 'product' as const, targetId: component.id, quantity: 1 }] };
const assembledProducts = [...products, component, assembled];
const withComponent = buildProductionBatch([
  getProductionPlan(component, 2, materials, assembledProducts),
  getProductionPlan(assembled, 1, materials, assembledProducts),
], '2026-10-21', '', true);
assert.equal(withComponent[1].deductedItems[0].stockBefore, 2);
assert.equal(withComponent[1].deductedItems[0].stockAfter, 1);

const lowMaterials = materials.map((m) =>
  m.id === "wax" ? { ...m, currentStock: 60 } : m,
);
const low = [4, 3].map((n) =>
  getProductionPlan(products[2], n, lowMaterials, products),
);
assert(low.every((p) => !p.hasStockShortage));
assert.equal(
  aggregateProductionDeductions(low, true).find((d) => d.targetId === "wax")!
    .stockAfter,
  -10,
  "Shortage is checked across the entire batch",
);
assert.equal(
  buildProductionBatch([directA], "2026-10-21", "", false)[0]
    .stockTrackingEnabled,
  false,
);

const virtual = {
  ...materials[0],
  id: "virtual",
  isVirtualRecipe: true,
  batchYield: 110,
  recipeItems: [
    { ...products[0].items[0], quantity: 100 },
    {
      ...products[0].items[1],
      targetId: "",
      selectionMode: "category",
      targetCategory: "Essências",
      quantity: 10,
    },
  ],
} as Material;
const virtualProduct = {
  ...products[2],
  items: [
    {
      ...products[0].items[0],
      id: "virtual-row",
      targetId: "virtual",
      quantity: 110,
    },
  ],
  batchYield: 10,
};
const withVirtual = [...materials, virtual];
const requirement = getProductionVariableRequirements(
  virtualProduct,
  withVirtual,
)[0];
assert(
  getProductionPlan(virtualProduct, 2, withVirtual, products)
    .hasMissingVariableSelection,
);
const chosen = getProductionPlan(virtualProduct, 2, withVirtual, products, {
  [requirement.key]: "tea",
});
assert.equal(chosen.hasMissingVariableSelection, false);
assert.equal(
  chosen.deductions.find((d) => d.targetId === "tea")?.quantityTotal,
  2,
);
const durable = materials.map((m) =>
  m.id === "wax" ? { ...m, usageType: "durable" as const } : m,
);
assert(
  !getProductionPlan(products[2], 2, durable, products).deductions.some(
    (d) => d.targetId === "wax",
  ),
);
assert.equal(JSON.stringify({ materials, products }), snapshot);
console.log(
  "Produção: famílias explícitas, unidades/rendimento, custos, consumo conjunto, baixas sequenciais, snapshots, materiais variáveis e duráveis passaram.",
);
