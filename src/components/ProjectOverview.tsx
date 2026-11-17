import type { ReactNode } from 'react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

export interface ProjectOverviewRow {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  salePrice?: number;
  profit?: number;
  margin?: number | null;
  simulation: boolean;
  included: boolean;
}

const cell = 'border-b border-[#eee5dd] px-3 py-3 text-right tabular-nums whitespace-nowrap';
const label = 'border-b border-[#eee5dd] px-3 py-3 text-left font-semibold';

function Price({ value }: { value?: number | null }) {
  return value == null ? <>—</> : <>{formatCurrency(value)}</>;
}

export function ProjectAnalysis({ rows }: { rows: ProjectOverviewRow[] }) {
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="project-analysis-title">
      <div>
        <h3 id="project-analysis-title" className="text-xl font-semibold text-[#352f2b]">Análise das receitas</h3>
        <p className="mt-1 text-sm text-stone-600">Compare os valores por unidade, incluindo as simulações.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-[#e7dcd2] bg-white p-5 text-sm text-stone-600">Adicione uma receita para calcular custo e margem.</p>
      ) : (
        <div className="rounded-2xl border border-[#e7dcd2] bg-white">
          <table className="block w-full text-sm md:table">
            <thead className="hidden bg-[#f9f5f0] text-xs text-stone-700 md:table-header-group">
              <tr><th scope="col" className={label}>Receita</th><th scope="col" className={cell}>Custo com mão de obra</th><th scope="col" className={cell}>Venda</th><th scope="col" className={cell}>Lucro bruto</th><th scope="col" className={cell}>Margem</th></tr>
            </thead>
            <tbody className="block md:table-row-group">
              {rows.map(row => (
                <tr key={row.id} className="grid grid-cols-2 gap-3 border-b border-[#eee5dd] p-4 last:border-b-0 md:table-row md:border-0 md:p-0">
                  <th scope="row" className="col-span-2 min-w-0 text-left md:border-b md:border-[#eee5dd] md:px-3 md:py-3">
                    <span className="break-words font-semibold">{row.name}</span>
                    {row.simulation && <span className="ml-2 inline-block rounded-md bg-[#f1e8f5] px-1.5 py-0.5 text-[11px] font-medium text-[#683d75]">Simulação</span>}
                  </th>
                  <td className="md:px-3 md:py-3 md:text-right md:border-b md:border-[#eee5dd]"><span className="block text-xs text-stone-600 md:hidden">Custo com mão de obra</span><Price value={row.unitCost} /></td>
                  <td className="md:px-3 md:py-3 md:text-right md:border-b md:border-[#eee5dd]"><span className="block text-xs text-stone-600 md:hidden">Venda</span><Price value={row.salePrice} /></td>
                  <td className="md:px-3 md:py-3 md:text-right md:border-b md:border-[#eee5dd]"><span className="block text-xs text-stone-600 md:hidden">Lucro bruto</span><Price value={row.profit} /></td>
                  <td className="font-semibold md:px-3 md:py-3 md:text-right md:border-b md:border-[#eee5dd]"><span className="block text-xs font-normal text-stone-600 md:hidden">Margem</span>{row.margin == null ? '—' : formatPercent(row.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ProjectEstimate({ rows, additionalCost, onInclude, children }: {
  rows: ProjectOverviewRow[];
  additionalCost: number;
  onInclude: (id: string, included: boolean) => void;
  children: ReactNode;
}) {
  const options = rows.filter(row => !row.simulation);
  const included = options.filter(row => row.included && row.quantity > 0);
  const missing = included.filter(row => row.salePrice == null).length;
  const cost = included.reduce((sum, row) => sum + row.unitCost * row.quantity, additionalCost);
  const totalCents = included.reduce((sum, row) => sum + Math.round((row.salePrice ?? 0) * row.quantity * 100), 0);
  const units = included.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="project-estimate-title">
      <div>
        <h3 id="project-estimate-title" className="text-xl font-semibold text-[#352f2b]">Orçamento</h3>
        <p className="mt-1 text-sm text-stone-600">Selecione as receitas que entram no cálculo.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#e7dcd2] bg-white p-4 sm:grid-cols-3 sm:p-5" aria-label="Resumo do orçamento">
        <div className="col-span-2 sm:col-span-1"><p className="text-xs text-stone-600">{missing ? 'Subtotal com preço definido' : 'Valor de venda'}</p><p className="mt-1 text-2xl font-semibold text-[#352f2b]">{formatCurrency(totalCents / 100)}</p></div>
        <div><p className="text-xs text-stone-600">Custo previsto</p><p className="mt-1 text-lg font-semibold text-[#352f2b]">{formatCurrency(cost)}</p></div>
        <div><p className="text-xs text-stone-600">Quantidade</p><p className="mt-1 text-lg font-semibold text-[#352f2b]">{formatNumber(units, 4)} un</p></div>
        {missing > 0 && <p className="col-span-2 text-xs text-[#845319] sm:col-span-3" role="status">{missing === 1 ? '1 receita está sem preço de venda.' : `${missing} receitas estão sem preço de venda.`}</p>}
      </div>
      {options.length > 0 ? (
        <ul className="divide-y divide-[#eee5dd] rounded-2xl border border-[#e7dcd2] bg-white">
          {options.map(row => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#8f4c39]" checked={row.included} onChange={event => onInclude(row.id, event.target.checked)} aria-label={`Incluir ${row.name} no orçamento`} />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold">{row.name}</span>
                  <span className="text-xs text-stone-600">{formatNumber(row.quantity, 4)} un{row.salePrice == null ? '' : ` × ${formatCurrency(row.salePrice)}`}</span>
                </span>
              </label>
              <span className={`ml-auto text-sm font-semibold tabular-nums ${row.included ? 'text-stone-900' : 'text-stone-500'}`}>{row.salePrice == null ? 'A definir' : formatCurrency(Math.round(row.salePrice * row.quantity * 100) / 100)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-[#e7dcd2] bg-white p-5 text-sm text-stone-600">Adicione uma receita ou aprove uma simulação para montar o orçamento.</p>
      )}
      {children}
    </section>
  );
}
