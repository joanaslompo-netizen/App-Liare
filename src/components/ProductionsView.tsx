import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import type {
  Material,
  Product,
  Production,
} from "../types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  matchesSearchText,
} from "../utils/formatters";
import { groupActiveProductions, type ProductionStageAdvance } from "../utils/productionFlow";
import { NewProductionPage } from "./NewProductionPage";
import { StageProgressModal, ViewProductionModal } from "./ProductionDetails";
export { NewProductionPage as NewProductionModal } from "./NewProductionPage";
export type { NewProductionPageProps as NewProductionModalProps } from "./NewProductionPage";

interface ProductionsViewProps {
  productions: Production[];
  products: Product[];
  materials: Material[];
  onSaveProduction?: (production: Production, updateStock: boolean) => void;
  onSaveProductions?: (productions: Production[]) => void;
  onAdvanceProductionStages: (advances: ProductionStageAdvance[]) => void;
  onDeleteProduction: (id: string, revertStock: boolean) => void;
  onNavigateToProducts?: () => void;
  initialProductToProduce?: Product | null;
  initialSelectedProduct?: Product | null;
  onClearInitialProduct?: () => void;
  openNewProductionSignal?: number;
}

export function ProductionsView({
  productions,
  products,
  materials,
  onSaveProduction,
  onSaveProductions,
  onAdvanceProductionStages,
  onDeleteProduction,
  initialProductToProduce = null,
  initialSelectedProduct = null,
  onClearInitialProduct,
  openNewProductionSignal = 0,
}: ProductionsViewProps) {
  const [creating, setCreating] = useState(
    !!(initialProductToProduce || initialSelectedProduct),
  );
  const [preset, setPreset] = useState(
    initialProductToProduce || initialSelectedProduct,
  );
  const [status, setStatus] = useState<"in_progress" | "completed">(
    "in_progress",
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [advancing, setAdvancing] = useState<{ key: string; ids: string[]; stageKey?: string } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const product = initialProductToProduce || initialSelectedProduct;
    if (product) {
      setPreset(product);
      setCreating(true);
    }
  }, [initialProductToProduce, initialSelectedProduct]);
  useEffect(() => {
    if (openNewProductionSignal > 0) {
      setPreset(null);
      setCreating(true);
    }
  }, [openNewProductionSignal]);
  const closeNew = () => {
    setCreating(false);
    setPreset(null);
    onClearInitialProduct?.();
  };
  const groups = useMemo(() => groupActiveProductions(productions), [productions]);
  const inProgress = groups.length;
  const completed = productions.filter(p => (p.status || 'completed') === 'completed').length;
  const matches = (p: Production) => (type === 'all' || (type === 'intermediate' ? !!p.isIntermediate : !p.isIntermediate)) &&
    (!query || [p.productName, p.productCategory || '', p.notes || '', p.id, ...(p.deductedItems || []).map(d => d.name)].some(value => matchesSearchText(value, query)));
  const filteredGroups = groups.filter(group => group.productions.some(matches));
  const filtered = productions.filter(p => (p.status || 'completed') === 'completed' && matches(p)).sort((a, b) => b.date.localeCompare(a.date));
  const advancingProductions = advancing ? productions.filter(p => advancing.ids.includes(p.id) ||
    ((p.productId || p.id) === advancing.key && p.status === 'in_progress')) : [];
  const advance = advancingProductions[0];
  const viewing = productions.find((p) => p.id === viewingId);
  if (creating)
    return (
      <NewProductionPage
        products={products}
        materials={materials}
        presetProduct={preset}
        onClose={closeNew}
        onSave={onSaveProduction}
        onSaveBatch={(batch) => {
          if (onSaveProductions) onSaveProductions(batch);
          else
            batch.forEach((p) =>
              onSaveProduction?.(
                p,
                p.stockTrackingEnabled !== false && p.status !== "in_progress",
              ),
            );
          setStatus(
            batch.some((p) => p.status === "in_progress")
              ? "in_progress"
              : "completed",
          );
          setQuery("");
          setType("all");
          setNotice(
            `${batch.length} ${batch.length === 1 ? "produção registrada" : "produções registradas"}.`,
          );
        }}
      />
    );
  const back = () => {
    setAdvancing(null);
    setViewingId(null);
  };
  if (advance || viewing)
    return (
      <section className="liare-production-detail space-y-5">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-sm text-[#75665c]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para produção
        </button>
        {advance ? (
          <StageProgressModal
            key={advancing.key}
            production={advance}
            groupProductions={advancingProductions}
            initialStageKey={advancing.stageKey}
            product={products.find((p) => p.id === advance.productId) || null}
            products={products}
            materials={materials}
            onClose={back}
            onAdvanceBatch={(advances) => {
              onAdvanceProductionStages(advances);
              setNotice('Etapa registrada.');
            }}
          />
        ) : (
          viewing && (
            <ViewProductionModal
              production={viewing}
              product={products.find(p => p.id === viewing.productId) || null}
              materials={materials}
              products={products}
              imageUrl={
                viewing.productImageUrl ||
                products.find((p) => p.id === viewing.productId)?.imageUrl
              }
              onClose={back}
            />
          )
        )}
      </section>
    );
  return (
    <section className="space-y-5 text-[#352f2b]" aria-label="Produção">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Produção</h2>
          <p className="mt-1 text-sm text-[#75665c]">
            Acompanhe o que está na bancada.
          </p>
        </div>
        <button
          id="btn-add-production"
          type="button"
          onClick={() => {
            setPreset(null);
            setCreating(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#352f2b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#57493f]"
        >
          <Plus className="h-4 w-4" />
          Nova produção
        </button>
      </header>
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}
      <div
        className="flex flex-wrap gap-6 border-b border-[#e5dad1]"
        role="tablist"
        aria-label="Situação das produções"
      >
        {(
          [
            { id: "in_progress", label: "Em andamento", count: inProgress },
            { id: "completed", label: "Concluídas", count: completed },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            id={`production-tab-${t.id}`}
            role="tab"
            aria-controls="production-list"
            aria-selected={status === t.id}
            type="button"
            onClick={() => {
              setStatus(t.id);
              setNotice("");
            }}
            className={`border-b-2 pb-3 text-sm ${status === t.id ? "border-[#a86149] font-semibold text-[#352f2b]" : "border-transparent text-[#75665c]"}`}
          >
            {t.label}
            <span className="ml-2 rounded bg-[#f1e9e2] px-1.5 py-0.5 text-xs">
              {t.count}
            </span>
          </button>
        ))}
      </div>
      <details className="text-sm text-[#75665c]">
        <summary>Buscar e filtrar produções</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar produção</span>
            <Search className="absolute left-3 top-3 h-4 w-4" />
            <input
              aria-label="Buscar produção"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Produto, material, lote ou observação"
              className="w-full rounded-xl border border-[#e5dad1] bg-white py-2.5 pl-9 pr-3 text-base"
            />
          </label>
          <label>
            <span className="sr-only">Tipo de produção</span>
            <select
              aria-label="Tipo de produção"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base"
            >
              <option value="all">Todos os tipos</option>
              <option value="final">Produtos finais</option>
              <option value="intermediate">Componentes</option>
            </select>
          </label>
        </div>
      </details>
      <div
        id="production-list"
        role="tabpanel"
        aria-labelledby={`production-tab-${status}`}
        className="space-y-4"
      >
        {!(status === 'in_progress' ? filteredGroups.length : filtered.length) && (
          <div className="rounded-2xl border border-[#e5dad1] bg-white p-8 text-center">
            <h3 className="font-semibold">
              {query || type !== "all"
                ? "Nenhuma produção neste filtro"
                : status === "in_progress"
                  ? "Nenhuma produção em andamento"
                  : "Nenhuma produção concluída"}
            </h3>
            <p className="mt-2 text-sm text-[#75665c]">
              {status === "in_progress"
                ? "Inicie uma produção ou consulte as concluídas."
                : "As produções finalizadas aparecem aqui, com seus registros preservados."}
            </p>
          </div>
        )}
        {status === 'in_progress' && filteredGroups.map(group => {
          const first = group.productions[0];
          const open = (stageKey?: string) => setAdvancing({ key: group.key, ids: group.productions.map(p => p.id), stageKey });
          return <article key={group.key} id={`production-item-${first.id}`} data-production-group={group.key}
            className="rounded-2xl border border-[#e5dad1] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold">{first.productName}</h3>
                <p className="mt-1 text-sm font-semibold text-[#a86149]" data-production-remaining>{formatNumber(group.remaining)} un em produção</p>
              </div>
              {!!group.stages.length && <button type="button" data-advance-production={first.id} onClick={() => open()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#352f2b] px-4 py-2.5 text-sm font-semibold text-white">
                Continuar produção <ArrowRight className="h-4 w-4" />
              </button>}
            </div>
            {!!group.stages.length && <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {group.stages.map(stage => <button key={stage.key} type="button" data-production-stage={stage.key}
                onClick={() => open(stage.key)} className={`min-w-0 rounded-xl border p-3 text-left ${stage.quantity > 0 ? 'border-[#e4c4b2] bg-[#fcf5ef]' : 'border-[#eee6de] bg-[#faf8f5]'}`}>
                <span className="block break-words text-xs text-[#75665c]">{stage.stageName}</span>
                <span className="mt-1 block text-lg font-semibold tabular-nums" data-stage-quantity>{formatNumber(stage.quantity)} un</span>
                <span className="text-xs text-[#75665c]">{stage.quantity > 0 ? 'nesta etapa' : stage.pendingQuantity > 0 ? 'aguardando etapa anterior' : 'sem peças pendentes'}</span>
              </button>)}
            </div>}
            <details className="mt-4 border-t border-[#eee6de] pt-3">
              <summary className="text-xs text-[#75665c]">Registros, materiais e observações</summary>
              <div className="mt-3 space-y-3">{group.productions.map(p => <div key={p.id} className="rounded-xl border border-[#eee6de] p-3 text-sm text-[#75665c]">
                <p>{formatDate(p.date)} · {formatNumber((p.targetQuantity ?? p.batchCount * p.batchYield) - p.quantityProduced)} un em produção{p.stockTrackingEnabled === false ? ' · Sem movimentação de estoque' : ''}</p>
                {p.notes && <p className="mt-1 whitespace-pre-wrap break-words">{p.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-4">
                  <button type="button" onClick={() => setViewingId(p.id)} className="text-[#a86149] underline">Ver registro completo</button>
                  <button type="button" onClick={() => {
                    if (window.confirm(`Excluir a produção de "${p.productName}" e reverter as movimentações de estoque registradas?`)) onDeleteProduction(p.id, true);
                  }} className="text-rose-700 underline">Excluir e estornar</button>
                </div>
              </div>)}</div>
            </details>
          </article>;
        })}
        {status === 'completed' && filtered.map((p) => {
          const stages = [...(p.stageProgress || [])].sort(
            (a, b) => a.order - b.order,
          );
          const target = p.targetQuantity || p.batchCount * p.batchYield;
          return (
            <article
              key={p.id}
              id={`production-item-${p.id}`}
              className="rounded-2xl border border-[#e5dad1] bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold">
                    {p.productName}
                  </h3>
                  <p className="mt-1 text-xs text-[#75665c]">
                    {formatNumber(target)} unidades · {formatDate(p.date)}
                    {p.stockTrackingEnabled === false
                      ? " · Sem movimentação de estoque"
                      : ""}
                  </p>
                </div>
                <span className="rounded-lg bg-[#f7e8df] px-2.5 py-1 text-xs text-[#a86149]">
                  Concluída
                </span>
              </div>
              {stages.length > 0 && (
                <div
                  className="my-5 grid gap-3 sm:gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(stages.length, 3)}, minmax(0, 1fr))`,
                  }}
                >
                  {stages.map((s) => (
                    <div key={s.stageId} className="min-w-0">
                      <div
                        className="mb-1.5 flex flex-wrap justify-between gap-1 text-xs text-[#75665c]"
                      >
                        <span className="break-words">{s.stageName}</span>
                        <span className="tabular-nums">
                          {formatNumber(s.completedQuantity)}/
                          {formatNumber(s.plannedQuantity)}
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={s.stageName}
                        aria-valuemin={0}
                        aria-valuemax={s.plannedQuantity}
                        aria-valuenow={s.completedQuantity}
                        className="h-1 overflow-hidden rounded-full bg-[#f1e9e2]"
                      >
                        <div
                          className={`h-full rounded-full ${s.completedQuantity >= s.plannedQuantity ? "bg-[#587961]" : "bg-[#a86149]"}`}
                          style={{
                            width: `${Math.min(100, (s.completedQuantity / Math.max(0.0001, s.plannedQuantity)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#75665c]">
                  {formatNumber(p.quantityProduced)} unidades finalizadas
                </span>
                <button type="button" onClick={() => setViewingId(p.id)} className="rounded-xl border border-[#e5dad1] px-4 py-2.5 text-sm">
                  Ver detalhes
                </button>
              </div>
              <details className="mt-4 border-t border-[#eee6de] pt-3">
                <summary className="text-xs text-[#75665c]">
                  Materiais, custos e observações
                </summary>
                <div className="mt-3 space-y-2 text-sm text-[#75665c]">
                  <p>
                    Custo registrado: {formatCurrency(p.totalCost)}
                    {p.plannedTotalCost != null
                      ? ` · Previsto: ${formatCurrency(p.plannedTotalCost)}`
                      : ""}
                  </p>
                  {p.notes && (
                    <p className="whitespace-pre-wrap break-words">{p.notes}</p>
                  )}
                  <p>
                    {p.deductedItems.length} materiais e componentes
                    registrados.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => setViewingId(p.id)}
                      className="text-[#a86149] underline"
                    >
                      Ver registro completo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Excluir a produção de "${p.productName}" e reverter as movimentações de estoque registradas?`,
                          )
                        )
                          onDeleteProduction(p.id, true);
                      }}
                      className="text-rose-700 underline"
                    >
                      Excluir e estornar
                    </button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-[#75665c]">
        Os materiais são baixados por etapa. As unidades prontas entram no
        estoque ao concluir a última etapa.
      </p>
    </section>
  );
}
