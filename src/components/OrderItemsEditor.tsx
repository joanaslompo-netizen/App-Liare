import React, { useRef, useState } from 'react';
import { Plus, Trash2, ArrowLeftRight } from 'lucide-react';
import type { Product, Sale, SaleItem } from '../types';
import { migrateFinanceOrder, newId, money } from '../utils/financeLedger';
import { getProductFinancialSplit, getSaleItemFinancialSplit } from '../utils/financials';
import { formatCurrency } from '../utils/formatters';
import { ProductModelPicker } from './ProductModelPicker';
import { orderQuantityFingerprint, quantityCorrections, type OrderQuantityCorrectionOptions } from '../utils/orderQuantityCorrection';
import { localDateString } from '../utils/localDate';

const field = 'w-full min-w-0 rounded-xl border border-[#e5dad1] bg-white px-3 py-2.5 text-base text-[#352f2b] focus:border-[#a86149]';
const secondary = 'rounded-xl border border-[#e5dad1] bg-white px-3 py-2 text-sm font-semibold text-[#57493f] hover:bg-[#f6f1ec] disabled:opacity-40';
const primary = 'rounded-xl bg-[#a86149] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#92533c] disabled:opacity-50';

export function OrderItemsEditor({ sale, products, paid, onSave, onCorrect, onCancel }: {
  sale: Sale; products: Product[]; paid: number;
  onSave: (sale: Sale) => Promise<boolean>; onCancel: () => void;
  onCorrect: (sale: Sale, options: OrderQuantityCorrectionOptions) => Promise<boolean>;
}) {
  const [originalSale] = useState(sale);
  const [items, setItems] = useState(() => migrateFinanceOrder(sale).items!.map(item => ({ ...item })));
  const [selected, setSelected] = useState<Product | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [discountType, setDiscountType] = useState(sale.discountType || (sale.discountAmount ? 'fixed' : 'none'));
  const [discountValue, setDiscountValue] = useState(String(sale.discountValue ?? sale.discountAmount ?? 0));
  const [shipping, setShipping] = useState(String(sale.shippingCharged || 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const correctionAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const submitting = useRef(false);
  const corrections = quantityCorrections(migrateFinanceOrder(originalSale), items);
  const restorable = corrections.reduce((sum, change) => sum + (products.some(product => product.id === change.productId) ? change.restorable : 0), 0);
  const hasDeliveries = items.some(item => (item.deliveredQuantity || 0) > 0);
  const subtotal = items.reduce((sum, item) => sum + (Number.isFinite(item.quantity * item.unitPrice) ? Math.round(item.quantity * item.unitPrice * 100) : 0), 0) / 100;
  const discount = discountType === 'percentage' ? Math.min(subtotal, subtotal * Math.max(0, Math.min(100, Number(discountValue))) / 100)
    : discountType === 'fixed' ? Math.min(subtotal, Math.max(0, Number(discountValue))) : 0;
  const total = Math.round((subtotal - discount + Math.max(0, Number(shipping))) * 100) / 100;
  const excess = Math.max(0, paid - total + money(sale.returnAdjustmentCents || 0));
  const update = (id: string, patch: Partial<SaleItem>) => setItems(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item));

  const add = () => {
    if ((!custom && !selected) || (custom && (!customName.trim() || !Number.isFinite(Number(customPrice)) || Number(customPrice) < 0))) return;
    const split = selected && !custom ? getProductFinancialSplit(selected) : null;
    const item: SaleItem = custom ? {
      id: newId(), productId: '', productName: customName.trim(), isCustom: true,
      quantity: 1, unitPrice: Number(customPrice), unitCost: 0, totalCost: 0, costIncomplete: true,
    } : {
      id: newId(), productId: selected!.id, productName: selected!.name, productImageUrl: selected!.imageUrl,
      quantity: 1, unitPrice: selected!.actualPrice ?? selected!.suggestedPrice ?? 0,
      unitCost: (split!.businessCostPerUnit + split!.laborRemunerationPerUnit),
      unitBusinessCost: split!.businessCostPerUnit, unitLaborRemuneration: split!.laborRemunerationPerUnit,
      totalCost: split!.businessCostPerUnit + split!.laborRemunerationPerUnit,
    };
    setItems(previous => replacementId ? previous.map(old => old.id === replacementId ? item : old) : [...previous, item]);
    setSelected(null); setReplacementId(null); setCustomName(''); setCustomPrice(''); setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (submitting.current) return;
    if (!items.length || items.some(item => !item.productName.trim() || !Number.isFinite(item.quantity) || item.quantity < 1 || !Number.isInteger(item.quantity) || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      setError('Mantenha pelo menos um item, com quantidade inteira e preço válido.'); return;
    }
    if (![Number(shipping), Number(discountValue), total].every(Number.isFinite) || total < 0) { setError('Confira o desconto e o frete.'); return; }
    const normalized = items.map(item => ({ ...item, subtotal: item.quantity * item.unitPrice, totalRevenue: item.quantity * item.unitPrice, totalCost: item.quantity * item.unitCost }));
    const totalCost = normalized.reduce((sum, item) => sum + item.totalCost, 0);
    const totalBusinessCost = normalized.reduce((sum, item) => sum + getSaleItemFinancialSplit(item, products).businessCostPerUnit * item.quantity, 0);
    const totalLaborRemuneration = normalized.reduce((sum, item) => sum + getSaleItemFinancialSplit(item, products).laborRemunerationPerUnit * item.quantity, 0);
    const quantity = normalized.reduce((sum, item) => sum + item.quantity, 0);
    const first = normalized[0];
    const changedDiscount = discountType !== (sale.discountType || 'none') || Number(discountValue) !== (sale.discountValue || 0);
    const updated: Sale = {
      ...sale, items: normalized, productId: first.productId, productName: normalized.length === 1 ? first.productName : `${first.productName} + ${normalized.length - 1} outro(s)`,
      productImageUrl: first.productImageUrl, quantity, unitPrice: total / quantity, unitCost: totalCost / quantity,
      subtotalRevenue: subtotal, totalRevenue: total, totalCost, totalBusinessCost, totalLaborRemuneration,
      totalProfit: total - totalBusinessCost, commercialProfit: total - totalBusinessCost - totalLaborRemuneration,
      marginPercent: total > 0 ? (total - totalBusinessCost) / total * 100 : 0,
      discountType: discountType === 'none' ? undefined : discountType as Sale['discountType'],
      discountValue: discountType === 'none' ? undefined : Number(discountValue), discountAmount: discount || undefined,
      discountCode: changedDiscount ? undefined : sale.discountCode, discountCodeId: changedDiscount ? undefined : sale.discountCodeId,
      shippingCharged: Number(shipping),
    };
    submitting.current = true; setBusy(true);
    try {
      let ok: boolean;
      if (corrections.length) {
        const fingerprint = JSON.stringify({ sale: updated, restoreStock });
        if (correctionAttempt.current?.fingerprint !== fingerprint) correctionAttempt.current = { fingerprint, id: newId() };
        ok = await onCorrect(updated, { id: correctionAttempt.current.id, date: localDateString(), restoreStock, expectedFingerprint: orderQuantityFingerprint(originalSale) });
      } else ok = await onSave(updated);
      if (ok) onCancel();
    } finally { submitting.current = false; setBusy(false); }
  };

  return <form onSubmit={submit} className="space-y-5" aria-label="Editar itens do pedido">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">Editar itens do pedido</h3><p className="mt-1 text-sm text-[#75665c]">Altere quantidades, preços ou produtos. O número do pedido e os recebimentos são preservados.</p></div></div>
    {hasDeliveries && <p className="rounded-xl bg-[#f6f1ec] p-3 text-sm text-[#75665c]">Você pode corrigir a quantidade mesmo com entrega registrada. Produto e preço continuam preservados, e a correção fica no histórico.</p>}
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
      <div className="flex gap-3"><button type="button" onClick={add} disabled={busy || (custom ? !customName.trim() || customPrice === '' : !selected)} className={secondary}><Plus className="mr-1 inline h-4 w-4" />{replacementId ? 'Substituir item' : 'Adicionar item'}</button>{replacementId && <button type="button" className="text-sm text-[#75665c] underline" onClick={() => setReplacementId(null)}>Cancelar troca</button>}</div>
    </div>
    <details className="rounded-xl border border-[#e5dad1] p-4"><summary className="cursor-pointer text-sm font-semibold">Desconto e frete</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs text-[#75665c]">Desconto<select disabled={hasDeliveries} className={`${field} mt-1`} value={discountType} onChange={e => setDiscountType(e.target.value as typeof discountType)}><option value="none">Sem desconto</option><option value="percentage">Percentual (%)</option><option value="fixed">Valor (R$)</option></select></label><label className="text-xs text-[#75665c]">Valor do desconto<input disabled={hasDeliveries || discountType === 'none'} type="number" min="0" max={discountType === 'percentage' ? 100 : undefined} step="0.01" className={`${field} mt-1`} value={discountValue} onChange={e => setDiscountValue(e.target.value)} /></label><label className="text-xs text-[#75665c]">Frete cobrado (R$)<input type="number" min="0" step="0.01" className={`${field} mt-1`} value={shipping} onChange={e => setShipping(e.target.value)} /></label></div></details>
    <div className="rounded-xl bg-[#f6f1ec] p-4"><div className="flex justify-between gap-3"><span>Novo total</span><strong>{formatCurrency(total)}</strong></div><p className="mt-2 text-sm text-[#75665c]">Já quitado: {formatCurrency(paid)} · Falta receber: {formatCurrency(Math.max(0, total - money(sale.returnAdjustmentCents || 0) - paid))}</p>{excess > 0 && <p className="mt-2 text-sm font-medium text-[#94634c]">{sale.customerId ? `A diferença de ${formatCurrency(excess)} será preservada como crédito do cliente.` : `O excedente de ${formatCurrency(excess)} continua registrado neste pedido. Vincule um cliente para transformá-lo em crédito.`}</p>}</div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={primary}>{busy ? 'Salvando…' : 'Salvar itens do pedido'}</button><button type="button" disabled={busy} className={secondary} onClick={onCancel}>Cancelar alterações</button></div>
  </form>;
}
