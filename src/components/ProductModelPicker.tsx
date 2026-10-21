import React, { useMemo, useState } from "react";
import type { Product } from "../types";
import { getProductModels, getVariantLabel } from "../utils/productModels";
import { formatCurrency } from "../utils/formatters";

export function ProductModelPicker({
  products,
  selectedProductId,
  onSelectProduct,
  id = "product-model-picker",
  mode = "sale",
}: {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product | null) => void;
  id?: string;
  mode?: "sale" | "production";
}) {
  const models = useMemo(
    () => getProductModels(products, mode),
    [products, mode],
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
        <label
          className="block min-w-0 text-xs font-semibold text-[#75665c]"
          htmlFor={`${id}-model`}
        >
          Modelo
          <select
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
          </select>
        </label>
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
          Estoque: {selected.currentStock || 0} un · Venda:{" "}
          {formatCurrency(selected.actualPrice)}
          {selected.isPaused ? " · Produto pausado" : ""}
        </p>
      )}
    </div>
  );
}
