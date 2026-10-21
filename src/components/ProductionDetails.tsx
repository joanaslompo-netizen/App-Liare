import React, { useState, useMemo, useEffect } from "react";
import { Eye, X, Image as ImageIcon } from "lucide-react";
import { ModalFrame } from "./ModalFrame";
import { localDateString } from "../utils/localDate";
import type {
  Production,
  Product,
  Material,
  ProductionIngredientDeduction,
  RecipeItem,
} from "../types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  UNIT_SHORT,
} from "../utils/formatters";
import { getVirtualRecipeLaborCost } from "../utils/storage";

interface StageProgressModalProps {
  production: Production;
  product: Product | null;
  products: Product[];
  materials: Material[];
  onClose: () => void;
  onAdvance: (
    production: Production,
    deductions: ProductionIngredientDeduction[],
    finishedQuantityDelta: number,
  ) => void;
}

const mergeDeductionLists = (
  current: ProductionIngredientDeduction[],
  additions: ProductionIngredientDeduction[],
): ProductionIngredientDeduction[] => {
  const merged = current.map((item) => ({ ...item }));

  additions.forEach((addition) => {
    const existing = merged.find(
      (item) =>
        item.type === addition.type && item.targetId === addition.targetId,
    );

    if (!existing) {
      merged.push({ ...addition });
      return;
    }

    existing.quantityTotal = Number(
      (existing.quantityTotal + addition.quantityTotal).toFixed(4),
    );
    existing.totalCost = Number(
      (existing.totalCost + addition.totalCost).toFixed(4),
    );
    existing.stockAfter = addition.stockAfter;
    existing.unitCost = addition.unitCost;
    existing.quantityPerBatch = Math.max(
      existing.quantityPerBatch,
      addition.quantityPerBatch,
    );
  });

  return merged;
};

export const StageProgressModal: React.FC<StageProgressModalProps> = ({
  production,
  product,
  products,
  materials,
  onClose,
  onAdvance,
}) => {
  const sortedStages = useMemo(
    () =>
      [...(production.stageProgress || [])].sort((a, b) => a.order - b.order),
    [production.stageProgress],
  );

  const firstPendingStage = sortedStages.find(
    (stage) => stage.completedQuantity < stage.plannedQuantity,
  );
  const [selectedStageId, setSelectedStageId] = useState<string>(
    firstPendingStage?.stageId || sortedStages[0]?.stageId || "",
  );
  const [quantity, setQuantity] = useState<string>("0");

  const selectedStageIndex = sortedStages.findIndex(
    (stage) => stage.stageId === selectedStageId,
  );
  const selectedStage =
    selectedStageIndex >= 0 ? sortedStages[selectedStageIndex] : null;
  const targetQuantity =
    production.targetQuantity || production.batchCount * production.batchYield;
  const previousCompleted =
    selectedStageIndex <= 0
      ? targetQuantity
      : sortedStages[selectedStageIndex - 1]?.completedQuantity || 0;
  const availableToAdvance = selectedStage
    ? Math.max(0, previousCompleted - selectedStage.completedQuantity)
    : 0;
  const isFinalStage = selectedStageIndex === sortedStages.length - 1;
  const batchYield = Math.max(0.0001, production.batchYield || 1);
  const recipeItems: RecipeItem[] =
    production.recipeItemsSnapshot || product?.items || [];
  const stageRecipeItems = selectedStage
    ? recipeItems.filter(
        (item) => item.productionStageId === selectedStage.stageId,
      )
    : [];

  useEffect(() => {
    setQuantity(availableToAdvance > 0 ? String(availableToAdvance) : "0");
  }, [selectedStageId, availableToAdvance]);

  const makeVariableKey = (
    productItemId: string,
    virtualMaterialId: string,
    recipeItemId: string,
  ) => `${productItemId}::${virtualMaterialId}::${recipeItemId}`;

  const buildStageDeductions = (quantityToAdvance: number) => {
    let shortage = false;
    let missingVariable = false;
    type PendingDeduction = Omit<
      ProductionIngredientDeduction,
      "quantityTotal" | "totalCost" | "stockBefore" | "stockAfter"
    >;
    const aggregated = new Map<string, PendingDeduction>();
    const batchFactor = quantityToAdvance / batchYield;

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

    stageRecipeItems.forEach((item) => {
      if (item.type === "material") {
        const mat = materials.find((material) => material.id === item.targetId);
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
                production.variableSelections?.[selectionKey];
              const chosen = materials.find(
                (material) =>
                  material.id === chosenId &&
                  !material.isVirtualRecipe &&
                  material.category === recipeItem.targetCategory,
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
              const childMaterial = materials.find(
                (material) => material.id === recipeItem.targetId,
              );
              if (childMaterial) {
                if (childMaterial.usageType !== "durable") {
                  addIngredient(
                    `${item.id}_${recipeItem.id}`,
                    childMaterial.id,
                    "material",
                    childMaterial.name,
                    UNIT_SHORT[childMaterial.unit] || recipeItem.unit,
                    expandedQuantityPerBatch,
                    childMaterial.unitCost,
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
              (candidate) => candidate.id === recipeItem.targetId,
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

      const subProduct = products.find(
        (candidate) => candidate.id === item.targetId,
      );
      const subUnitCost = subProduct
        ? subProduct.unitCostFromBatch > 0
          ? subProduct.unitCostFromBatch
          : subProduct.totalCost
        : item.unitCost;
      addIngredient(
        item.id,
        item.targetId,
        "product",
        subProduct?.name || item.name,
        item.unit,
        item.quantity,
        subUnitCost,
      );
    });

    const deductions = Array.from(aggregated.values()).map((item) => {
      const quantityTotal = item.quantityPerBatch * batchFactor;
      const stockBefore =
        item.type === "material"
          ? (materials.find((material) => material.id === item.targetId)
              ?.currentStock ?? 0)
          : (products.find((candidate) => candidate.id === item.targetId)
              ?.currentStock ?? 0);
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

    return { deductions, shortage, missingVariable, batchFactor };
  };

  const parsedQuantity = Math.max(0, Number(quantity) || 0);
  const preview = buildStageDeductions(
    Math.min(parsedQuantity, availableToAdvance),
  );

  const handleAdvance = () => {
    if (!selectedStage || !product) {
      alert("Não foi possível localizar a receita desta produção.");
      return;
    }

    if (parsedQuantity <= 0) {
      alert("Informe uma quantidade maior que zero.");
      return;
    }

    if (parsedQuantity > availableToAdvance + 0.0001) {
      alert(
        selectedStageIndex === 0
          ? "A quantidade informada ultrapassa o total planejado desta produção."
          : "Esta quantidade ainda não concluiu a etapa anterior.",
      );
      return;
    }

    const result = buildStageDeductions(parsedQuantity);
    if (result.missingVariable) {
      alert("Falta uma escolha de material variável nesta ordem de produção.");
      return;
    }

    const tracksStock = production.stockTrackingEnabled !== false;
    if (result.shortage && tracksStock) {
      const proceed = window.confirm(
        "Alguns insumos desta etapa não possuem saldo suficiente. Ao continuar, o estoque desses itens será ajustado para zero. Deseja registrar a etapa mesmo assim?",
      );
      if (!proceed) return;
    }

    const recordedDeductions = tracksStock
      ? result.deductions.map((deduction) => ({
          ...deduction,
          stockAfter: Math.max(0, Number(deduction.stockAfter.toFixed(4))),
        }))
      : result.deductions;

    const nextCompletedQuantity = Number(
      (selectedStage.completedQuantity + parsedQuantity).toFixed(4),
    );

    const nextStageProgress = sortedStages.map((stage) => {
      if (stage.stageId !== selectedStage.stageId) return stage;
      return {
        ...stage,
        completedQuantity: nextCompletedQuantity,
        deductedItems: mergeDeductionLists(
          stage.deductedItems || [],
          recordedDeductions,
        ),
      };
    });

    const ingredientCostDelta = recordedDeductions.reduce(
      (sum, deduction) => sum + deduction.totalCost,
      0,
    );
    const virtualLaborDelta =
      getVirtualRecipeLaborCost(stageRecipeItems, materials) *
      result.batchFactor;
    const laborCostDelta =
      ((selectedStage.laborMinutes || 0) / 60) *
      (product.hourlyRate || 0) *
      result.batchFactor;
    const finalOverheadDelta = isFinalStage
      ? ((product.fixedCost || 0) + (product.otherCosts || 0)) *
        result.batchFactor
      : 0;
    const finishedQuantityDelta = isFinalStage ? parsedQuantity : 0;
    const nextFinishedQuantity = Number(
      (production.quantityProduced + finishedQuantityDelta).toFixed(4),
    );
    const isCompleted =
      isFinalStage && nextCompletedQuantity >= targetQuantity - 0.0001;

    const updatedProduction: Production = {
      ...production,
      status: isCompleted ? "completed" : "in_progress",
      quantityProduced: nextFinishedQuantity,
      totalCost: Number(
        (
          production.totalCost +
          ingredientCostDelta +
          laborCostDelta +
          virtualLaborDelta +
          finalOverheadDelta
        ).toFixed(4),
      ),
      deductedItems: mergeDeductionLists(
        production.deductedItems || [],
        recordedDeductions,
      ),
      stageProgress: nextStageProgress,
      completedAt: isCompleted ? localDateString() : undefined,
    };

    onAdvance(updatedProduction, recordedDeductions, finishedQuantityDelta);
  };

  return (
    <ModalFrame embedded onClose={onClose} className="w-full">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs w-full overflow-hidden flex flex-col">
        <div className="liare-modal-header flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              Continuar produção
            </h3>
            <p className="text-xs text-stone-500">
              {production.productName} · {formatNumber(targetQuantity)} un
              planejadas
            </p>
          </div>
          <button
            aria-label="Fechar janela"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            {sortedStages.map((stage, index) => {
              const complete =
                stage.completedQuantity >= stage.plannedQuantity - 0.0001;
              const unlocked =
                index === 0 ||
                (sortedStages[index - 1]?.completedQuantity || 0) >
                  stage.completedQuantity;
              const pct = Math.min(
                100,
                (stage.completedQuantity / Math.max(1, stage.plannedQuantity)) *
                  100,
              );
              return (
                <button
                  key={stage.stageId}
                  type="button"
                  onClick={() => setSelectedStageId(stage.stageId)}
                  className={`w-full p-3 rounded-xl border text-left transition-colors ${
                    selectedStageId === stage.stageId
                      ? "border-amber-400 bg-amber-50/60"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400">
                        Etapa {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-stone-900">
                        {stage.stageName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold ${complete ? "text-emerald-700" : unlocked ? "text-amber-800" : "text-stone-400"}`}
                      >
                        {formatNumber(stage.completedQuantity)}/
                        {formatNumber(stage.plannedQuantity)}
                      </span>
                      <span className="block text-[9px] text-stone-400">
                        {complete
                          ? "concluída"
                          : unlocked
                            ? "disponível"
                            : "aguardando etapa anterior"}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 mt-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {selectedStage && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {selectedStage.stageName}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {selectedStageIndex === 0
                      ? "Registre quantas unidades tiveram esta etapa concluída agora."
                      : `Há ${formatNumber(availableToAdvance)} un liberadas pela etapa anterior.`}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-stone-500 bg-white border border-stone-200 rounded-md px-2 py-1">
                  {selectedStage.laborMinutes || 0} min/batelada
                </span>
              </div>

              <div>
                <label
                  htmlFor="production-stage-quantity"
                  className="block text-sm font-semibold text-stone-600 mb-1"
                >
                  Quantidade concluída agora
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(String(Math.max(0, parsedQuantity - 1)))
                    }
                    className="w-9 h-9 rounded-lg bg-white border border-stone-300 font-bold text-stone-700"
                  >
                    −
                  </button>
                  <input
                    id="production-stage-quantity"
                    type="number"
                    min="0"
                    max={availableToAdvance}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-center font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        String(
                          Math.min(availableToAdvance, parsedQuantity + 1),
                        ),
                      )
                    }
                    className="w-9 h-9 rounded-lg bg-white border border-stone-300 font-bold text-stone-700"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Máximo disponível agora: {formatNumber(availableToAdvance)} un
                </p>
              </div>

              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Baixa desta etapa
                </h5>
                {preview.deductions.length === 0 ? (
                  <p className="text-[11px] text-stone-500 bg-white border border-stone-200 rounded-lg p-3">
                    Esta etapa não possui insumos consumíveis. Apenas o
                    progresso e a mão de obra serão registrados.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {preview.deductions.map((deduction) => (
                      <div
                        key={`${deduction.type}-${deduction.targetId}`}
                        className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-lg px-3 py-2 text-[11px]"
                      >
                        <span className="font-medium text-stone-800 truncate">
                          {deduction.name}
                        </span>
                        <span
                          className={`font-bold shrink-0 ${deduction.stockAfter < 0 ? "text-rose-700" : "text-stone-700"}`}
                        >
                          -{formatNumber(deduction.quantityTotal)}{" "}
                          {deduction.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAdvance}
            disabled={
              !selectedStage || parsedQuantity <= 0 || availableToAdvance <= 0
            }
            className="px-4 py-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-500 rounded-lg"
          >
            {isFinalStage
              ? "Concluir etapa e adicionar ao estoque"
              : "Registrar etapa"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

// ==========================================
// View Production Details Modal
// ==========================================

interface ViewProductionModalProps {
  production: Production;
  imageUrl?: string;
  onClose: () => void;
}

export const ViewProductionModal: React.FC<ViewProductionModalProps> = ({
  production,
  imageUrl,
  onClose,
}) => {
  return (
    <ModalFrame embedded onClose={onClose} className="w-full">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="liare-modal-header flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                Detalhes da Ordem de Produção
              </h3>
              <p className="text-xs text-stone-500">
                Registrada em {formatDate(production.date)}
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar janela"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1">
          {/* Main Info */}
          <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
            <div className="w-16 h-16 rounded-lg bg-white border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={production.productName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-stone-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded">
                  {production.productCategory}
                </span>
                {production.isIntermediate && (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    Sub-produto
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-stone-900">
                {production.productName}
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Produzidas{" "}
                <strong className="text-stone-800 font-semibold">
                  {production.quantityProduced} unidades
                </strong>{" "}
                em {production.batchCount}{" "}
                {production.batchCount === 1 ? "batelada" : "bateladas"}.
              </p>
            </div>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block uppercase font-medium">
                Custo por Peça
              </span>
              <span className="text-lg font-bold text-stone-900">
                {formatCurrency(production.costPerUnit)}
              </span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block uppercase font-medium">
                Custo Total da Batelada
              </span>
              <span className="text-lg font-bold text-stone-900">
                {formatCurrency(production.totalCost)}
              </span>
            </div>
          </div>

          {/* Deducted items */}
          <div>
            <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider mb-2">
              Insumos Baixados ({production.deductedItems.length}):
            </h5>
            <div className="border border-stone-200 rounded-xl overflow-x-auto bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-50 text-[10px] uppercase font-semibold text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3">Insumo</th>
                    <th className="py-2 px-3 text-right">Qtd Total</th>
                    <th className="py-2 px-3 text-right">Custo Insumo</th>
                    <th className="py-2 px-3 text-right">
                      Estoque Antes → Depois
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {production.deductedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium">{item.name}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600 font-mono">
                        -{formatNumber(item.quantityTotal)} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(item.totalCost)}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-500 font-mono">
                        {item.stockBefore !== undefined &&
                        item.stockAfter !== undefined
                          ? `${formatNumber(item.stockBefore)} → ${formatNumber(item.stockAfter)}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {production.notes && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <strong className="block text-[10px] text-stone-500 uppercase font-semibold mb-0.5">
                Observações:
              </strong>
              {production.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};
