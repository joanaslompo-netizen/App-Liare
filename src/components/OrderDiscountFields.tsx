import React from 'react';
import { Percent } from 'lucide-react';
import type { DiscountCode, DiscountType } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { initialOrderDiscount, type OrderDiscountDraft } from '../utils/orderDiscount';

const modes = [
  ['none', 'Sem desconto'],
  ['code', 'Código'],
  ['single-use', 'Código de uso único'],
  ['percentage', '% manual'],
  ['fixed', 'R$ manual'],
] as const;

const field = 'w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base';

export function OrderDiscountFields({ draft, codes, amount, onChange }: {
  draft: OrderDiscountDraft;
  codes: DiscountCode[];
  amount: number;
  onChange: (draft: OrderDiscountDraft) => void;
}) {
  const { mode, singleUse } = draft;
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#eadfd6] bg-[#fbf7f2] p-4" aria-label="Desconto do pedido">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Percent className="h-4 w-4 text-[#b96f55]" aria-hidden="true" />
          Desconto do pedido
        </p>
        {amount > 0 && <strong className="text-sm text-[#a86149]">−{formatCurrency(amount)}</strong>}
      </div>
      <div className="flex flex-wrap gap-2">
        {modes.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onChange(value === 'none' ? initialOrderDiscount() : { ...draft, mode: value })}
            className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${mode === value ? 'border-[#b96f55] bg-[#b96f55] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-[#c98a72]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'code' && (
        <select aria-label="Cupom de desconto" value={draft.codeId} onChange={event => onChange({ ...draft, codeId: event.target.value })} className={field}>
          <option value="">Escolher código de desconto...</option>
          {codes.map(code => (
            <option key={code.id} value={code.id}>
              {code.code} · {code.type === 'percentage' ? `${formatNumber(code.value)}%` : formatCurrency(code.value)}
            </option>
          ))}
        </select>
      )}
      {mode === 'single-use' && (
        <div className="space-y-3">
          <label className="block text-sm">
            Nome do código
            <input
              aria-label="Nome do código de uso único"
              value={singleUse.name}
              onChange={event => onChange({ ...draft, singleUse: { ...singleUse, name: event.target.value } })}
              placeholder="Ex.: PRESENTE30"
              required
              className={`mt-1 ${field}`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Tipo de desconto
              <select
                aria-label="Tipo do desconto de uso único"
                value={singleUse.type}
                onChange={event => onChange({ ...draft, singleUse: { ...singleUse, type: event.target.value as DiscountType } })}
                className={`mt-1 ${field}`}
              >
                <option value="percentage">Porcentagem</option>
                <option value="fixed">Valor em R$</option>
              </select>
            </label>
            <label className="text-sm">
              {singleUse.type === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
              <input
                aria-label="Valor do desconto de uso único"
                type="number"
                min="0.01"
                max={singleUse.type === 'percentage' ? 100 : undefined}
                step="0.01"
                value={singleUse.value}
                onChange={event => onChange({ ...draft, singleUse: { ...singleUse, value: event.target.value } })}
                required
                className={`mt-1 ${field}`}
              />
            </label>
          </div>
          <p className="text-xs text-stone-500">Válido só neste pedido.</p>
        </div>
      )}
      {(mode === 'percentage' || mode === 'fixed') && (
        <label className="block text-sm">
          {mode === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
          <input
            aria-label="Valor do desconto"
            type="number"
            min="0"
            max={mode === 'percentage' ? 100 : undefined}
            step="0.01"
            value={draft.manualValue}
            onChange={event => onChange({ ...draft, manualValue: event.target.value })}
            className={`mt-1 ${field}`}
          />
        </label>
      )}
    </fieldset>
  );
}
