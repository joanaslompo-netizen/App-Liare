import React from 'react';
import { getRecipeCostSummary } from '../utils/financials';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

interface RecipeCostSummaryProps {
  materialsCost: number;
  embeddedLaborCost?: number;
  laborCost: number;
  fixedCost: number;
  otherCosts: number;
  batchYield: number;
  salePrice: number;
  suggestedPrice?: number;
  compact?: boolean;
}

export const RecipeCostSummary: React.FC<RecipeCostSummaryProps> = (props) => {
  const cost = getRecipeCostSummary(props);
  return (
    <section aria-label="Resumo de custos e venda" className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div>
        <h4 className="text-sm font-bold text-stone-900">Custos e venda</h4>
        <p className="text-xs text-stone-500">Valores por unidade pronta{props.batchYield > 1 ? ` · receita rende ${formatNumber(props.batchYield)} unidades` : ''}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3"><dt>Custo dos materiais</dt><dd className="font-semibold tabular-nums">{formatCurrency(cost.materials)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Mão de obra total</dt><dd className="font-semibold tabular-nums">{formatCurrency(cost.labor)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-stone-100 pt-2"><dt>Materiais + mão de obra</dt><dd className="font-semibold tabular-nums">{formatCurrency(cost.materialsAndLabor)}</dd></div>
          <div className="flex justify-between gap-3 text-stone-500"><dt>Custos fixos + outros</dt><dd className="tabular-nums">{formatCurrency(cost.overhead)}</dd></div>
          <div className="flex justify-between gap-3 rounded-lg bg-stone-100 p-2.5 font-bold text-stone-900"><dt>Custos totais</dt><dd className="tabular-nums">{formatCurrency(cost.total)}</dd></div>
        </dl>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><dt className="font-semibold">Valor de venda</dt><dd className="text-lg font-bold text-stone-900 tabular-nums">{formatCurrency(props.salePrice)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Lucro após os custos</dt><dd className={`font-bold tabular-nums ${cost.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{formatCurrency(cost.profit)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Margem de lucro</dt><dd className={`font-bold tabular-nums ${cost.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{cost.marginPercent == null ? '—' : formatPercent(cost.marginPercent)}</dd></div>
          </dl>
          {!props.compact && <p className="mt-3 text-[11px] text-stone-600">Lucro = venda − custos totais. A margem é esse lucro dividido pelo valor de venda.</p>}
          {props.suggestedPrice != null && <p className="mt-3 text-[11px] text-stone-600">Preço sugerido: <strong>{formatCurrency(props.suggestedPrice)}</strong></p>}
        </div>
      </div>
      {!props.compact && <p className="text-[11px] text-stone-500">A mão de obra total inclui o trabalho desta receita e o trabalho já incluído nos componentes, contado uma única vez.</p>}
    </section>
  );
};
