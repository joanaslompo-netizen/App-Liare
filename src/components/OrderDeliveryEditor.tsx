import React, { useId, useRef, useState } from 'react';
import { CheckCircle2, Minus, Package, Plus, Truck } from 'lucide-react';
import type { Product, Sale, SaleItem } from '../types';
import { isActiveOrder, migrateFinanceOrder, newId, type FinanceCommand } from '../utils/financeLedger';
import { formatDate } from '../utils/formatters';
import { localDateString } from '../utils/localDate';

const delivered = (item: SaleItem) => Math.max(0, (item.deliveredQuantity || 0) - (item.returnedQuantity || 0));
const remaining = (item: SaleItem) => Math.max(0, item.quantity - delivered(item));

export function OrderDeliveryEditor({ sale, products = [], onAction, onCompleted, onCancel }: {
  key?: string; sale: Sale; products?: Product[]; onAction: (command: FinanceCommand) => Promise<boolean>;
  onCompleted: (message: string) => void; onCancel: () => void;
}) {
  const items = migrateFinanceOrder(sale).items!;
  const pending = items.filter(item => remaining(item) > 0);
  const complete = items.filter(item => remaining(item) === 0);
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(pending.map(item => [item.id!, String(remaining(item))])));
  const [date, setDate] = useState(localDateString());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  const formId = useId();
  const selected = pending.map(item => ({ itemId: item.id!, quantity: Number(quantities[item.id!] || 0) })).filter(item => item.quantity > 0);
  const totalPending = pending.reduce((sum, item) => sum + remaining(item), 0);
  const totalSelected = selected.reduce((sum, item) => sum + item.quantity, 0);
  const invalid = pending.some(item => {
    const value = Number(quantities[item.id!] || 0);
    return !Number.isSafeInteger(value) || value < 0 || value > remaining(item);
  });
  const allSelected = !invalid && totalSelected === totalPending;

  const updateQuantity = (id: string, value: string) => { setError(''); setQuantities(previous => ({ ...previous, [id]: value })); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !isActiveOrder(sale) || invalid || !selected.length) return;
    submitting.current = true; setBusy(true); setError('');
    const fingerprint = JSON.stringify({ saleId: sale.id, items: selected, date, note });
    if (operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, id: newId() };
    try {
      const ok = await onAction({ type: 'deliver_items', id: operation.current.id, saleId: sale.id, items: selected, date, note });
      if (ok) {
        operation.current = null;
        const left = totalPending - totalSelected;
        onCompleted(`Entrega registrada: ${totalSelected} ${totalSelected === 1 ? 'peça' : 'peças'}.${left > 0 ? ` Ainda faltam ${left} ${left === 1 ? 'peça' : 'peças'} neste pedido.` : ' Todas as peças do pedido foram entregues.'}`);
      } else setError('A entrega não foi confirmada. Confira o aviso e tente novamente.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a entrega. Tente novamente.'); }
    finally { submitting.current = false; setBusy(false); }
  };

  if (!isActiveOrder(sale)) return <p className="text-sm text-[#75665c]">Este pedido não está disponível para entrega.</p>;
  if (!pending.length) return <p role="status" className="flex items-center gap-2 text-sm text-[#53613f]"><CheckCircle2 className="h-5 w-5" />Todas as peças deste pedido já foram entregues.</p>;

  return <form aria-label="Registrar entrega de produtos" onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-relaxed text-[#75665c]">Tudo que falta entregar já está marcado. Se a entrega foi parcial, desmarque os produtos ou ajuste a quantidade ao lado.</p>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <legend className="sr-only">Produtos desta entrega</legend>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[#57493f]">{pending.length} {pending.length === 1 ? 'produto pendente' : 'produtos pendentes'}</span>
        <div className="flex gap-4">
          {!allSelected && <button type="button" onClick={() => { setError(''); setQuantities(Object.fromEntries(pending.map(item => [item.id!, String(remaining(item))]))); }} className="font-semibold text-[#a86149]">Selecionar tudo</button>}
          {totalSelected > 0 && <button type="button" onClick={() => { setError(''); setQuantities({}); }} className="text-[#75665c] underline">Limpar seleção</button>}
        </div>
      </div>
      <div className="space-y-3">{pending.map((item, index) => {
        const value = quantities[item.id!] ?? '0';
        const count = Number(value || 0);
        const checked = count > 0;
        const max = remaining(item);
        const product = products.find(product => product.id === (item.isCustom ? item.customProductId : item.productId));
        const image = item.productImageUrl || product?.imageUrl;
        const labelId = `${formId}-item-${index}`;
        const invalidQuantity = !Number.isSafeInteger(count) || count < 0 || count > max;
        return <div key={item.id} data-delivery-item={item.id} className={`rounded-xl border p-4 transition-colors ${checked ? 'border-[#cdb4a2] bg-[#faf6f1]' : 'border-[#e5dad1] bg-white'}`}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <input id={`${labelId}-check`} type="checkbox" aria-labelledby={labelId} checked={checked} onChange={() => updateQuantity(item.id!, checked ? '0' : String(max))} className="h-5 w-5 shrink-0 accent-[#a86149]" />
              {image ? <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eee5dd] text-[#a86149]"><Package className="h-5 w-5" /></span>}
              <div className="min-w-0"><label id={labelId} htmlFor={`${labelId}-check`} className="cursor-pointer text-sm font-semibold">{item.productName}{product?.fragrance && <span className="mt-0.5 block text-xs font-normal text-[#75665c]">{product.fragrance}</span>}</label><p className="mt-1 text-xs text-[#75665c]">{delivered(item)} de {item.quantity} entregues · <strong className="font-medium">faltam {max}</strong></p></div>
            </div>
            <div className="shrink-0 self-end text-center text-xs text-[#75665c] sm:self-auto">
              <label htmlFor={`${labelId}-quantity`} className="mb-1.5 block">Entregar agora</label>
              <span className="flex items-center overflow-hidden rounded-xl border border-[#d8c8ba] bg-white">
                <button type="button" aria-label={`Diminuir quantidade de ${item.productName}`} disabled={count <= 0} onClick={() => updateQuantity(item.id!, String(Math.max(0, Math.min(max, Math.floor(Number.isFinite(count) ? count : 0)) - 1)))} className="flex h-11 w-10 items-center justify-center text-[#57493f] hover:bg-[#f6f1ec] disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                <input id={`${labelId}-quantity`} aria-label={`Quantidade a entregar de ${item.productName}`} type="number" min="0" max={max} step="1" value={value} onChange={event => updateQuantity(item.id!, event.target.value)} aria-invalid={invalidQuantity || undefined} className="h-11 w-14 border-x border-[#e5dad1] bg-white text-center text-base font-semibold text-[#352f2b] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                <button type="button" aria-label={`Aumentar quantidade de ${item.productName}`} disabled={count >= max} onClick={() => updateQuantity(item.id!, String(Math.min(max, Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)) + 1)))} className="flex h-11 w-10 items-center justify-center text-[#57493f] hover:bg-[#f6f1ec] disabled:opacity-30"><Plus className="h-4 w-4" /></button>
              </span>
              {invalidQuantity && <span className="mt-1 block text-[#a44132]">Use de 0 a {max}, sem decimais.</span>}
            </div>
          </div>
        </div>;
      })}</div>
      {complete.length > 0 && <details className="text-sm text-[#75665c]"><summary className="cursor-pointer">Já entregues ({complete.length})</summary><ul className="mt-2 space-y-2">{complete.map(item => <li key={item.id} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#53613f]" />{item.productName} · {delivered(item)} de {item.quantity}</li>)}</ul></details>}
      <details className="rounded-xl border border-[#e5dad1] p-3 text-sm text-[#75665c]">
        <summary className="cursor-pointer">Entrega em {formatDate(date)} · Alterar data ou adicionar observação</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label>Data da entrega<input required type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d8c8ba] bg-white px-3 py-2.5 text-base text-[#352f2b]" /></label>
          <label>Observação (opcional)<input value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: retirado pela cliente" className="mt-1 w-full rounded-lg border border-[#d8c8ba] bg-white px-3 py-2.5 text-base text-[#352f2b]" /></label>
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e5dad1] pt-4">
        <div aria-live="polite" className="text-sm text-[#75665c]"><p className="font-semibold text-[#352f2b]">{invalid ? 'Confira as quantidades' : `${totalSelected} ${totalSelected === 1 ? 'peça nesta entrega' : 'peças nesta entrega'}`}</p>{!invalid && <p className="mt-1 text-xs">{allSelected ? 'Conclui a entrega do pedido.' : `Depois desta entrega, faltam ${totalPending - totalSelected} peças.`}</p>}</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-[#e5dad1] bg-white px-4 py-2.5 text-sm font-semibold text-[#57493f]">Cancelar</button><button disabled={busy || invalid || !selected.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#a86149] px-4 py-3 text-sm font-semibold text-white hover:bg-[#92533c] disabled:opacity-40"><Truck className="h-4 w-4" />{busy ? 'Registrando…' : 'Confirmar entrega'}</button></div>
      </div>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-[#fbeae4] p-3 text-sm text-[#a44132]">{error}</p>}
  </form>;
}
