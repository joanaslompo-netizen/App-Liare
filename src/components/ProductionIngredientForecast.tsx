import React from 'react';
import type { ConsumptionForecastNode } from '../utils/automaticManufacturing';
import { formatNumber } from '../utils/formatters';

const ForecastItem: React.FC<{ node: ConsumptionForecastNode; framed?: boolean }> = ({ node, framed = false }) => {
  const shortage = (node.stockAfter || 0) < -0.0001;
  return <li data-forecast-item={node.item.targetId} className={framed ? 'rounded-lg border border-stone-200 bg-white px-3 py-1' : undefined}>
    <div data-forecast-row className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className={`min-w-0 break-words text-stone-800 ${node.children.length ? 'font-semibold' : ''}`}>{node.item.name}</span>
      <span className={`shrink-0 text-right font-semibold tabular-nums ${shortage ? 'text-rose-700' : 'text-stone-700'}`}>
        {formatNumber(node.quantityTotal)} {node.item.unit}
        {shortage && <small className="block font-normal">Faltam {formatNumber(-node.stockAfter!)} {node.item.unit}</small>}
      </span>
    </div>
    {node.children.length > 0 && <div className="pb-1">
      <p className="mb-1 text-xs text-stone-500">
        {node.isVirtualRecipe ? 'Composição em insumos:' : <>
          {node.stockQuantity > 0 && <>Usar {formatNumber(node.stockQuantity)} {node.item.unit} do estoque pronto. </>}
          Fabricar automaticamente {formatNumber(node.manufactureQuantity)} {node.item.unit} com:
        </>}
      </p>
      <ul className="ml-1 space-y-1 border-l-2 border-[#e5dad1] pl-3">
        {node.children.map((child, index) => <ForecastItem key={`${child.item.id}:${index}`} node={child} />)}
      </ul>
    </div>}
  </li>;
};

export function ProductionIngredientForecast({ items }: { items: ConsumptionForecastNode[] }) {
  return <ul aria-label="Previsão de insumos" className="space-y-2">
    {items.map((node, index) => <ForecastItem key={`${node.item.id}:${index}`} node={node} framed />)}
  </ul>;
}
