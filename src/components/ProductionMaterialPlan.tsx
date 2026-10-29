import React, { useMemo, useState } from 'react';
import type { Material, Product, Production, ProductionIngredientDeduction } from '../types';
import { aggregateProductionDeductions, getProductionPlan, replanProductionSequence } from '../utils/productionPlanning';
import { formatNumber } from '../utils/formatters';
import { resolveProductionRecipe } from '../utils/productionRecipe';
import { ProductionIngredientForecast } from './ProductionIngredientForecast';

function MaterialList({ items }: { items: ProductionIngredientDeduction[] }) {
  if (!items.length) return <p className="text-sm text-[#75665c]">Sem insumos consumíveis.</p>;
  return <ul className="divide-y divide-[#eee6de]">
    {items.map(item => <li key={`${item.type}:${item.targetId}`} className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="min-w-0 break-words text-[#352f2b]">{item.name}</span>
      <span className="shrink-0 font-semibold tabular-nums text-[#352f2b]">{formatNumber(item.quantityTotal)} {item.unit}</span>
    </li>)}
  </ul>;
}

export function ProductionMaterialPlan({ production: original, product, materials, products }: {
  production: Production;
  product: Product | null;
  materials: Material[];
  products: Product[];
}) {
  const production = useMemo(() => resolveProductionRecipe(original, product), [original, product]);
  const target = production.targetQuantity || production.batchCount * production.batchYield;
  const [quantity, setQuantity] = useState(String(target));
  const [remainingOnly, setRemainingOnly] = useState(false);
  const parsed = Number(quantity);
  const valid = Number.isSafeInteger(parsed) && parsed > 0;
  const stages = useMemo(() => {
    const items = production.recipeItemsSnapshot || product?.items;
    if (!items) return [];
    const stagePlans = [...(production.stageProgress || [])].sort((a, b) => a.order - b.order).map(stage => {
      const units = valid ? Math.max(0, parsed - (remainingOnly ? stage.completedQuantity : 0)) : 0;
      const plan = getProductionPlan({ totalCost: 0, materialsCost: 0, ...product, batchYield: production.batchYield,
        items: items.filter(item => item.productionStageId === stage.stageId).map(item => ({ ...item,
          quantity: remainingOnly && units > 0 ? item.quantity * Math.max(0, parsed - Math.max(stage.completedQuantity, production.recipeProgress?.items[item.id] || 0)) / units : item.quantity })) } as Product,
      units, materials, products, production.variableSelections);
      return { stage, units, plan };
    });
    const sharedPlans = replanProductionSequence(stagePlans.map(value => value.plan), false);
    return stagePlans.map((value, index) => ({ ...value, plan: sharedPlans[index] }));
  }, [production, product, materials, products, parsed, valid, remainingOnly]);
  const total = aggregateProductionDeductions(stages.map(stage => stage.plan));
  const errors = [...new Set(stages.flatMap(stage => stage.plan.errors))];

  if (!production.recipeItemsSnapshot && !product) return <p role="status" className="text-sm text-[#75665c]">
    A receita desta produção não está disponível para calcular o planejamento dos insumos.
  </p>;

  return <section aria-label="Planejamento dos insumos" className="space-y-4 rounded-2xl border border-[#e5dad1] bg-[#fbf8f5] p-4 sm:p-5">
    <div>
      <h4 className="text-base font-semibold text-[#352f2b]">Planejamento dos insumos</h4>
      <p className="mt-1 text-sm text-[#75665c]">Confira o que separar para cada etapa. Simular quantidades não altera a produção nem movimenta o estoque.</p>
    </div>
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm font-medium text-[#75665c]">
        Planejar para quantas unidades?
        <input type="number" inputMode="numeric" min="1" step="1" value={quantity}
          onChange={event => setQuantity(event.target.value)}
          className="mt-1 block w-32 rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b]" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-[#75665c]">
        <input type="checkbox" checked={remainingOnly} onChange={event => setRemainingOnly(event.target.checked)} />
        Mostrar apenas o que falta em cada etapa
      </label>
    </div>
    {!valid ? <p role="status" className="text-sm text-[#956350]">Informe uma quantidade inteira maior que zero para simular.</p> : <>
      <p className="text-xs text-[#75665c]">{remainingOnly ? 'Necessário para o que falta concluir' : 'Simulação completa com a receita atual'} · {formatNumber(parsed)} unidades. Cada receita aparece com seus insumos logo abaixo.</p>
      {errors.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Não foi possível calcular todos os insumos: {errors.join(' ')}
      </div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {stages.map(({ stage, units, plan }, index) => <section key={stage.stageId} aria-label={`Planejamento: ${stage.stageName}`}
          className="rounded-xl border border-[#e5dad1] bg-white px-4 py-3">
          <p className="text-xs font-medium text-[#8a817a]">Etapa {index + 1} · {formatNumber(units)} unidades</p>
          <h5 className="mt-1 font-semibold text-[#352f2b]">{stage.stageName}</h5>
          <p className="mb-2 mt-1 text-xs text-[#75665c]">Já concluídas: {formatNumber(stage.completedQuantity)} de {formatNumber(stage.plannedQuantity)}</p>
          {units > 0 ? (plan.forecast.length ? <ProductionIngredientForecast items={plan.forecast} /> : <p className="text-sm text-[#75665c]">Sem insumos consumíveis.</p>) : <p className="text-sm text-[#75665c]">Nada a separar para esta etapa.</p>}
        </section>)}
      </div>
      <section aria-label="Total geral de insumos" className="rounded-xl border border-[#dcc6b8] bg-white p-4">
        <h5 className="mb-1 font-semibold text-[#352f2b]">Total geral para separar{remainingOnly ? ' · restante' : ''}</h5>
        <MaterialList items={total} />
      </section>
    </>}
  </section>;
}
