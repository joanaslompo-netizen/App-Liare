import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ArrowLeftRight } from 'lucide-react';
import type { Customer, DiscountCode, Product, Sale, SaleItem } from '../types';
import { cents, migrateFinanceOrder, newId, money, orderTotal } from '../utils/financeLedger';
import { getProductFinancialSplit, getSaleItemFinancialSplit } from '../utils/financials';
import { formatCurrency } from '../utils/formatters';
import { ProductModelPicker } from './ProductModelPicker';
import { orderQuantityFingerprint, quantityCorrections, type OrderQuantityCorrectionOptions } from '../utils/orderQuantityCorrection';
import { CustomerSearch } from './CustomerSearch';
import { OrderDiscountFields } from './OrderDiscountFields';
import { OrderSteps } from './OrderSteps';
import { formatOrderNumber } from '../utils/orderNumbers';
import { initialOrderDiscount, orderDiscountOptions, resolveOrderDiscount } from '../utils/orderDiscount';
import { localDateString } from '../utils/localDate';

const field = 'w-full min-w-0 rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b] focus:border-[#a86149]';
const secondary = 'rounded-xl border border-[#e5dad1] bg-white px-3 py-2 text-sm font-semibold text-[#57493f] hover:bg-[#f6f1ec] disabled:opacity-40';
const primary = 'rounded-xl bg-[#a86149] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#92533c] disabled:opacity-50';

const panel = 'min-w-0 space-y-4 rounded-2xl border border-[#e5dad1] bg-white p-4 sm:p-6';
const label = 'text-sm text-[#75665c]';
const input = `mt-1 ${field}`;

export function OrderEditor({
  sale, products, customers, discountCodes, paymentMethods, paid, customerLocked,
  initialStep, onSave, onCorrect, onClose,
}: {
  sale: Sale;
  products: Product[];
  customers: Customer[];
  discountCodes: DiscountCode[];
  paymentMethods: string[];
  paid: number;
  customerLocked: boolean;
  initialStep: number;
  onSave: (sale: Sale) => Promise<boolean>;
  onCorrect: (sale: Sale, options: OrderQuantityCorrectionOptions) => Promise<boolean>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(initialStep);
  const [originalSale] = useState(sale);
  const [details, setDetails] = useState(() => ({
    customerId: sale.customerId,
    customerName: sale.customerName,
    customerContact: sale.customerContact,
    date: sale.date,
    orderType: sale.orderType,
    deliveryScheduledDate: sale.deliveryScheduledDate,
    paymentScheduledDate: sale.paymentScheduledDate,
    paymentMethod: sale.paymentMethod,
    channel: sale.channel,
    notes: sale.notes,
  }));
  const updateDetails = (patch: Partial<typeof details>) => setDetails(current => ({ ...current, ...patch }));
  const [originalItems] = useState(() => migrateFinanceOrder(sale).items!);
  const [items, setItems] = useState(originalItems);
  const [selected, setSelected] = useState<Product | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [originalDiscount] = useState(() => initialOrderDiscount(sale));
  const [discountDraft, setDiscountDraft] = useState(originalDiscount);
  const [shipping, setShipping] = useState(String(sale.shippingCharged || 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const correctionAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const submitting = useRef(false);

  useEffect(() => { heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [step]);

  const corrections = quantityCorrections({ ...originalSale, items: originalItems }, items);
  const restorable = corrections.reduce((sum, change) => sum + (products.some(product => product.id === change.productId) ? change.restorable : 0), 0);
  const hasDeliveries = originalItems.some(item => (item.deliveredQuantity || 0) > 0);
  const pendingItem = Boolean(selected || replacementId || customName.trim() || customPrice);
  const itemsChanged = items !== originalItems;
  const shippingAmount = money(cents(Number(shipping)));
  const pricesChanged = itemsChanged || discountDraft !== originalDiscount || shippingAmount !== money(cents(originalSale.shippingCharged || 0));
  const originalSubtotal = originalSale.subtotalRevenue ?? originalSale.totalRevenue + (originalSale.discountAmount || 0) - (originalSale.shippingCharged || 0);
  const subtotal = itemsChanged
    ? money(items.reduce((sum, item) => sum + cents(item.quantity * item.unitPrice), 0))
    : originalSubtotal;
  const codes = orderDiscountOptions(discountCodes, originalSale);
  const { fields: discountFields, error: discountError } = resolveOrderDiscount(discountDraft, codes, subtotal);
  const discount = pricesChanged ? money(cents(discountFields.discountAmount || 0)) : originalSale.discountAmount || 0;
  const total = pricesChanged ? money(cents(subtotal) - cents(discount) + cents(shippingAmount)) : originalSale.totalRevenue;
  const amountDue = money(orderTotal({ ...sale, totalRevenue: total }));
  const excess = Math.max(0, paid - amountDue);
  const paymentOptions = [...new Set(['offline', 'site', ...paymentMethods, ...(details.paymentMethod ? [details.paymentMethod] : [])])];

  const update = (id: string, patch: Partial<SaleItem>) => setItems(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item));
  const clearItem = () => {
    setSelected(null);
    setReplacementId(null);
    setCustomName('');
    setCustomPrice('');
    setError('');
  };

  const add = () => {
    if ((!custom && !selected) || (custom && (!customName.trim() || !customPrice || !Number.isFinite(Number(customPrice)) || Number(customPrice) < 0))) return;
    const split = selected && !custom ? getProductFinancialSplit(selected) : null;
    const item: SaleItem = custom ? {
      id: newId(), productId: '', productName: customName.trim(), isCustom: true,
      quantity: 1, unitPrice: Number(customPrice), unitCost: 0, totalCost: 0, costIncomplete: true,
    } : {
      id: newId(), productId: selected!.id, productName: selected!.name, productImageUrl: selected!.imageUrl,
      quantity: 1, unitPrice: selected!.actualPrice ?? selected!.suggestedPrice ?? 0,
      unitCost: split!.businessCostPerUnit + split!.laborRemunerationPerUnit,
      unitBusinessCost: split!.businessCostPerUnit, unitLaborRemuneration: split!.laborRemunerationPerUnit,
      totalCost: split!.businessCostPerUnit + split!.laborRemunerationPerUnit,
    };
    setItems(previous => replacementId ? previous.map(old => old.id === replacementId ? item : old) : [...previous, item]);
    clearItem();
  };

  const goToStep = (next: number) => {
    setError('');
    if (next > 0 && !details.date) {
      setStep(0);
      setError('Informe a data do pedido.');
      return false;
    }
    if (next === 2 && pendingItem) {
      setStep(1);
      setError('Adicione ou limpe o item em preenchimento antes de conferir.');
      return false;
    }
    if (next === 2 && (!items.length || items.some(item => !item.productName.trim() ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0))) {
      setStep(1);
      setError('Mantenha pelo menos um item, com quantidade inteira e preço válido.');
      return false;
    }
    setStep(next);
    return true;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    if (step !== 2) { goToStep(step + 1); return; }
    if (!goToStep(2)) return;
    if (discountError || !Number.isFinite(Number(shipping)) || Number(shipping) < 0 || event.currentTarget.querySelector('#edit-order-review :invalid')) {
      setError(discountError || 'Confira o valor do desconto e do frete.');
      return;
    }
    const updated: Sale = { ...sale, ...details };
    if (pricesChanged) {
      const normalized = itemsChanged ? items.map(item => ({
        ...item, subtotal: item.quantity * item.unitPrice, totalRevenue: item.quantity * item.unitPrice,
        totalCost: item.quantity * item.unitCost,
      })) : items;
      const totalCost = normalized.reduce((sum, item) => sum + item.totalCost, 0);
      const totalBusinessCost = normalized.reduce((sum, item) => sum + getSaleItemFinancialSplit(item, products).businessCostPerUnit * item.quantity, 0);
      const totalLaborRemuneration = normalized.reduce((sum, item) => sum + getSaleItemFinancialSplit(item, products).laborRemunerationPerUnit * item.quantity, 0);
      const quantity = normalized.reduce((sum, item) => sum + item.quantity, 0);
      const first = normalized[0];
      Object.assign(updated, {
        ...discountFields, discountAmount: discount || undefined, shippingCharged: shippingAmount,
        items: normalized, productId: first.productId,
        productName: normalized.length === 1 ? first.productName : `${first.productName} + ${normalized.length - 1} outro(s)`,
        productImageUrl: first.productImageUrl, quantity, unitPrice: total / quantity, unitCost: totalCost / quantity,
        subtotalRevenue: subtotal, totalRevenue: total, totalCost, totalBusinessCost, totalLaborRemuneration,
        totalProfit: total - totalBusinessCost, commercialProfit: total - totalBusinessCost - totalLaborRemuneration,
        marginPercent: total > 0 ? (total - totalBusinessCost) / total * 100 : 0,
      });
    }
    submitting.current = true;
    setBusy(true);
    try {
      let ok: boolean;
      if (corrections.length) {
        const fingerprint = JSON.stringify({ sale: updated, restoreStock });
        if (correctionAttempt.current?.fingerprint !== fingerprint) correctionAttempt.current = { fingerprint, id: newId() };
        ok = await onCorrect(updated, {
          id: correctionAttempt.current.id, date: localDateString(), restoreStock,
          expectedFingerprint: orderQuantityFingerprint(originalSale),
        });
      } else ok = await onSave(updated);
      if (ok) onClose();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="liare-edit-order space-y-5 text-[#352f2b]" aria-labelledby="edit-order-title">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} id="edit-order-title" className="scroll-mt-24 text-2xl font-semibold sm:text-3xl">Editar pedido #{formatOrderNumber(sale.orderNumber)}</h2>
        <button type="button" disabled={busy} className={secondary} onClick={onClose}>Cancelar alterações</button>
      </header>
      <OrderSteps step={step} onSelect={goToStep} disabled={busy} />
      <form aria-label="Editar pedido" noValidate onSubmit={submit} className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <section hidden={step !== 0} aria-label="Cliente e entrega" className={panel}>
            <h3 className="text-lg font-semibold">Cliente e entrega</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                {customerLocked ? (
                  <p className="rounded-xl bg-[#f6f1ec] p-3 text-sm">Cliente: {details.customerName || customers.find(customer => customer.id === details.customerId)?.name}</p>
                ) : (
                  <CustomerSearch label="Cliente cadastrado" customers={customers} value={details.customerId || ''} onChange={id => {
                    const customer = customers.find(item => item.id === id);
                    updateDetails({ customerId: id || undefined, customerName: customer?.name || details.customerName, customerContact: customer?.phone || details.customerContact });
                  }} />
                )}
              </div>
              {!details.customerId && <label className={label}>Nome do cliente avulso<input className={input} value={details.customerName || ''} onChange={e => updateDetails({ customerName: e.target.value })} /></label>}
              <label className={label}>Contato<input type="tel" className={input} value={details.customerContact || ''} onChange={e => updateDetails({ customerContact: e.target.value })} /></label>
              <label className={label}>Data do pedido<input required type="date" className={input} value={details.date} onChange={e => updateDetails({ date: e.target.value })} /></label>
              <label className={label}>Tipo do pedido
                <select className={input} value={details.orderType || ''} onChange={e => updateDetails({ orderType: e.target.value as Sale['orderType'] || undefined })}>
                  <option value="">A combinar</option>
                  <option value="pronta_entrega">Pronta entrega</option>
                  <option value="encomenda">Encomenda</option>
                </select>
              </label>
              <label className={label}>Prazo de entrega<input type="date" className={input} value={details.deliveryScheduledDate || ''} onChange={e => updateDetails({ deliveryScheduledDate: e.target.value || undefined })} /></label>
              <label className={label}>Canal de venda<input className={input} value={details.channel || ''} onChange={e => updateDetails({ channel: e.target.value })} /></label>
            </div>
          </section>
          <section hidden={step !== 1} aria-label="Produtos do pedido" className={panel}>
            <h3 className="text-lg font-semibold">Produtos do pedido</h3>
            {hasDeliveries && <p className="rounded-xl bg-[#f6f1ec] p-3 text-sm text-[#75665c]">Para corrigir uma entrega, ajuste a quantidade. As peças já entregues mantêm o produto e o preço unitário.</p>}
            <div className="space-y-3">{items.map(item => {
              const delivered = (item.deliveredQuantity || 0) > 0;
              return <div key={item.id} className="rounded-xl border border-[#e5dad1] p-4" data-order-item={item.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">{item.isCustom && !delivered ? <label className="block text-xs text-[#75665c]">Nome do personalizado<input aria-label={`Nome de ${item.productName}`} className={`${field} mt-1`} value={item.productName} onChange={e => update(item.id!, { productName: e.target.value })} /></label> : <p className="text-sm font-semibold">{item.productName}</p>}{item.isCustom && <span className="text-xs text-[#75665c]">Personalizado · {item.customRecipeItems?.length ? 'composição cadastrada' : 'composição a definir'}</span>}</div>
                  <button type="button" disabled={delivered || busy} title={delivered ? 'Item com histórico de entrega' : 'Remover item'} aria-label={`Remover ${item.productName}`} onClick={() => { setItems(previous => previous.filter(old => old.id !== item.id)); if (replacementId === item.id) setReplacementId(null); }} className="rounded-lg p-2 text-[#956350] hover:bg-[#f6f1ec] disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="text-xs text-[#75665c]">Quantidade<input aria-label={`Quantidade de ${item.productName}`} required type="number" min="1" step="1" className={`${field} mt-1`} value={Number.isFinite(item.quantity) ? item.quantity : ''} onChange={e => update(item.id!, { quantity: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
                  <label className="text-xs text-[#75665c]">Preço unitário (R$)<input aria-label={`Preço de ${item.productName}`} required type="number" min="0" step="0.01" disabled={delivered} className={`${field} mt-1 disabled:bg-[#f6f1ec]`} value={Number.isFinite(item.unitPrice) ? item.unitPrice : ''} onChange={e => update(item.id!, { unitPrice: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
                  <strong className="pb-3 text-sm">{formatCurrency(Number.isFinite(item.quantity * item.unitPrice) ? item.quantity * item.unitPrice : 0)}</strong>
                </div>
                {!delivered && <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#a86149]" onClick={() => { setReplacementId(item.id!); setSelected(null); setCustom(false); }}><ArrowLeftRight className="h-3.5 w-3.5" />Trocar produto</button>}
              </div>;
            })}</div>
            {corrections.length > 0 && <section aria-label="Correção das entregas registradas" className="space-y-3 rounded-xl border border-[#d8c8ba] bg-[#faf6f1] p-4 text-sm text-[#57493f]">
              <p className="font-semibold">Ao salvar, estas entregas também serão corrigidas:</p>
              <ul className="space-y-1">{corrections.map(change => <li key={change.itemId}>{change.productName}: {change.deliveredBefore} → {change.deliveredAfter} peças entregues.</li>)}</ul>
              {restorable > 0 ? <label className="flex items-start gap-2"><input aria-label="Repor diferença no estoque" type="checkbox" checked={restoreStock} onChange={event => setRestoreStock(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#a86149]" />Repor {restorable} {restorable === 1 ? 'peça no estoque de produtos prontos' : 'peças no estoque de produtos prontos'}</label> : <p className="text-xs">Sem baixa física identificada: esta correção não adicionará peças ao estoque.</p>}
              <p className="text-xs">O registro anterior fica preservado no histórico da correção.</p>
            </section>}
            <div className="space-y-3 rounded-xl bg-[#f6f1ec] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{replacementId ? 'Escolha o produto substituto' : 'Adicionar outro item'}</h4><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={custom} onChange={e => { setCustom(e.target.checked); setSelected(null); }} />Personalizado</label></div>
              {custom ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#75665c]">Nome<input className={`${field} mt-1`} value={customName} onChange={e => setCustomName(e.target.value)} /></label><label className="text-xs text-[#75665c]">Preço unitário (R$)<input type="number" min="0" step="0.01" className={`${field} mt-1`} value={customPrice} onChange={e => setCustomPrice(e.target.value)} /></label></div>
                : <ProductModelPicker id="detail-product-search" products={products} selectedProductId={selected?.id || ''} onSelectProduct={setSelected} />}
              <div className="flex gap-3"><button type="button" onClick={add} disabled={busy || (custom ? !customName.trim() || customPrice === '' : !selected)} className={secondary}><Plus className="mr-1 inline h-4 w-4" />{replacementId ? 'Substituir item' : 'Adicionar item'}</button>{pendingItem && <button type="button" className="text-sm text-[#75665c] underline" onClick={clearItem}>Limpar seleção</button>}</div>
            </div>

          </section>
          <section hidden={step !== 2} id="edit-order-review" aria-label="Conferir e salvar" className={panel}>
            <h3 className="text-lg font-semibold">Conferir e salvar</h3>
            <OrderDiscountFields draft={discountDraft} codes={codes} amount={discount} onChange={value => { setDiscountDraft(value); setError(''); }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Frete cobrado (R$)<input aria-label="Frete cobrado" type="number" min="0" step="0.01" className={input} value={shipping} onChange={e => setShipping(e.target.value)} /></label>
              <label className={label}>Previsão de recebimento<input type="date" className={input} value={details.paymentScheduledDate || ''} onChange={e => updateDetails({ paymentScheduledDate: e.target.value || undefined })} /></label>
              <label className={label}>Forma de pagamento combinada
                <select className={input} value={details.paymentMethod || ''} onChange={e => updateDetails({ paymentMethod: e.target.value || undefined })}>
                  <option value="">A combinar</option>
                  {paymentOptions.map(method => <option key={method} value={method}>{method === 'offline' ? 'Venda direta' : method === 'site' ? 'Site' : method}</option>)}
                </select>
              </label>
            </div>
            <label className={`block ${label}`}>Combinado / observações<textarea rows={3} className={input} value={details.notes || ''} onChange={e => updateDetails({ notes: e.target.value })} /></label>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dad1] bg-white p-4">
            {step > 0 && <button type="button" disabled={busy} className={secondary} onClick={() => goToStep(step - 1)}>Voltar</button>}
            {step === 2 ? (
              <button key="save" type="submit" disabled={busy} className={`ml-auto ${primary}`}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
            ) : (
              <button key="next" type="button" className={`ml-auto ${primary}`} onClick={event => { event.preventDefault(); goToStep(step + 1); }}>{step === 0 ? 'Continuar para produtos' : 'Conferir pedido'}</button>
            )}
          </div>
        </div>
        <aside aria-label="Resumo do pedido em edição" className={`${panel} lg:sticky lg:top-6`}>
          <h3 className="text-lg font-semibold">Resumo do pedido</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-3 text-sm">
            <dt>Produtos</dt><dd>{formatCurrency(subtotal)}</dd>
            <dt className="[overflow-wrap:anywhere]">Desconto{discountFields.discountCode ? ` · ${discountFields.discountCode}` : ''}</dt><dd>−{formatCurrency(discount)}</dd>
            <dt>Frete</dt><dd>{formatCurrency(shippingAmount)}</dd>
            {!!sale.returnAdjustmentCents && <><dt>Devoluções compensadas</dt><dd>−{formatCurrency(money(sale.returnAdjustmentCents))}</dd></>}
            <dt className="font-semibold">Novo total</dt><dd className="font-semibold">{formatCurrency(amountDue)}</dd>
            <dt>Já quitado</dt><dd>{formatCurrency(paid)}</dd>
            <dt>Falta receber</dt><dd>{formatCurrency(Math.max(0, amountDue - paid))}</dd>
          </dl>
          {excess > 0 && (
            <p className="rounded-xl bg-[#f6f1ec] p-3 text-sm text-[#80503c]">
              {details.customerId
                ? `Ao salvar, ${formatCurrency(excess)} vira crédito do cliente.`
                : `O excedente de ${formatCurrency(excess)} fica registrado no pedido.`}
            </p>
          )}
        </aside>
      </form>
    </section>
  );
}
