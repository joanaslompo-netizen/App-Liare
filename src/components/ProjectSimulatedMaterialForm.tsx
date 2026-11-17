import { useId, useState } from 'react';
import type { ProjectRecipeItem, UnitOfMeasure } from '../types';
import { UNIT_LABELS, UNIT_SHORT, formatCurrency, formatNumber } from '../utils/formatters';
import { createQuotedRecipeItem, isCompatibleQuoteUnit } from '../utils/projectSimulation';

const units = Object.keys(UNIT_LABELS) as UnitOfMeasure[];
const field = 'mt-1 block w-full rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900';

export function ProjectSimulatedMaterialForm({ item, categories, onAdd }: {
  key?: string;
  item?: ProjectRecipeItem;
  categories: string[];
  onAdd: (item: ProjectRecipeItem) => void;
}) {
  const categoryListId = useId();
  const quote = item?.materialQuote;
  const originalUnit = units.find(value => value === item?.unit || UNIT_SHORT[value] === item?.unit);
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(quote?.category ?? '');
  const [unit, setUnit] = useState<UnitOfMeasure>(quote?.unit ?? originalUnit ?? 'un');
  const [quantity, setQuantity] = useState(item?.quantity.toString() ?? '1');
  const [packageUnit, setPackageUnit] = useState<UnitOfMeasure>(quote?.packageUnit ?? originalUnit ?? 'un');
  const [packageQuantity, setPackageQuantity] = useState(quote?.packageQuantity.toString() ?? '1');
  const [packagePrice, setPackagePrice] = useState(quote?.packagePrice.toString() ?? '');
  const [error, setError] = useState('');

  const add = () => {
    try {
      const ingredient = createQuotedRecipeItem(name, Number(quantity), {
        category,
        unit,
        packageUnit,
        packageQuantity: Number(packageQuantity),
        packagePrice: packagePrice.trim() ? Number(packagePrice) : NaN,
      }, item?.id);
      onAdd(ingredient);
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-600">Informe o preço que encontrou. O material será cadastrado se você aprovar esta receita.</p>
      <div className="grid gap-3 text-xs font-semibold text-stone-700 sm:grid-cols-2">
        <label>
          Nome do material de teste
          <input className={field} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Cera vegetal do fornecedor A" />
        </label>
        <label>
          Categoria (opcional)
          <input className={field} list={categoryListId} value={category} onChange={event => setCategory(event.target.value)} placeholder="Geral" />
          <datalist id={categoryListId}>{categories.map(value => <option key={value} value={value} />)}</datalist>
        </label>
        <label>
          Unidade na receita
          <select className={field} value={unit} onChange={event => {
            const nextUnit = event.target.value as UnitOfMeasure;
            setUnit(nextUnit);
            if (!isCompatibleQuoteUnit(packageUnit, nextUnit)) setPackageUnit(nextUnit);
          }}>
            {units.map(value => <option key={value} value={value}>{UNIT_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          Quantidade usada ({UNIT_SHORT[unit]})
          <input className={field} type="number" min="0" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} />
        </label>
        <label>
          Quantidade na embalagem
          <input className={field} type="number" min="0" step="any" value={packageQuantity} onChange={event => setPackageQuantity(event.target.value)} />
        </label>
        <label>
          Unidade da embalagem
          <select className={field} value={packageUnit} onChange={event => setPackageUnit(event.target.value as UnitOfMeasure)}>
            {units.filter(value => isCompatibleQuoteUnit(value, unit)).map(value => <option key={value} value={value}>{UNIT_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          Preço da embalagem (R$)
          <input className={field} type="number" min="0" step="0.01" value={packagePrice} onChange={event => setPackagePrice(event.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-rose-700" role="alert">{error}</p>}
      <button type="button" onClick={add} className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-50">
        {item ? 'Atualizar material de teste' : 'Adicionar material de teste'}
      </button>
    </div>
  );
}

export function ProjectMaterialQuoteDetails({ item }: { item: ProjectRecipeItem }) {
  const quote = item.materialQuote;
  if (!quote) return null;

  return (
    <span className="block text-[11px] text-stone-600">
      {formatCurrency(quote.packagePrice)} por {formatNumber(quote.packageQuantity, 4)} {UNIT_SHORT[quote.packageUnit]}
      {' · '}{formatCurrency(item.totalCost)} na receita
    </span>
  );
}
