import React, { useEffect, useState } from 'react';
import type { FinanceData, FinanceEntry } from '../types';
import type { FinanceAction } from './FinanceView';
import { automaticReceiptFee, creditReceiptRate, isCreditCardReceipt } from '../utils/receiptFees';
import { formatCurrency, formatNumber } from '../utils/formatters';

const field = 'w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900';
const currency = (cents: number) => formatCurrency(cents / 100);

export function ReceiptFeeSummary({ amountCents, feeCents }: { amountCents: number; feeCents: number }) {
  return <dl aria-label="Resumo do recebimento" className="grid gap-3 rounded-xl border border-[#e5dad1] bg-[#faf7f2] p-3 text-sm sm:grid-cols-3">
    <div><dt className="text-stone-500">Valor pago pelo cliente</dt><dd className="mt-1 font-semibold">{currency(amountCents)}</dd></div>
    <div><dt className="text-stone-500">Taxa da maquininha</dt><dd className="mt-1 font-semibold text-amber-800">−{currency(feeCents)}</dd></div>
    <div><dt className="text-stone-500">Líquido para você</dt><dd className="mt-1 font-semibold text-emerald-800">{currency(Math.max(0, amountCents - feeCents))}</dd></div>
  </dl>;
}

export function ReceiptFeeFields({ finance, method, amountCents, manualFee, onManualFeeChange }: {
  finance: FinanceData; method: string; amountCents: number; manualFee: string | null; onManualFeeChange: (value: string | null) => void;
}) {
  const credit = isCreditCardReceipt(method);
  const automatic = automaticReceiptFee(finance, method, amountCents);
  const fee = manualFee == null ? automatic : Math.round((Number(manualFee) || 0) * 100);
  return <div className="space-y-3">
    {(credit || fee > 0) && <>
      <p className="text-xs text-stone-500">{manualFee != null ? 'Taxa informada somente para este recebimento.' : finance.cardReceiptFee
        ? `Taxa automática no crédito: ${formatNumber(creditReceiptRate(finance, method), 4)}%.`
        : 'Cadastre a porcentagem em Financeiro → Taxas da maquininha para descontar automaticamente.'}</p>
      <ReceiptFeeSummary amountCents={amountCents} feeCents={fee} />
    </>}
    <details className="rounded-xl border border-[#e5dad1] p-3 text-sm" open={manualFee != null}>
      <summary className="cursor-pointer text-stone-600">Ajustar taxa deste recebimento</summary>
      <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={manualFee != null} onChange={event => onManualFeeChange(event.target.checked ? String(automatic / 100) : null)} />Informar uma taxa específica</label>
      {manualFee != null && <label className="mt-3 block space-y-1 font-medium">Taxa deste recebimento (R$)<input type="number" inputMode="decimal" min="0" max={Math.max(0, amountCents) / 100} step="0.01" required value={manualFee} onChange={event => onManualFeeChange(event.target.value)} className={field} /></label>}
    </details>
  </div>;
}

export function receiptFeeText(entry: FinanceEntry) {
  if (!['receipt', 'settlement'].includes(entry.kind) || (!isCreditCardReceipt(entry.method) && !(entry.feeCents > 0))) return '';
  return `Taxa${entry.feeRatePercent != null ? ` (${formatNumber(entry.feeRatePercent, 4)}%)` : ''}: ${currency(entry.feeCents || 0)} · Líquido: ${currency(entry.amountCents - (entry.feeCents || 0))}`;
}

export function CardReceiptFeeSettings({ finance, onAction }: { finance: FinanceData; onAction: FinanceAction }) {
  const current = finance.cardReceiptFee?.creditPercent ?? null;
  const [draft, setDraft] = useState({ value: current == null ? '' : String(current), expected: current, dirty: false });
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    setDraft(previous => previous.dirty ? previous : { value: current == null ? '' : String(current), expected: current, dirty: false });
  }, [current]);
  const rate = Number(draft.value), valid = draft.value.trim() !== '' && Number.isFinite(rate) && rate >= 0 && rate <= 100;
  return <section aria-label="Taxas da maquininha" className="max-w-2xl space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
    <div><h3 className="text-lg font-semibold">Taxa da maquininha no crédito</h3><p className="mt-1 text-sm text-stone-500">Ao registrar um pagamento no cartão de crédito, a taxa será descontada do valor que entra para você. O cliente quita o valor integral que pagou.</p></div>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy || !valid) return; setBusy(true); setNotice('');
      try { if (await onAction({ type: 'save_receipt_fee', creditPercent: rate, expectedPercent: draft.expected })) {
        setDraft({ value: String(rate), expected: rate, dirty: false }); setNotice('Taxa salva. Os próximos recebimentos no crédito terão o desconto automático.');
      } } finally { setBusy(false); }
    }}>
      <label className="block space-y-1 text-sm font-medium">Taxa no cartão de crédito (%)<input type="number" inputMode="decimal" min="0" max="100" step="0.01" required className={field} value={draft.value} onChange={event => { setDraft({ ...draft, value: event.target.value, dirty: true }); setNotice(''); }} /></label>
      {valid && <><p className="text-xs text-stone-500">Exemplo com um pagamento de R$ 100,00:</p><ReceiptFeeSummary amountCents={10000} feeCents={Math.round(100 * rate)} /></>}
      <p className="text-xs text-stone-500">A alteração vale para novos recebimentos. Os lançamentos anteriores mantêm suas taxas. Se uma venda tiver outra taxa, você pode ajustá-la naquele recebimento.</p>
      <button disabled={busy || !valid} className="rounded-xl bg-[#b96f55] px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar taxa da maquininha'}</button>
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    </form>
  </section>;
}
