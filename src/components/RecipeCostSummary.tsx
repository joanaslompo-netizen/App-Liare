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
      <dl className="space-y-2.5 text-sm">
        {!props.compact && (
          <>
            <div className="flex justify-between gap-3"><dt>Materiais e componentes (sem mão de obra):</dt><dd className="font-semibold tabular-nums shrink-0">{formatCurrency(cost.materials)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Custos fixos:</dt><dd className="tabular-nums shrink-0">{formatCurrency(cost.fixed)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Outros custos:</dt><dd className="tabular-nums shrink-0">{formatCurrency(cost.other)}</dd></div>
          </>
        )}
        <div className={`flex justify-between gap-3 ${props.compact ? '' : 'border-t border-stone-200 pt-2.5'}`}>
          <dt className="font-semibold">Custos financeiros:</dt><dd className="font-bold tabular-nums shrink-0">{formatCurrency(cost.costs)}</dd>
        </div>
        {!props.compact && (
          <>
            <div className="flex justify-between gap-3"><dt>Mão de obra dos componentes:</dt><dd className="tabular-nums shrink-0">{formatCurrency(cost.componentLabor)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Mão de obra desta receita:</dt><dd className="tabular-nums shrink-0">{formatCurrency(cost.ownLabor)}</dd></div>
            <div className="flex justify-between gap-3 font-semibold"><dt>Mão de obra total:</dt><dd className="tabular-nums shrink-0">{formatCurrency(cost.labor)}</dd></div>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg bg-stone-100 p-3 text-stone-900">
          <dt className="font-semibold">Custos + mão de obra:</dt><dd className="font-bold tabular-nums">{formatCurrency(cost.total)}</dd>
          <dd className="w-full text-[11px] text-stone-500">Referência mínima de venda incluindo sua remuneração</dd>
        </div>
        <div className="flex items-center justify-between gap-3"><dt>Valor de venda:</dt><dd className="text-lg font-bold text-stone-900 tabular-nums">{formatCurrency(props.salePrice)}</dd></div>
        {!props.compact && (
          <div className="flex justify-between gap-3"><dt>Lucro bruto (inclui sua mão de obra):</dt><dd className={`font-semibold tabular-nums shrink-0 ${cost.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{formatCurrency(cost.profit)}</dd></div>
        )}
        <div className="flex justify-between gap-3"><dt>Margem:</dt><dd className={`font-bold tabular-nums ${cost.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{cost.marginPercent == null ? '—' : formatPercent(cost.marginPercent)}</dd></div>
      </dl>
      {!props.compact && <p className="text-[11px] text-stone-500">A mão de obra dos componentes e desta receita aparece à parte, sem reduzir o lucro nem a margem. A margem é calculada sobre o preço de venda, descontando apenas os custos financeiros.</p>}
    </section>
  );
};
