import React, { useMemo, useState } from "react";
import type { Product } from "../types";
import { getProductModels, getVariantLabel } from "../utils/productModels";
import { formatCurrency } from "../utils/formatters";
import { ModelSearch } from './ModelSearch';

export function ProductModelPicker({
  products,
  selectedProductId,
  onSelectProduct,
  id = "product-model-picker",
  mode = "sale",
  searchable = false,
  stockAvailable,
  availableProductIds,
  stockLabel,
  showPrice = true,
}: {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product | null) => void;
  id?: string;
  mode?: "sale" | "production";
  searchable?: boolean;
  stockAvailable?: number;
  availableProductIds?: string[];
  stockLabel?: string;
  showPrice?: boolean;
}) {
  const models = useMemo(
    () => {
      const models = getProductModels(products, mode);
      if (!availableProductIds) return models;
      const allowed = new Set(availableProductIds);
      return models.map(model => ({ ...model, products: model.products.filter(product => allowed.has(product.id)) })).filter(model => model.products.length > 0);
    },
    [products, mode, availableProductIds],
  );
  const [modelId, setModelId] = useState("");
  const selected = products.find((p) => p.id === selectedProductId);
  const model =
    models.find((m) => m.products.some((p) => p.id === selectedProductId)) ||
    models.find((m) => m.id === modelId && m.products.length > 1);
  const field =
    "w-full min-w-0 rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b] focus:border-[#a86149] disabled:bg-[#f6f1ec] disabled:text-stone-400";
  return (
    <div id={id} className="min-w-0 space-y-2">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 text-xs font-semibold text-[#75665c]">
          <label htmlFor={`${id}-model`}>Modelo</label>
          {mode === 'production' || searchable ? <ModelSearch id={`${id}-model`} models={models}
            listLabel={mode === 'production' ? 'Modelos de produção' : 'Modelos de produtos'}
            value={model?.id || ''} className={field} onSelect={next => {
              setModelId(next?.id || '');
              onSelectProduct(next?.products.length === 1 ? next.products[0] : null);
            }} /> : <select
            id={`${id}-model`}
            className={`${field} mt-1`}
            value={model?.id || ""}
            onChange={(e) => {
              setModelId(e.target.value);
              const next = models.find((m) => m.id === e.target.value);
              onSelectProduct(
                next?.products.length === 1 ? next.products[0] : null,
              );
            }}
          >
            <option value="">Selecione o modelo</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>}
        </div>
        {model && model.products.length === 1 ? (
          <div className="min-w-0 text-xs font-semibold text-[#75665c]">
            <span>Aroma</span>
            <p className="mt-1 py-3 text-sm font-normal text-[#352f2b]">
              {model.products[0].fragrance || "Aroma do produto"}
            </p>
          </div>
        ) : (
          <label
            className="block min-w-0 text-xs font-semibold text-[#75665c]"
            htmlFor={`${id}-aroma`}
          >
            Aroma
            <select
              id={`${id}-aroma`}
              className={`${field} mt-1`}
              disabled={!model}
              value={
                model?.products.some((p) => p.id === selectedProductId)
                  ? selectedProductId
                  : ""
              }
              onChange={(e) =>
                onSelectProduct(
                  model?.products.find((p) => p.id === e.target.value) || null,
                )
              }
            >
              <option value="">
                {model ? "Selecione o aroma" : "Escolha o modelo primeiro"}
              </option>
              {model?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {getVariantLabel(p, model)}
                  {p.isPaused ? " (pausado)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {selected && mode === "sale" && (
        <p className="text-xs text-[#75665c]">
          {stockLabel || (stockAvailable == null ? 'Estoque' : 'Disponível no ateliê')}: {stockAvailable ?? selected.currentStock ?? 0} un
          {showPrice && <> · Venda: {formatCurrency(selected.actualPrice)}</>}
          {selected.isPaused ? " · Produto pausado" : ""}
        </p>
      )}
    </div>
  );
}
