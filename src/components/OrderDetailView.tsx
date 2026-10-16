import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Pencil, MoreHorizontal, Package, CheckCircle2 } from 'lucide-react';
import type { AtelierSettings, Customer, FinanceData, Product, Sale } from '../types';
import { creditBalance, migrateFinanceOrder, money, orderBalance, orderPaid, orderTotal, projectOrder } from '../utils/financeLedger';
import { getSaleFinancials } from '../utils/financials';
import { formatCurrency, formatDate } from '../utils/formatters';
import { formatOrderNumber } from '../utils/orderNumbers';
import { localDateString } from '../utils/localDate';
import { CustomerSearch } from './CustomerSearch';
import { InvoiceModal } from './InvoiceModal';
import { OrderItemsEditor } from './OrderItemsEditor';
import { ENTRY_LABEL, OrderWorkflowModal, type FinanceAction, type OrderActionMode } from './FinanceView';

export type OrderFocus = 'overview' | 'payment' | 'delivery' | 'production';
const panel = 'rounded-2xl border border-[#e5dad1] bg-white p-5 lg:p-6';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5dad1] bg-white px-4 py-2.5 text-sm font-semibold text-[#57493f] hover:bg-[#f6f1ec] disabled:opacity-40';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#a86149] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#92533c] disabled:opacity-50';
const input = 'mt-1 w-full rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b]';
const actionNames: Record<OrderActionMode, string> = { payment: 'Receber pagamento', delivery: 'Registrar entrega', return: 'Registrar devolução de peças', refund: 'Devolver valor', cancel: 'Cancelar pedido', history: 'Histórico' };

function OrderDataEditor({ sale, customers, paid, onSave, onCancel }: { sale: Sale; customers: Customer[]; paid: number; onSave: (sale: Sale) => Promise<boolean>; onCancel: () => void }) {
  const [draft, setDraft] = useState({ ...sale });
  const [busy, setBusy] = useState(false);
  const lockedCustomer = !!sale.customerId && paid > 0;
  return <form aria-label="Editar dados do pedido" className="space-y-4" onSubmit={async event => { event.preventDefault(); setBusy(true); try { if (await onSave(draft)) onCancel(); } finally { setBusy(false); } }}>
    <h3 className="text-lg font-semibold">Editar dados do pedido</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">{lockedCustomer ? <p className="rounded-xl bg-[#f6f1ec] p-3 text-sm">Cliente: {sale.customerName}. O vínculo é preservado porque já existem recebimentos.</p> : <CustomerSearch label="Cliente cadastrado" customers={customers} value={draft.customerId || ''} onChange={id => { const customer = customers.find(item => item.id === id); setDraft(previous => ({ ...previous, customerId: id || undefined, customerName: customer?.name || previous.customerName, customerContact: customer?.phone || previous.customerContact })); }} />}</div>
      {!draft.customerId && <label className="text-sm text-[#75665c]">Nome do cliente avulso<input className={input} value={draft.customerName || ''} onChange={e => setDraft({ ...draft, customerName: e.target.value })} /></label>}
      <label className="text-sm text-[#75665c]">Contato<input type="tel" className={input} value={draft.customerContact || ''} onChange={e => setDraft({ ...draft, customerContact: e.target.value })} /></label>
      <label className="text-sm text-[#75665c]">Data do pedido<input required type="date" className={input} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="text-sm text-[#75665c]">Prazo de entrega<input type="date" className={input} value={draft.deliveryScheduledDate || ''} onChange={e => setDraft({ ...draft, deliveryScheduledDate: e.target.value || undefined })} /></label>
      <label className="text-sm text-[#75665c]">Previsão de recebimento<input type="date" className={input} value={draft.paymentScheduledDate || ''} onChange={e => setDraft({ ...draft, paymentScheduledDate: e.target.value || undefined })} /></label>
      <label className="text-sm text-[#75665c]">Canal de venda<input className={input} value={draft.channel || ''} onChange={e => setDraft({ ...draft, channel: e.target.value })} /></label>
    </div>
    <label className="block text-sm text-[#75665c]">Combinado / observações<textarea rows={3} className={input} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
    <div className="flex flex-wrap gap-3"><button disabled={busy} className={primary}>{busy ? 'Salvando…' : 'Salvar dados do pedido'}</button><button type="button" disabled={busy} className={secondary} onClick={onCancel}>Cancelar alterações</button></div>
  </form>;
}

export function OrderDetailView({ sale, finance, products, customers, settings, onAction, onSave, onBack, focus = 'overview', onProduce }: {
  key?: string; sale: Sale; finance: FinanceData; products: Product[]; customers: Customer[]; settings: AtelierSettings;
  onAction: FinanceAction; onSave: (sale: Sale) => Promise<boolean>; onBack: () => void;
  focus?: OrderFocus; onProduce: (product?: Product) => void;
}) {
  const [action, setAction] = useState<OrderActionMode | 'items' | 'data' | null>(null);
  const [invoice, setInvoice] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const actionPanel = useRef<HTMLElement>(null);
  const normalized = migrateFinanceOrder(sale);
  const projected = projectOrder(sale, finance);
  const items = normalized.items!;
  const paid = money(orderPaid(sale, finance));
  const balance = money(orderBalance(sale, finance));
  const credit = sale.customerId ? money(creditBalance(finance, sale.customerId)) : 0;
  const cancelled = sale.commercialStatus === 'cancelled';
  const draft = sale.commercialStatus === 'draft';
  const delivered = (item: typeof items[number]) => Math.max(0, (item.deliveredQuantity || 0) - (item.returnedQuantity || 0));
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalDelivered = items.reduce((sum, item) => sum + delivered(item), 0);
  const missing = items.reduce((sum, item) => sum + Math.max(0, item.quantity - delivered(item) - (item.reservedQuantity || 0)), 0);
  const late = !cancelled && totalDelivered < quantity && !!sale.deliveryScheduledDate && sale.deliveryScheduledDate < localDateString();
  const financials = getSaleFinancials(sale, products);
  useEffect(() => { if (action) actionPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [action]);

  const choose = (next: typeof action) => { setMessage(''); setAction(next); };
  const save = async (updated: Sale) => { const ok = await onSave(updated); if (ok) setMessage('Pedido atualizado. Os recebimentos e o histórico foram preservados.'); return ok; };
  const complete = () => { setAction(null); setMessage('Registrado. Os saldos e a situação do pedido foram atualizados.'); };

  const events = [
    ...finance.entries.filter(entry => entry.saleId === sale.id).map(entry => ({ id: entry.id, date: entry.date, text: `${ENTRY_LABEL[entry.kind]} · ${formatCurrency(money(entry.amountCents))}`, detail: [entry.method, entry.note].filter(Boolean).join(' · ') })),
    ...(sale.deliveryHistory || []).map(event => ({ id: event.id, date: event.date, text: `${event.kind === 'delivery' ? 'Entrega' : 'Devolução'} · ${event.quantity} un`, detail: items.find(item => item.id === event.itemId)?.productName || 'Item anterior' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return <div className="space-y-5 pb-8 text-[#352f2b]" data-testid="order-detail">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-semibold text-[#a86149]"><ArrowLeft className="h-4 w-4" />Voltar</button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-3xl font-semibold tracking-tight">Pedido #{formatOrderNumber(sale.orderNumber)}</h2><p className="mt-1 text-sm text-[#75665c]">{sale.customerName || 'Cliente avulso'} · {sale.orderType === 'encomenda' ? 'Encomenda' : 'Pronta-entrega'} · {formatDate(sale.date)}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={cancelled} onClick={() => choose('data')} className={secondary}><Pencil className="h-4 w-4" />Editar dados</button><button type="button" onClick={() => setInvoice(true)} className={secondary}><FileText className="h-4 w-4" />Ver fatura</button></div>
    </header>
    <div className="flex flex-wrap gap-2 text-xs font-medium text-[#75665c]">
      {cancelled ? <span className="rounded-lg bg-[#fbeae4] px-3 py-2 text-[#a44132]">Pedido cancelado</span> : <>
        {draft && <span className="rounded-lg bg-white px-3 py-2">Rascunho</span>}
        <span className="rounded-lg border border-[#e5dad1] bg-white px-3 py-2">Produção · {missing > 0 ? `${missing} peças pendentes` : totalDelivered >= quantity ? 'Concluída' : 'Peças separadas'}</span>
        <span className="rounded-lg border border-[#e5dad1] bg-white px-3 py-2">Pagamento · {projected.paymentLabel}</span>
        <span className={`rounded-lg border px-3 py-2 ${late ? 'border-[#e7c5b8] bg-[#fbeae4] text-[#a44132]' : 'border-[#e5dad1] bg-white'}`}>Entrega · {totalDelivered >= quantity ? 'Concluída' : totalDelivered > 0 ? 'Parcial' : 'Pendente'}{late ? ' · Atrasada' : ''}</span>
      </>}
    </div>
    {message && <p role="status" className="rounded-xl border border-[#dce3d2] bg-[#edf1e5] px-4 py-3 text-sm text-[#53613f]">{message}</p>}
    {draft && <button type="button" className={primary} disabled={busy} onClick={async () => { setBusy(true); try { if (await onAction({ type: 'confirm_order', saleId: sale.id })) complete(); } finally { setBusy(false); } }}>Confirmar pedido</button>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]">
      <div className="min-w-0 space-y-5">
        <section hidden={action === 'items'} className={`${panel} ${focus === 'production' ? 'ring-1 ring-[#a86149]' : ''}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Itens do pedido</h3><button type="button" disabled={cancelled} onClick={() => choose('items')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[#a86149] disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Editar itens</button></div>
          <div className="divide-y divide-[#eee5dd]">{items.map(item => {
            const netDelivered = delivered(item);
            const remaining = Math.max(0, item.quantity - netDelivered - (item.reservedQuantity || 0));
            const product = products.find(product => product.id === (item.isCustom ? item.customProductId : item.productId));
            return <div key={item.id} className="py-4 first:pt-0">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold">{item.productName}</p><p className="mt-1 text-sm text-[#75665c]">{item.quantity} unidades × {formatCurrency(item.unitPrice)}</p></div><strong className="shrink-0 text-sm">{formatCurrency(item.quantity * item.unitPrice)}</strong></div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-[#edf1e5] px-2 py-1 text-[#53613f]">{netDelivered > 0 ? `${netDelivered} entregues · ` : ''}{item.reservedQuantity || 0} separadas{remaining > 0 ? ` · ${remaining} pendentes` : ''}</span>{item.costIncomplete && <span className="rounded-md bg-[#f6f1ec] px-2 py-1 text-[#75665c]">Custo em preparação</span>}</div>
              {remaining > 0 && !cancelled && !draft && <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy} className="text-xs font-semibold text-[#a86149] disabled:opacity-40" onClick={async () => { setBusy(true); try { if (await save({ ...sale })) setMessage('Reservas atualizadas conforme o estoque disponível. Confira as quantidades restantes.'); } finally { setBusy(false); } }}>Separar estoque disponível</button>{product && <button type="button" onClick={() => onProduce(product)} className="text-xs font-semibold text-[#a86149]">Organizar produção</button>}</div>}
              {item.isCustom && item.customRecipeItems?.length ? <details className="mt-3 text-xs text-[#75665c]"><summary className="cursor-pointer">Composição personalizada</summary><ul className="mt-2 space-y-1">{item.customRecipeItems.map((recipe, index) => <li key={recipe.id || index}>{recipe.name} · {recipe.quantity} {recipe.unit}</li>)}</ul></details> : null}
            </div>;
          })}</div>
          <div className="mt-3 space-y-2 border-t border-[#e5dad1] pt-4 text-sm">{!!sale.discountAmount && <div className="flex justify-between gap-3 text-[#75665c]"><span>Desconto</span><span>−{formatCurrency(sale.discountAmount)}</span></div>}{!!sale.shippingCharged && <div className="flex justify-between gap-3 text-[#75665c]"><span>Frete</span><span>{formatCurrency(sale.shippingCharged)}</span></div>}{!!sale.returnAdjustmentCents && <div className="flex justify-between gap-3 text-[#75665c]"><span>Ajuste por devolução</span><span>−{formatCurrency(money(sale.returnAdjustmentCents))}</span></div>}<div className="flex justify-between gap-3"><span>Total combinado</span><strong>{formatCurrency(money(orderTotal(sale)))}</strong></div></div>
        </section>

        {action && <section ref={actionPanel} className={`${panel} scroll-mt-24`}>
          {action === 'items' ? <OrderItemsEditor sale={sale} products={products} paid={paid} onSave={save} onCancel={() => setAction(null)} />
            : action === 'data' ? <OrderDataEditor sale={sale} customers={customers} paid={paid} onSave={save} onCancel={() => setAction(null)} />
            : <><div className="mb-4 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">{actionNames[action]}</h3><button type="button" onClick={() => setAction(null)} className="rounded-lg px-2 py-1 text-sm text-[#75665c]">Fechar</button></div><OrderWorkflowModal key={`${sale.id}:${action}`} sale={sale} finance={finance} onAction={onAction} onClose={() => setAction(null)} embedded initialMode={action} onCompleted={complete} /></>}
        </section>}

        <section hidden={action === 'data'} className={panel}><h3 className="mb-2 text-base font-semibold">Combinado com o cliente</h3><p className="whitespace-pre-wrap text-sm text-[#75665c]">{sale.notes || 'Nenhuma observação registrada.'}</p>{sale.customerContact && <p className="mt-3 text-sm text-[#75665c]">Contato: {sale.customerContact}</p>}{sale.channel && <p className="mt-1 text-xs text-[#75665c]">Canal: {sale.channel}</p>}</section>
        <details className={panel}><summary className="cursor-pointer text-sm font-semibold">Histórico do pedido</summary><div className="mt-4 space-y-4">{events.map(event => <div key={event.id} className="border-l-2 border-[#e5dad1] pl-3"><p className="text-sm">{formatDate(event.date)} · {event.text}</p>{event.detail && <p className="mt-0.5 text-xs text-[#75665c]">{event.detail}</p>}</div>)}{!sale.financialTracking && paid > 0 && <p className="text-sm text-[#75665c]">Quitação anterior preservada: {formatCurrency(paid)}. Datas das parcelas antigas não foram presumidas.</p>}<p className="text-xs text-[#75665c]">Pedido criado em {formatDate(sale.date)}.</p></div></details>
        <details className={panel}><summary className="cursor-pointer text-sm font-semibold">Custos e resultado estimado</summary><dl className="mt-4 grid grid-cols-[1fr_auto] gap-3 text-sm"><dt className="text-[#75665c]">Custo do negócio</dt><dd>{formatCurrency(financials.businessCost)}</dd><dt className="text-[#75665c]">Remuneração do trabalho</dt><dd>{formatCurrency(financials.laborRemuneration)}</dd><dt className="text-[#75665c]">Quanto fica para você</dt><dd>{formatCurrency(financials.ownerEarnings)}</dd></dl></details>
      </div>
      <aside className="min-w-0 space-y-5">
        <section className={`${panel} ${focus === 'payment' ? 'ring-1 ring-[#a86149]' : ''}`}>
          <h3 className="mb-4 text-lg font-semibold">Pagamento</h3><dl className="grid grid-cols-[1fr_auto] gap-3 text-sm"><dt className="text-[#75665c]">Total do pedido</dt><dd>{formatCurrency(money(orderTotal(sale)))}</dd><dt className="text-[#75665c]">Já quitado</dt><dd>{formatCurrency(paid)}</dd></dl><div className="mt-4 flex items-center justify-between gap-3 border-t border-[#e5dad1] pt-4"><span className="text-sm">Falta receber</span><strong className="text-2xl font-semibold" data-testid="order-balance">{formatCurrency(cancelled ? 0 : balance)}</strong></div>
          {sale.paymentScheduledDate && <p className="mt-2 text-xs text-[#75665c]">Previsão: {formatDate(sale.paymentScheduledDate)}</p>}
          {credit > 0 && <p className="mt-3 rounded-lg bg-[#edf1e5] p-2 text-sm text-[#53613f]">Crédito disponível: {formatCurrency(credit)}</p>}
          {!cancelled && !draft && balance > 0 ? <button type="button" className={`${primary} mt-4 w-full`} onClick={() => choose('payment')}>Receber pagamento</button> : !cancelled && !draft ? <p className="mt-4 flex items-center gap-2 text-sm text-[#53613f]"><CheckCircle2 className="h-4 w-4" />Pedido quitado</p> : null}
        </section>
        <section className={`${panel} ${focus === 'delivery' ? 'ring-1 ring-[#a86149]' : ''}`}><h3 className="mb-4 text-lg font-semibold">Entrega</h3><dl className="grid grid-cols-[1fr_auto] gap-3 text-sm"><dt className="text-[#75665c]">Prazo combinado</dt><dd className={late ? 'font-medium text-[#a44132]' : ''}>{sale.deliveryScheduledDate ? formatDate(sale.deliveryScheduledDate) : 'Não definido'}</dd><dt className="text-[#75665c]">Já entregue</dt><dd>{totalDelivered} de {quantity} peças</dd></dl>{late && <p className="mt-3 text-sm font-medium text-[#a44132]">Entrega atrasada</p>}{!cancelled && !draft && totalDelivered < quantity && <button type="button" className={`${secondary} mt-4 w-full`} onClick={() => choose('delivery')}><Package className="h-4 w-4" />Registrar entrega</button>}</section>
        {!cancelled && <details className={panel}><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><MoreHorizontal className="h-4 w-4" />Outras ações</summary><div className="mt-4 grid gap-2">{!draft && <><button type="button" className={secondary} onClick={() => choose('return')}>Devolução de peças</button><button type="button" className={secondary} onClick={() => choose('refund')}>Devolver valor / crédito</button></>}<button type="button" className="rounded-xl px-3 py-2 text-left text-sm text-[#a44132]" onClick={() => choose('cancel')}>Cancelar pedido</button></div></details>}
      </aside>
    </div>
    {invoice && <InvoiceModal sale={projected} settings={settings} customers={customers} products={products} onClose={() => setInvoice(false)} />}
  </div>;
}
