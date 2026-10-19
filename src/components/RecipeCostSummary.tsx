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
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3"><dt>Custos:</dt><dd className="font-semibold tabular-nums">{formatCurrency(cost.costs)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg bg-stone-100 p-3 text-stone-900">
          <dt className="font-semibold">Custos + mão de obra:</dt><dd className="font-bold tabular-nums">{formatCurrency(cost.total)}</dd>
          <dd className="w-full text-[11px] text-stone-500">Guia de valor mínimo de venda</dd>
        </div>
        <div className="flex items-center justify-between gap-3"><dt>Valor de venda:</dt><dd className="text-lg font-bold text-stone-900 tabular-nums">{formatCurrency(props.salePrice)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Margem:</dt><dd className={`font-bold tabular-nums ${cost.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{cost.marginPercent == null ? '—' : formatPercent(cost.marginPercent)}</dd></div>
      </dl>
      {!props.compact && <p className="text-[11px] text-stone-500">Custos incluem materiais, custos fixos e outros. A mão de obra inclui o trabalho dos componentes, contado uma única vez.</p>}
      {!props.compact && <p className="text-[11px] text-stone-500">Margem = (venda − custos − mão de obra) ÷ custos × 100.</p>}
    </section>
  );
};
