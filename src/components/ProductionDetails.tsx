import React, { useState, useEffect } from "react";
import { Eye, X, Image as ImageIcon } from "lucide-react";
import { ModalFrame } from "./ModalFrame";
import type {
  Production,
  Product,
  Material,
  ProductionIngredientDeduction,
} from "../types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";
import { planGroupedStageAdvance, previewGroupedStage, summarizeProductionGroup, type ProductionStageAdvance } from "../utils/productionFlow";
import { ProductionMaterialPlan } from './ProductionMaterialPlan';
import { ProductionIngredientForecast } from './ProductionIngredientForecast';

interface StageProgressModalProps {
  production: Production;
  groupProductions?: Production[];
  initialStageKey?: string;
  product: Product | null;
  products: Product[];
  materials: Material[];
  onClose: () => void;
  onAdvance?: (production: Production, deductions: ProductionIngredientDeduction[], finishedQuantityDelta: number) => void;
  onAdvanceBatch?: (advances: ProductionStageAdvance[]) => void;
}

export const StageProgressModal: React.FC<StageProgressModalProps> = ({
  production, groupProductions, initialStageKey, product, products, materials, onClose, onAdvance, onAdvanceBatch,
}) => {
  const sources = groupProductions || [production];
  const summary = summarizeProductionGroup(sources);
  const sortedStages = summary.stages;
  const firstPendingStage = sortedStages.find(stage => stage.quantity > 0) || sortedStages.find(stage => stage.pendingQuantity > 0);
  const [selectedStageId, setSelectedStageId] = useState(initialStageKey || firstPendingStage?.key || sortedStages[0]?.key || '');
  const [quantity, setQuantity] = useState('0');
  const [notice, setNotice] = useState('');
  const selectedStageIndex = sortedStages.findIndex(stage => stage.key === selectedStageId);
  const selectedStage = sortedStages[selectedStageIndex] || null;
  const availableToAdvance = selectedStage?.quantity || 0;
  const remainingInStage = selectedStage?.pendingQuantity || 0;
  const isFinalStage = !!selectedStage?.isFinal;
  useEffect(() => {
    setQuantity(String(availableToAdvance || remainingInStage || summary.remaining));
  }, [selectedStageId, availableToAdvance, remainingInStage, summary.remaining]);

  const parsedQuantity = Math.max(0, Number(quantity) || 0);
  const preview = previewGroupedStage(sources, selectedStageId, parsedQuantity, product, materials, products);
  const canRegister = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= availableToAdvance && parsedQuantity <= remainingInStage;
  const handleAdvance = () => {
    if (!product) { alert('Não foi possível localizar a receita desta produção.'); return; }
    const result = planGroupedStageAdvance(sources, selectedStageId, parsedQuantity, product, materials, products);
    if (!result.canRegister) { alert('Informe uma quantidade inteira disponível nesta etapa.'); return; }
    if (result.errors.length) { alert(result.errors[0]); return; }
    if (result.shortage && !window.confirm('Alguns insumos desta etapa não possuem saldo suficiente. Ao continuar, o estoque desses itens será ajustado para zero. Deseja registrar a etapa mesmo assim?')) return;
    try {
      if (onAdvanceBatch) onAdvanceBatch(result.advances);
      else result.advances.forEach(advance => onAdvance?.(advance.production, advance.deductions, advance.finishedQuantityDelta));
      const updated = sources.map(source => result.advances.find(advance => advance.production.id === source.id)?.production || source);
      const next = summarizeProductionGroup(updated);
      setNotice(next.remaining === 0 ? 'Produção concluída.' : `${selectedStage.stageName} registrada: ${formatNumber(parsedQuantity)} un.`);
      if (remainingInStage - parsedQuantity <= 0.0001) {
        const pending = next.stages.find(stage => stage.quantity > 0) || next.stages.find(stage => stage.pendingQuantity > 0);
        if (pending) setSelectedStageId(pending.key);
      }
    } catch (failure) { alert(failure instanceof Error ? failure.message : 'Não foi possível registrar a etapa.'); }
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
              {production.productName} · {formatNumber(summary.remaining)} un em produção
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

        {notice && <p role="status" className="mx-5 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

        <div className="p-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            {sortedStages.map((stage, index) => {
              const complete = stage.pendingQuantity === 0;
              const unlocked = stage.quantity > 0;
              return (
                <button
                  key={stage.key}
                  type="button"
                  aria-pressed={selectedStageId === stage.key}
                  onClick={() => setSelectedStageId(stage.key)}
                  className={`w-full p-3 rounded-xl border text-left transition-colors ${
                    selectedStageId === stage.key
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
                        {formatNumber(stage.quantity)} un
                      </span>
                      <span className="block text-[9px] text-stone-400">
                        {complete ? 'sem peças pendentes' : unlocked ? 'nesta etapa' : 'aguardando etapa anterior'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedStage && (
            <div className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {selectedStage.stageName}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {remainingInStage === 0
                      ? 'Esta etapa já foi registrada. Você pode consultar os insumos e simular quantidades, sem registrar novamente.'
                      : selectedStageIndex === 0
                      ? "Registre quantas unidades tiveram esta etapa concluída agora."
                      : `Há ${formatNumber(availableToAdvance)} un liberadas pela etapa anterior.`}
                  </p>
                </div>

              </div>

              <div>
                <label
                  htmlFor="production-stage-quantity"
                  className="block text-sm font-semibold text-stone-600 mb-1"
                >
                  Unidades para conferir nesta etapa
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(String(Math.max(0, parsedQuantity - 1)))
                    }
                    className="w-9 h-9 shrink-0 rounded-lg bg-white border border-stone-300 font-bold text-stone-700"
                  >
                    −
                  </button>
                  <input
                    id="production-stage-quantity"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="min-w-0 w-full flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-center font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        String(
                          Math.min(Number.MAX_SAFE_INTEGER, parsedQuantity + 1),
                        ),
                      )
                    }
                    className="w-9 h-9 shrink-0 rounded-lg bg-white border border-stone-300 font-bold text-stone-700"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Liberadas para registrar agora: {formatNumber(availableToAdvance)} un.
                  {' '}Você pode simular outras quantidades para organizar a bancada.
                </p>
                {parsedQuantity > availableToAdvance && <p role="status" className="mt-2 text-xs text-amber-800">
                  {remainingInStage === 0
                    ? 'Somente consulta: esta etapa já foi registrada.'
                    : 'Apenas planejamento: esta quantidade ainda não está liberada para registro.'}
                </p>}
              </div>

              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Previsão de insumos desta etapa
                </h5>
                {preview.previousRecipeUnits > 0 && <p role="status" className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {formatNumber(preview.previousRecipeUnits)} un desta simulação usam uma composição anterior, salva ao iniciar a produção. Os insumos dessas peças seguem esse registro.
                </p>}
                {preview.errors.length > 0 && <p role="status" className="mb-2 text-xs text-amber-800">Não foi possível calcular todos os insumos: {preview.errors.join(' ')}</p>}
                {parsedQuantity <= 0 ? (
                  <p className="text-[11px] text-stone-500">Informe uma quantidade para consultar os insumos desta etapa.</p>
                ) : preview.forecast.length === 0 ? (
                  <p className="text-[11px] text-stone-500 bg-white border border-stone-200 rounded-lg p-3">
                    Esta etapa não possui insumos consumíveis. Apenas o
                    progresso e a mão de obra serão registrados.
                  </p>
                ) : (
                  <ProductionIngredientForecast items={preview.forecast} />
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
              !selectedStage || !canRegister
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
  product: Product | null;
  materials: Material[];
  products: Product[];
  imageUrl?: string;
  onClose: () => void;
}

export const ViewProductionModal: React.FC<ViewProductionModalProps> = ({
  production,
  product,
  materials,
  products,
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

          {!!production.automaticManufacturing?.length && <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm"><h4 className="font-semibold">Produzido automaticamente para este consumo</h4><ul className="mt-2 space-y-1">{production.automaticManufacturing.map((item,index)=><li key={`${item.type}:${item.targetId}:${index}`}>{item.name}: {formatNumber(item.quantity)} {item.unit}</li>)}</ul></div>}
          {production.notes && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <strong className="block text-[10px] text-stone-500 uppercase font-semibold mb-0.5">
                Observações:
              </strong>
              {production.notes}
            </div>
          )}
          {production.status === 'in_progress' && !!production.stageProgress?.length &&
            <ProductionMaterialPlan production={production} product={product} materials={materials} products={products} />}
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
