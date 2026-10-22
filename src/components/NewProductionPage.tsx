import { getCategoryMaterialOptions } from '../utils/virtualMaterials';
import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import type { Material, Product, Production } from "../types";
import { ProductModelPicker } from "./ProductModelPicker";
import {
  aggregateProductionDeductions,
  buildProductionBatch,
  getProductionPlan,
  getProductionVariableRequirements,
} from "../utils/productionPlanning";
import { formatCurrency, formatNumber } from "../utils/formatters";
import { localDateString } from "../utils/localDate";

export interface NewProductionPageProps {
  isOpen?: boolean;
  products: Product[];
  materials: Material[];
  presetProduct: Product | null;
  onClose: () => void;
  onSave?: (production: Production, updateStock: boolean) => void;
  onSaveBatch?: (productions: Production[]) => void;
}
type Draft = {
  id: string;
  productId: string;
  quantity: string;
  variables: Record<string, string>;
};
const newRow = (productId = ""): Draft => ({
  id: crypto.randomUUID(),
  productId,
  quantity: "1",
  variables: {},
});
const field =
  "w-full min-w-0 rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b]";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#352f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#57493f] disabled:opacity-40";

export function NewProductionPage({
  products,
  materials,
  presetProduct,
  onClose,
  onSave,
  onSaveBatch,
}: NewProductionPageProps) {
  const [rows, setRows] = useState<Draft[]>(() => [newRow(presetProduct?.id)]);
  const [date, setDate] = useState(localDateString());
  const [notes, setNotes] = useState("");
  const [updateStock, setUpdateStock] = useState(true);
  const [error, setError] = useState("");
  const submitted = useRef(false);
  const change = (id: string, patch: Partial<Draft>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    setError("");
  };
  const stepQuantity = (id: string, step: number) => {
    setRows(previous => previous.map(row => {
      if (row.id !== id) return row;
      const current = Number(row.quantity);
      const next = Number.isSafeInteger(current) && current >= 1
        ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, current + step)) : 1;
      return { ...row, quantity: String(next) };
    }));
    setError('');
  };
  const plans = useMemo(() => {
    const merged = new Map<
      string,
      { product: Product; quantity: number; variables: Record<string, string> }
    >();
    rows.forEach((row) => {
      const product = products.find((p) => p.id === row.productId);
      const quantity = Number(row.quantity);
      if (!product || !Number.isSafeInteger(quantity) || quantity <= 0) return;
      const key = JSON.stringify([
        product.id,
        Object.entries(row.variables).sort(([a], [b]) => a.localeCompare(b)),
      ]);
      const previous = merged.get(key);
      merged.set(key, {
        product,
        variables: row.variables,
        quantity: (previous?.quantity || 0) + quantity,
      });
    });
    return [...merged.values()].map((row) =>
      getProductionPlan(
        row.product,
        row.quantity,
        materials,
        products,
        row.variables,
      ),
    );
  }, [rows, products, materials]);
  const deductions = aggregateProductionDeductions(plans);
  const ready =
    rows.length > 0 &&
    rows.every(
      (row) =>
        products.some((p) => p.id === row.productId) &&
        Number.isSafeInteger(Number(row.quantity)) &&
        Number(row.quantity) > 0,
    ) &&
    plans.every((plan) => !plan.hasMissingVariableSelection);
  const total = plans.reduce((sum, p) => sum + p.quantityProduced, 0);
  const direct = plans.filter((p) => !p.isStagedProduction);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted.current) return;
    if (!ready || !date) {
      setError(plans.flatMap(plan => plan.errors)[0] ||
        "Escolha o modelo e o aroma de cada item, confira as quantidades e complete os materiais variáveis.");
      return;
    }
    const shortages = aggregateProductionDeductions(plans, true).filter(
      (d) => d.stockAfter < -0.0001,
    );
    if (
      updateStock &&
      shortages.length &&
      !window.confirm(
        "Materiais insuficientes para a produção direta:\n" +
          shortages
            .map(
              (d) =>
                `${d.name}: faltam ${formatNumber(-d.stockAfter)} ${d.unit}`,
            )
            .join("\n") +
          "\n\nAo continuar, esses saldos serão ajustados para zero. Deseja registrar mesmo assim?",
      )
    )
      return;
    const batch = buildProductionBatch(plans, date, notes, updateStock);
    submitted.current = true;
    try {
      if (onSaveBatch) onSaveBatch(batch);
      else
        batch.forEach((p) =>
          onSave?.(p, updateStock && p.status !== "in_progress"),
        );
      onClose();
    } catch (err) {
      submitted.current = false;
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a produção. Tente novamente.",
      );
    }
  };

  return (
    <section className="liare-new-production space-y-5 text-[#352f2b]">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 text-sm text-[#75665c]"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para produção
      </button>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Nova produção</h2>
        <p className="mt-1 text-sm text-[#75665c]">
          Escolha os itens que vai produzir de uma vez.
        </p>
      </header>
      <form onSubmit={submit} className="space-y-5" aria-label="Nova produção">
        <section
          className="rounded-2xl border border-[#e5dad1] bg-white"
          aria-label="Itens da produção"
        >
          <div className="border-b border-[#eee6de] p-5">
            <h3 className="font-semibold">O que vamos produzir?</h3>
            <p className="mt-1 text-sm text-[#75665c]">
              Modelo, depois aroma e quantidade.
            </p>
          </div>
          {rows.map((row, index) => {
            const product = products.find((p) => p.id === row.productId);
            const variables = product
              ? getProductionVariableRequirements(product, materials, row.variables)
              : [];
            return (
              <div
                key={row.id}
                data-production-row={row.id}
                className="border-b border-[#eee6de] p-4 sm:p-5"
              >
                <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_180px_40px]">
                  <ProductModelPicker
                    id={`production-item-${row.id}`}
                    products={products}
                    selectedProductId={row.productId}
                    mode="production"
                    onSelectProduct={(p) =>
                      change(row.id, { productId: p?.id || "", variables: {} })
                    }
                  />
                  <div className="text-xs font-semibold text-[#75665c]">
                    <label htmlFor={`production-quantity-${row.id}`}>Unidades</label>
                    <div className="mt-1 flex min-h-11 items-stretch overflow-hidden rounded-xl border border-[#e5dad1] bg-white focus-within:border-[#a86149]">
                    <button type="button" aria-label={`Diminuir unidades do item ${index + 1}`}
                      disabled={!Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) <= 1}
                      onClick={() => stepQuantity(row.id, -1)}
                      className="flex min-h-11 w-11 shrink-0 items-center justify-center text-[#75665c] hover:bg-[#f6f1ec] disabled:opacity-30">
                      <Minus aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <input id={`production-quantity-${row.id}`}
                      aria-label={`Unidades do item ${index + 1}`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      required
                      value={row.quantity}
                      onChange={(e) =>
                        change(row.id, { quantity: e.target.value })
                      }
                      className="w-full min-w-0 border-x border-[#e5dad1] bg-white px-1 py-2.5 text-center text-base font-normal text-[#352f2b] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button type="button" aria-label={`Aumentar unidades do item ${index + 1}`}
                      disabled={Number(row.quantity) >= Number.MAX_SAFE_INTEGER}
                      onClick={() => stepQuantity(row.id, 1)}
                      className="flex min-h-11 w-11 shrink-0 items-center justify-center text-[#75665c] hover:bg-[#f6f1ec] disabled:opacity-30">
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() =>
                      setRows((prev) =>
                        prev.length > 1
                          ? prev.filter((r) => r.id !== row.id)
                          : [newRow()],
                      )
                    }
                    className="rounded-lg p-3 text-[#956350] hover:bg-[#f6f1ec] lg:mt-5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {product && (
                  <p className="mt-2 text-xs text-[#75665c]">
                    {product.useProductionStages &&
                    product.productionStages?.length
                      ? [...product.productionStages]
                          .sort((a, b) => a.order - b.order)
                          .map((s) => s.name)
                          .join(" → ")
                      : "Sem etapas: será registrada como concluída ao confirmar."}
                  </p>
                )}
                {variables.length > 0 && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[#f6f1ec] p-3 sm:grid-cols-2">
                    {variables.map((v) => (
                      <label key={v.key} className="text-xs text-[#75665c]">
                        {v.virtualMaterialName} · {v.category}
                        <select
                          aria-label={`${v.category} do item ${index + 1}`}
                          required
                          value={row.variables[v.key] || ""}
                          onChange={(e) =>
                            change(row.id, {
                              variables: {
                                ...row.variables,
                                [v.key]: e.target.value,
                              },
                            })
                          }
                          className={`${field} mt-1`}
                        >
                          <option value="">Selecione o material</option>
                          {getCategoryMaterialOptions(materials, v.category, v.unit, v.ancestors)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="p-4">
            <button
              id="btn-add-production-item"
              type="button"
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#a86149]"
            >
              <Plus className="h-4 w-4" />
              Adicionar outro item
            </button>
          </div>
        </section>
        <div className="flex flex-wrap items-start gap-5">
          <label className="text-xs text-[#75665c]">
            Data de início
            <input
              aria-label="Data de início da produção"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <details className="pt-4">
            <summary className="text-sm text-[#75665c]">
              Observação e opções de estoque
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-[#75665c]">
                Observação
                <input
                  aria-label="Observação da produção"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                />
                Atualizar estoque automaticamente
              </label>
            </div>
          </details>
        </div>
        {plans.length > 0 && (
          <details className="rounded-xl border border-[#e5dad1] bg-white p-4">
            <summary className="text-sm font-semibold">
              Conferir materiais de todos os itens
            </summary>
            <div className="mt-3 space-y-2">
              {deductions.map((d) => (
                <div
                  key={`${d.type}:${d.targetId}`}
                  className="flex flex-wrap justify-between gap-2 border-b border-[#eee6de] py-2 text-sm"
                >
                  <span>{d.name}</span>
                  <span className="text-right tabular-nums">
                    {formatNumber(d.quantityTotal)} {d.unit}
                    {d.stockAfter < 0 && (
                      <span className="ml-2 text-xs text-rose-700">
                        Faltam {formatNumber(-d.stockAfter)} {d.unit}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-sm text-[#75665c]">
                Custo previsto:{" "}
                {formatCurrency(plans.reduce((sum, p) => sum + p.totalCost, 0))}
              </p>
            </div>
          </details>
        )}
        {direct.length > 0 && (
          <p className="text-sm text-[#75665c]">
            {direct.map((p) => p.product.name).join("; ")}:{" "}
            {direct.reduce((sum, p) => sum + p.quantityProduced, 0)} unidades
            serão registradas como prontas, pois estas receitas não têm etapas.
          </p>
        )}
        <p className="text-xs text-[#75665c]">
          Nas receitas por etapas, os materiais são baixados conforme o trabalho
          avança e os produtos entram no estoque somente na última etapa.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p aria-live="polite" className="text-sm text-[#75665c]">
            {plans.length} {plans.length === 1 ? "item" : "itens"} · {total}{" "}
            unidades
          </p>
          <button
            id="btn-start-productions"
            type="submit"
            disabled={!ready}
            className={primary}
          >
            Iniciar todas as produções
          </button>
        </div>
      </form>
    </section>
  );
}
