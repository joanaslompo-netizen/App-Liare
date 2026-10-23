import type { CreditCard, Customer, DeliveryEvent, FinancialAccount, FinanceBill, FinanceData, FinanceEntry, Material, Product, Production, Purchase, PurchasePayment, Sale, SaleItem, StockMovement } from '../types';
import { automaticStockMovements, planAutomaticConsumption, validateAutomaticManufacturing } from './automaticManufacturing';
import { cardFirstDueDate, financialAccounts, monthlyDueDate } from './bankAccounts';
import { getUnitConversionMultiplier } from './formatters';
import { cascadeRecalculateAllProducts } from './storage';
import { getProductFinancialSplit } from './financials';
import { localDateString } from './localDate';

export const emptyFinance = (): FinanceData => ({ version: 1, entries: [], bills: [] });
export const cents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);
export const money = (value: number) => value / 100;
export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
export const orderItems = (sale: Sale): SaleItem[] => sale.items?.length ? sale.items : [{ id: `legacy_${sale.id}`, productId: sale.productId, productName: sale.productName, quantity: sale.quantity, unitPrice: sale.unitPrice, unitCost: sale.quantity ? sale.totalCost / sale.quantity : sale.unitCost, totalCost: sale.totalCost }];
export const isActiveOrder = (sale: Sale) => sale.commercialStatus !== 'cancelled' && sale.commercialStatus !== 'draft';
export const legacyPaid = (sale: Sale) => sale.legacyPaidCents ?? (sale.financialTracking ? 0 : Math.max(0, cents(sale.amountPaid ?? (sale.paymentStatus === 'pago' ? sale.totalRevenue : 0))));
export function migrateFinanceOrder(sale: Sale): Sale {
  return { ...sale, financialTracking: true, legacyDeliveryDate: sale.legacyDeliveryDate || (!sale.deliveryHistory?.length && sale.deliveryStatus==='entregue' ? sale.deliveryActualDate || sale.date : undefined), legacyPaidCents: legacyPaid(sale), items: orderItems(sale).map((it, i) => ({ ...it, id: it.id || `${sale.id}_line_${i}`, deliveredQuantity: it.deliveredQuantity ?? it.stockConsumedQuantity ?? (sale.deliveryStatus === 'entregue' ? it.quantity : 0) })) };
}
export function activeEntries(finance: FinanceData): FinanceEntry[] {
  const reversed = new Set(finance.entries.filter(e => e.kind === 'reversal').map(e => e.referenceId));
  return finance.entries.filter(e => e.kind !== 'reversal' && !reversed.has(e.id));
}
export function creditEffect(e: FinanceEntry): number {
  if (e.kind === 'receipt') return e.amountCents - (e.allocatedCents || 0);
  if (['credit_grant', 'credit_opening', 'credit_release'].includes(e.kind)) return e.amountCents;
  if (['credit_use', 'credit_refund'].includes(e.kind)) return -e.amountCents;
  return 0;
}
export const creditBalance = (finance: FinanceData, customerId: string) => activeEntries(finance).filter(e => e.customerId === customerId).reduce((sum, e) => sum + creditEffect(e), 0);
export const grantedCreditBalance = (finance: FinanceData, customerId: string) => activeEntries(finance).filter(e=>e.customerId===customerId).reduce((sum,e)=>sum+(e.kind==='credit_grant'?e.amountCents:e.kind==='credit_release'?e.concessionCents||0:e.kind==='credit_use'?-(e.concessionCents||0):0),0);
export function validateFinanceData(finance: FinanceData): void {
  for(const customerId of new Set(finance.entries.map(e=>e.customerId).filter(Boolean))) {
    if(creditBalance(finance,customerId!)<0)throw new Error('Há uso de crédito conflitante entre aparelhos. O saldo da nuvem foi preservado; confira os movimentos pendentes.');
  }
}
export function orderPaid(sale: Sale, finance: FinanceData): number {
  return legacyPaid(sale) + activeEntries(finance).filter(e => e.saleId === sale.id).reduce((sum, e) => sum + (e.kind === 'receipt' ? e.allocatedCents || 0 : e.kind === 'credit_use' ? e.amountCents : ['refund', 'credit_release'].includes(e.kind) ? -e.amountCents : 0), 0);
}
export const orderTotal = (sale: Sale) => Math.max(0,cents(sale.totalRevenue)-(sale.returnAdjustmentCents||0));
export const orderBalance = (sale: Sale, finance: FinanceData) => Math.max(0, orderTotal(sale) - orderPaid(sale, finance));
export function projectOrder(sale: Sale, finance: FinanceData): Sale {
  const paid = orderPaid(sale, finance), due = orderBalance(sale, finance);
  return { ...sale, amountPaid: money(paid), paymentStatus: due === 0 ? 'pago' : 'pendente_pagamento', paymentLabel: sale.commercialStatus === 'cancelled' ? 'Cancelado' : due === 0 ? 'Quitado' : paid > 0 ? 'Parcialmente pago' : 'Não pago' };
}
export function cashEffect(entry: FinanceEntry, finance: FinanceData): number {
  if (entry.kind === 'reversal') {
    const original = finance.entries.find(e => e.id === entry.referenceId);
    return original ? -cashEffect(original, finance) : 0;
  }
  if (['receipt', 'capital', 'cash_opening', 'settlement'].includes(entry.kind)) return entry.pendingSettlement ? 0 : entry.amountCents - (entry.feeCents || 0);
  if (['credit_refund', 'refund', 'expense_payment', 'purchase_payment', 'withdrawal'].includes(entry.kind)) return -entry.amountCents;
  return 0;
}
export function accountCashEffect(entry: FinanceEntry, finance: FinanceData, account = 'all'): number {
  if (entry.kind === 'reversal') {
    const original = finance.entries.find(item => item.id === entry.referenceId);
    return original ? -accountCashEffect(original, finance, account) : 0;
  }
  if (entry.kind === 'transfer') return account === 'all' ? 0 : entry.account === account ? -entry.amountCents : entry.targetAccount === account ? entry.amountCents : 0;
  return account !== 'all' && entry.account !== account ? 0 : cashEffect(entry, finance);
}
export const accountBalance = (finance: FinanceData, account: string, until = localDateString()) => finance.entries.filter(entry => entry.date <= until).reduce((sum, entry) => sum + accountCashEffect(entry, finance, account), 0);
export const billBalance = (bill: FinanceBill, finance: FinanceData) => Math.max(0, bill.amountCents - activeEntries(finance).filter(e => e.billId === bill.id && ['expense_payment', 'purchase_payment'].includes(e.kind)).reduce((s, e) => s + e.amountCents, 0));

export interface LedgerWorkspace { sales: Sale[]; products: Product[]; productions?: Production[]; customers?: Customer[]; materials?: Material[]; purchases?: Purchase[]; finance?: FinanceData; stockMovements?: StockMovement[]; settings: { lastOrderNumber?: number }; }
export type FinanceCommand =
  | { type: 'save_account'; account: FinancialAccount; openingBalanceCents?: number; date: string }
  | { type: 'save_card'; card: CreditCard }
  | { type: 'pay_card_invoice'; cardId: string; month: string; billIds: string[]; amountCents: number; account: string; date: string; id: string }
  | { type: 'entry'; entry: FinanceEntry }
  | { type: 'bill'; bill: FinanceBill }
  | { type: 'cancel_bill'; billId: string; date: string }
  | { type: 'save_order'; sale: Sale; initialPaymentCents?: number; initialMethod?: string }
  | { type: 'deliver'; saleId: string; itemId: string; quantity: number; date: string; id: string; kind: 'delivery' | 'return'; restock?: boolean; note?: string }
  | { type: 'cancel_order'; saleId: string; date: string; id: string; destination: 'credit' | 'refund' }
  | { type: 'confirm_order'; saleId: string }
  | { type: 'refund_order'; saleId: string; amountCents: number; destination: 'credit'|'refund'; date: string; id: string; account: string }
  | ({ type: 'purchase'; purchase: Purchase; updateStock: boolean } & PurchasePayment)
  | { type: 'cancel_purchase'; purchaseId: string; date: string }
  | { type: 'stock_adjust'; materialId: string; delta: number; date: string; id: string };

const fail = (message: string): never => { throw new Error(message); };
const requireDate = (date: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+"T12:00:00Z")) || new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date) fail('Informe uma data válida.'); };
export function applyFinanceCommand<T extends LedgerWorkspace>(source: T, command: FinanceCommand): T {
  let next: T = { ...source, finance: { ...(source.finance || emptyFinance()), entries: [...(source.finance?.entries || [])], bills: [...(source.finance?.bills || [])] }, sales: [...source.sales], products: [...source.products], stockMovements: [...(source.stockMovements || [])] };
  const finance = next.finance!;
  const save = (sale: Sale) => { next.sales = next.sales.some(s => s.id === sale.id) ? next.sales.map(s => s.id === sale.id ? sale : s) : [sale, ...next.sales]; };
  const findOrder = (id: string) => next.sales.find(s => s.id === id) || fail('Pedido não encontrado.');
  const entry = (e: FinanceEntry) => {
    if (finance.entries.some(x => x.id === e.id)) return;
    requireDate(e.date);
    if (!Number.isSafeInteger(e.amountCents) || (e.kind === 'cash_opening' ? e.amountCents === 0 : e.amountCents <= 0)) fail('Informe um valor válido.');
    if (e.kind === 'transfer' && (!e.account || !e.targetAccount || e.account === e.targetAccount)) fail('Selecione contas diferentes para a transferência.');
    if ((e.feeCents || 0) < 0 || (e.feeCents || 0) > Math.max(0, e.amountCents)) fail('A taxa deve ficar entre zero e o valor recebido.');
    if (e.customerId && !next.customers?.some(c => c.id === e.customerId)) fail('Selecione um cliente cadastrado.');
    if (['credit_use','credit_refund','credit_grant','credit_opening','credit_release'].includes(e.kind) && !e.customerId) fail('Selecione o cliente do crédito.');
    if (['credit_use','credit_refund'].includes(e.kind) && creditBalance(finance, e.customerId!) < e.amountCents) fail('O cliente não tem crédito suficiente.');
    if(e.kind==='credit_refund' && creditBalance(finance,e.customerId!)-grantedCreditBalance(finance,e.customerId!) < e.amountCents) fail('Crédito de cortesia não pode ser convertido em dinheiro.');
    if (e.kind === 'receipt' && e.saleId) {
      const sale = migrateFinanceOrder(findOrder(e.saleId));
      if (!isActiveOrder(sale)) fail('Confirme o pedido antes de receber.');
      e = { ...e, allocatedCents: Math.min(e.amountCents, orderBalance(sale, finance)), customerId: sale.customerId };
      if (e.amountCents > (e.allocatedCents || 0) && !e.customerId) fail('Cadastre ou selecione o cliente para guardar o excedente como crédito.');
      save(sale);
    } else if (e.kind === 'receipt') {
      if (!e.customerId) fail('Selecione o cliente do valor antecipado.');
      e = { ...e, allocatedCents: 0 };
    }
    if (e.kind === 'credit_use') {
      const sale = migrateFinanceOrder(findOrder(e.saleId || ''));
      if (!isActiveOrder(sale)) fail('Este pedido não aceita pagamentos.');
      if (sale.customerId !== e.customerId) fail('O crédito pertence a outro cliente.');
      if (e.amountCents > orderBalance(sale, finance)) fail('O crédito usado não pode ultrapassar o saldo do pedido.');
      e={...e,concessionCents:Math.max(0,e.amountCents-(creditBalance(finance,e.customerId!)-grantedCreditBalance(finance,e.customerId!)))};
      save(sale);
    }
    if (e.kind === 'refund') {
      const sale = migrateFinanceOrder(findOrder(e.saleId || ''));
      if (e.amountCents > orderPaid(sale, finance)) fail('O valor supera o pagamento ainda vinculado ao pedido.');
      const creditPaid=activeEntries(finance).filter(x=>x.saleId===sale.id).reduce((n,x)=>n+(x.kind==='credit_use'?x.amountCents:x.kind==='credit_release'?-(x.restoredCreditCents||0):0),0);
      if(e.amountCents>orderPaid(sale,finance)-creditPaid)fail('Parte do pedido foi paga com crédito. Devolva essa parte como crédito.');
      save(sale);
    }
    if(e.kind==='credit_release' && e.saleId) {
      const sale=migrateFinanceOrder(findOrder(e.saleId));
      if(e.amountCents>orderPaid(sale,finance))fail('O crédito devolvido supera o saldo quitado do pedido.');
      const used=activeEntries(finance).filter(x=>x.saleId===sale.id);
      const creditRemaining=Math.max(0,used.reduce((n,x)=>n+(x.kind==='credit_use'?x.amountCents:x.kind==='credit_release'?-(x.restoredCreditCents||0):0),0));
      const grantRemaining=Math.max(0,used.reduce((n,x)=>n+(x.kind==='credit_use'?x.concessionCents||0:x.kind==='credit_release'?-(x.concessionCents||0):0),0));
      e={...e,restoredCreditCents:Math.min(e.amountCents,creditRemaining),concessionCents:Math.min(e.amountCents,grantRemaining)};
      save(sale);
    }
    if (e.kind === 'settlement') {
      const original = activeEntries(finance).find(x => x.id === e.referenceId && x.pendingSettlement);
      if (!original || activeEntries(finance).some(x => x.kind === 'settlement' && x.referenceId === e.referenceId)) fail('Este recebimento já foi liquidado ou não está pendente.');
      e = { ...e, amountCents: original.amountCents, feeCents: e.feeCents ?? original.feeCents };
    }
    if (e.kind === 'expense_payment' || e.kind === 'purchase_payment') {
      const bill = finance.bills.find(b => b.id === e.billId);
      if (!bill || bill.cancelledAt) fail('Conta a pagar não encontrada.');
      if (e.amountCents > billBalance(bill, finance)) fail('O pagamento supera o saldo da conta.');
    }
    if (e.kind === 'reversal') {
      const original = activeEntries(finance).find(x => x.id === e.referenceId);
      if (!original) fail('Movimento já estornado ou não encontrado.');
      if (original.kind === 'receipt' && original.saleId && !isActiveOrder(findOrder(original.saleId))) fail('O pedido foi cancelado. Use o histórico de crédito ou devolução.');
      if (original.saleId && findOrder(original.saleId).commercialStatus==='cancelled') fail('Movimento de pedido cancelado: preserve o destino já registrado.');
      if (original.pendingSettlement && activeEntries(finance).some(x => x.kind === 'settlement' && x.referenceId === original.id)) fail('Estorne primeiro a liquidação.');
      e = { ...e, amountCents: original.amountCents, customerId: original.customerId, saleId: original.saleId };
      finance.entries.push(e);
      if (original.customerId && creditBalance(finance, original.customerId) < 0) fail('Esse crédito já foi usado. Desfaça o uso antes de estornar a origem.');
      return;
    }
    finance.entries.push(e);
  };

  if (command.type === 'entry') entry({ ...command.entry });
  if (command.type === 'save_account') {
    if (command.openingBalanceCents !== undefined && !Number.isSafeInteger(command.openingBalanceCents)) fail('Informe um saldo inicial válido.');
    const account = { ...command.account, name: command.account.name.trim() };
    if (!account.id || !account.name) fail('Informe o nome da conta.');
    if (financialAccounts(finance).some(item => item.id !== account.id && item.name.toLocaleLowerCase('pt-BR') === account.name.toLocaleLowerCase('pt-BR'))) fail('Já existe uma conta com esse nome.');
    const registered = finance.accounts?.some(item => item.id === account.id);
    const hasMovements = finance.entries.some(item => item.account === account.id || item.targetAccount === account.id);
    if (command.openingBalanceCents && !registered && !hasMovements) entry(makeEntry('cash_opening', money(command.openingBalanceCents), { id: `opening_${account.id}`, account: account.id, date: command.date, note: 'Saldo inicial da conta' }));
    finance.accounts = [...(finance.accounts || []).filter(item => item.id !== account.id), account];
  }
  if (command.type === 'save_card') {
    const card = { ...command.card, name: command.card.name.trim() };
    if (!card.id || !card.name) fail('Informe o nome do cartão.');
    if (![card.closingDay, card.dueDay].every(day => Number.isInteger(day) && day >= 1 && day <= 31) || card.closingDay === card.dueDay) fail('Informe dias diferentes de fechamento e vencimento, entre 1 e 31.');
    if (!financialAccounts(finance).some(account => account.id === card.paymentAccount)) fail('Selecione a conta de pagamento.');
    if (finance.cards?.some(item => item.id !== card.id && item.name.toLocaleLowerCase('pt-BR') === card.name.toLocaleLowerCase('pt-BR'))) fail('Já existe um cartão com esse nome.');
    finance.cards = [...(finance.cards || []).filter(item => item.id !== card.id), card];
  }
  if (command.type === 'pay_card_invoice') {
    if (!finance.cards?.some(card => card.id === command.cardId)) fail('Cartão não encontrado.');
    if (!command.billIds.length || new Set(command.billIds).size !== command.billIds.length) fail('Selecione as parcelas da fatura.');
    if (command.billIds.every(id => finance.entries.some(item => item.id === `cardpay_${command.id}_${id}`))) return source;
    requireDate(command.date);
    if (!financialAccounts(finance).some(account => account.id === command.account)) fail('Selecione a conta de saída.');
    const bills = command.billIds.map(id => finance.bills.find(bill => bill.id === id) || fail('Uma parcela da fatura não foi encontrada.'));
    if (bills.some(bill => bill.cancelledAt || bill.cardId !== command.cardId || bill.dueDate.slice(0, 7) !== command.month || billBalance(bill, finance) <= 0)) fail('A fatura mudou. Confira os valores antes de pagar.');
    if (bills.reduce((sum, bill) => sum + billBalance(bill, finance), 0) !== command.amountCents) fail('A fatura mudou. Confira os valores antes de pagar.');
    for (const bill of bills) entry(makeEntry(bill.purchaseId ? 'purchase_payment' : 'expense_payment', money(billBalance(bill, finance)), { id: `cardpay_${command.id}_${bill.id}`, billId: bill.id, purchaseId: bill.purchaseId, account: command.account, date: command.date, method: 'Pagamento de fatura', note: bill.name }));
  }
  if (command.type === 'purchase') {
    if (next.purchases?.some(p => p.id === command.purchase.id)) return source;
    const purchase = command.purchase;
    requireDate(purchase.date);
    const card = command.cardId !== undefined ? finance.cards?.find(item => item.id === command.cardId) || fail('Selecione um cartão cadastrado.') : undefined;
    const installmentCount = command.installments ?? 1;
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36 || cents(purchase.totalAmount) < installmentCount) fail('Informe de 1 a 36 parcelas, com valor mínimo de um centavo por parcela.');
    if (command.paidNow && (card || installmentCount > 1)) fail('Uma compra parcelada ou no cartão deve ficar a pagar.');
    const firstDue = command.paidNow ? purchase.date : command.dueDate || (card ? cardFirstDueDate(purchase.date, card) : purchase.date);
    requireDate(firstDue);
    if (!command.paidNow && firstDue < purchase.date) fail('O primeiro vencimento não pode ser anterior à compra.');
    const shipping = allocateCents(cents(purchase.shippingCost), purchase.items.map(it => cents(it.totalPrice)));
    if (purchase.totalAmount <= 0 || purchase.items.some(it => it.quantity <= 0 || it.totalPrice < 0)) fail('Confira as quantidades e valores da compra.');
    const items = purchase.items.map((it,i) => {
      const mat = next.materials?.find(m => m.id === it.materialId) || fail('Material da compra não encontrado.');
      const ratio = getUnitConversionMultiplier(it.unit || mat.packageUnit, mat.unit);
      const baseQuantity = it.quantity * (mat.packageQuantity || 1) * ratio;
      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) fail('Quantidade convertida inválida.');
      return { ...it, baseQuantity, landedCost: it.totalPrice + money(shipping[i]) };
    });
    next.purchases = [{ ...purchase, items, stockApplied: command.updateStock, paymentPlan: { paidNow: command.paidNow, dueDate: firstDue, account: command.account, ...(card ? { cardId: card.id } : {}), installments: installmentCount } }, ...(next.purchases || [])];
    next.materials = (next.materials || []).map(mat => {
      const rows = items.filter(it => it.materialId === mat.id); if (!rows.length) return mat;
      const quantity = rows.reduce((s,it)=>s+it.baseQuantity,0), value = rows.reduce((s,it)=>s+it.landedCost,0), last = value / quantity;
      const oldQty = Math.max(0,mat.currentStock), current = command.updateStock ? oldQty + quantity : oldQty;
      const average = command.updateStock ? (oldQty*(mat.inventoryUnitCost ?? mat.unitCost)+value)/(oldQty+quantity) : mat.inventoryUnitCost ?? mat.unitCost;
      if (command.updateStock) next.stockMovements!.push({ id:`${purchase.id}_${mat.id}`,date:purchase.date,targetId:mat.id,type:'material',quantity,reason:'Compra',referenceId:purchase.id,businessUnitCost:last });
      return { ...mat, currentStock:current, inventoryUnitCost:average, lastPurchaseUnitCost:last, unitCost:last, packagePrice:last*(mat.packageQuantity || 1)*getUnitConversionMultiplier(mat.packageUnit,mat.unit), updatedAt:purchase.date };
    });
    next.products = cascadeRecalculateAllProducts(next.materials,next.products);
    const values = allocateCents(cents(purchase.totalAmount), Array(installmentCount).fill(1));
    const bills: FinanceBill[] = values.map((amountCents, index) => ({ id: installmentCount === 1 ? `bill_${purchase.id}` : `bill_${purchase.id}_${index + 1}`, name: `Compra · ${purchase.supplierName}${installmentCount > 1 ? ` · ${index + 1}/${installmentCount}` : ''}`, category: 'Materiais', amountCents, dueDate: index === 0 ? firstDue : monthlyDueDate(firstDue, index, card?.dueDay), competenceDate: purchase.date, purchaseId: purchase.id, createdAt: new Date().toISOString(), ...(card ? { cardId: card.id } : {}), installmentNumber: index + 1, installmentCount }));
    finance.bills.push(...bills);
    const bill = bills[0];
    if (command.paidNow) entry(makeEntry('purchase_payment',purchase.totalAmount,{id:`paid_${purchase.id}`,billId:bill.id,purchaseId:purchase.id,date:purchase.date,account:command.account,note:bill.name}));
  }
  if (command.type === 'cancel_purchase') {
    const purchase = next.purchases?.find(p=>p.id===command.purchaseId) || fail('Compra não encontrada.');
    if (purchase.cancelledAt) return source;
    if (activeEntries(finance).some(e=>e.purchaseId===purchase.id)) fail('Estorne os pagamentos da compra no financeiro antes de cancelar.');
    if (purchase.stockApplied == null) fail('Compra anterior à reforma: confira o estoque e use ajuste com histórico. Não foi presumida uma reversão.');
    if (purchase.stockApplied) {
      next.materials = (next.materials || []).map(mat => {
        const rows=purchase.items.filter(it=>it.materialId===mat.id), qty=rows.reduce((n,it)=>n+(it.baseQuantity||0),0);
        if (!qty) return mat;
        if (mat.currentStock < qty) fail('Parte desses materiais já foi consumida. Registre a devolução/ajuste físico em vez de cancelar a entrada.');
        const value=rows.reduce((n,it)=>n+(it.landedCost||0),0), remaining=mat.currentStock-qty;
        const average=remaining>0?Math.max(0,(mat.currentStock*(mat.inventoryUnitCost??mat.unitCost)-value)/remaining):0;
        next.stockMovements!.push({id:`cancel_${purchase.id}_${mat.id}`,date:command.date,targetId:mat.id,type:'material',quantity:-qty,reason:'Cancelamento de compra',referenceId:purchase.id});
        return {...mat,currentStock:remaining,inventoryUnitCost:average};
      });
    }
    next.purchases=next.purchases!.map(p=>p.id===purchase.id?{...p,cancelledAt:command.date}:p);
    finance.bills=finance.bills.map(b=>b.purchaseId===purchase.id?{...b,cancelledAt:command.date}:b);
  }
  if(command.type==='stock_adjust') {
    if(next.stockMovements?.some(m=>m.id===command.id))return source;
    const material=next.materials?.find(m=>m.id===command.materialId)||fail('Material não encontrado.');
    if(!Number.isFinite(command.delta)||material.currentStock+command.delta<0)fail('Saldo de estoque inválido.');
    next.materials=next.materials!.map(m=>m.id===material.id?{...m,currentStock:m.currentStock+command.delta}:m);
    next.stockMovements!.push({id:command.id,date:command.date,targetId:material.id,type:'material',quantity:command.delta,reason:'Conferência / ajuste manual'});
  }
  if (command.type === 'bill') {
    requireDate(command.bill.dueDate); requireDate(command.bill.competenceDate);
    if (command.bill.amountCents <= 0 || !command.bill.name.trim()) fail('Informe descrição e valor da conta.');
    if (!finance.bills.some(b => b.id === command.bill.id)) finance.bills.push({ ...command.bill });
  }
  if (command.type === 'cancel_bill') {
    const bill = finance.bills.find(b => b.id === command.billId) || fail('Conta não encontrada.');
    if (billBalance(bill, finance) !== bill.amountCents) fail('Estorne os pagamentos antes de cancelar a conta.');
    finance.bills = finance.bills.map(b => b.id === bill.id ? { ...b, cancelledAt: command.date } : b);
  }
  if (command.type === 'save_order') {
    const previous = next.sales.find(s => s.id === command.sale.id);
    if (previous?.commercialStatus === 'cancelled') fail('Pedidos cancelados permanecem no histórico.');
    let sale = migrateFinanceOrder({ ...command.sale, amountPaid: previous?.amountPaid ?? 0, legacyPaidCents: previous ? legacyPaid(previous) : 0, deliveryHistory: previous?.deliveryHistory || [], returnAdjustmentCents: previous?.returnAdjustmentCents || 0 });
    sale.commercialStatus = sale.commercialStatus || 'confirmed';
    sale.orderNumber = previous?.orderNumber || Math.max(next.settings.lastOrderNumber || 0, ...next.sales.map(s => s.orderNumber || 0)) + 1;
    if (previous?.customerId && previous.customerId !== sale.customerId && (orderPaid(previous, finance) > 0 || finance.entries.some(e => e.saleId === previous.id))) fail('O cliente não pode mudar depois de um recebimento.');
    for (const old of previous ? orderItems(migrateFinanceOrder(previous)) : []) {
      const current = sale.items?.find(it => it.id === old.id);
      const delivered = Math.max(0, (old.deliveredQuantity || 0) - (old.returnedQuantity || 0));
      if ((old.deliveredQuantity || 0) > 0 && (!current || current.productId !== old.productId || current.quantity < delivered || current.unitPrice !== old.unitPrice)) fail('Itens com histórico de entrega preservam produto e preço. Registre devolução ou novo pedido para mudar o combinado.');
      if (current) Object.assign(current, { deliveredQuantity: old.deliveredQuantity || 0, returnedQuantity: old.returnedQuantity || 0, stockConsumedQuantity: old.stockConsumedQuantity || 0, unitBusinessCost: old.unitBusinessCost ?? current.unitBusinessCost, unitLaborRemuneration: old.unitLaborRemuneration ?? current.unitLaborRemuneration });
    }
    sale.items = sale.items!.map(it => ({ ...it, reservedQuantity: 0 }));
    if (isActiveOrder(sale)) {
      const available = new Map(next.products.map(p => [p.id, p.currentStock || 0]));
      for (const other of next.sales.filter(s => s.id !== sale.id && isActiveOrder(s))) for (const it of orderItems(other)) { const id = it.isCustom ? it.customProductId : it.productId; if (id) available.set(id, (available.get(id) || 0) - (it.reservedQuantity || 0)); }
      sale.items = sale.items.map(it => { const id = it.isCustom ? it.customProductId : it.productId; const remaining = Math.max(0, it.quantity - (it.deliveredQuantity || 0) + (it.returnedQuantity || 0)); const reserve = id ? Math.min(remaining, Math.max(0, available.get(id) || 0)) : 0; if (id) available.set(id, (available.get(id) || 0) - reserve); return { ...it, reservedQuantity: reserve }; });
    }
    // Delivery is a separate physical operation; editing a form never invents a delivery.
    sale.deliveryStatus = deliveryStatus(sale);
    save(sale); next.settings = { ...next.settings, lastOrderNumber: Math.max(next.settings.lastOrderNumber || 0, sale.orderNumber) };
    const excess=previous?Math.max(0,orderPaid(sale,finance)-orderTotal(sale)):0;
    if(excess>0) {
      if(!sale.customerId)fail('Selecione um cliente para guardar o excedente do pedido como crédito.');
      const concessions=activeEntries(finance).filter(e=>e.saleId===sale.id&&e.kind==='credit_use').reduce((n,e)=>n+(e.concessionCents||0),0);
      entry(makeEntry('credit_release',money(excess),{id:`adjust_${sale.id}_${newId()}`,saleId:sale.id,customerId:sale.customerId,concessionCents:Math.min(excess,concessions),date:localDateString(),note:'Excedente após edição do pedido'}));
    }
    if (!previous && (command.initialPaymentCents || 0) > 0) entry({ id: `initial_${sale.id}`, kind: 'receipt', amountCents: command.initialPaymentCents!, saleId: sale.id, date: sale.date, createdAt: new Date().toISOString(), method: command.initialMethod || 'PIX', account: 'Principal' });
  }
  if (command.type === 'confirm_order') { const s = findOrder(command.saleId); save({ ...s, commercialStatus: 'confirmed' }); return applyFinanceCommand(next, { type: 'save_order', sale: { ...s, commercialStatus: 'confirmed' } }); }
  if (command.type === 'deliver') {
    const sale = migrateFinanceOrder(findOrder(command.saleId));
    if (sale.deliveryHistory?.some(e => e.id === command.id)) return source;
    if (!isActiveOrder(sale)) fail('Este pedido não aceita entregas.');
    requireDate(command.date);
    const item = sale.items!.find(it => it.id === command.itemId) || fail('Item não encontrado.');
    if (!Number.isFinite(command.quantity) || command.quantity <= 0) fail('Informe uma quantidade positiva.');
    const net = (item.deliveredQuantity || 0) - (item.returnedQuantity || 0);
    if (command.quantity > (command.kind === 'delivery' ? item.quantity - net : net)) fail('A quantidade supera o saldo desse item.');
    const productId = item.isCustom ? item.customProductId : item.productId;
    const product = next.products.find(p => p.id === productId);
    let manufacturedQuantity = 0;
    if (command.kind === 'delivery') {
      if (!product) fail('Produza o item antes de entregar.');
      const protectedStock = new Map<string, number>();
      for (const order of next.sales.filter(order => order.id !== sale.id && isActiveOrder(order))) for (const row of orderItems(order)) {
        const id = row.isCustom ? row.customProductId : row.productId;
        if (id) protectedStock.set(id, (protectedStock.get(id) || 0) + (row.reservedQuantity || 0));
      }
      const plan = planAutomaticConsumption([{ id: item.id || product.id, type: 'product', targetId: product.id, name: product.name, unit: 'un', quantity: command.quantity, unitCost: product.unitCostFromBatch || item.unitCost, totalCost: 0 }], next.materials || [], next.products, 1, {}, protectedStock);
      if (plan.errors.length) fail(plan.errors[0]);
      if (plan.hasStockShortage) fail('Estoque insuficiente dos materiais necessários para esta entrega.');
      validateAutomaticManufacturing(plan.automaticManufacturing, next.productions);
      manufacturedQuantity = plan.automaticManufacturing.filter(event => event.type === 'product' && event.targetId === product.id).reduce((sum,event)=>sum+event.quantity,0);
      next.materials = next.materials?.map(material => { const deduction = plan.deductions.find(row => row.type === 'material' && row.targetId === material.id); return deduction ? { ...material, currentStock: Number((material.currentStock - deduction.quantityTotal).toFixed(4)), updatedAt: command.date } : material; });
      next.products = next.products.map(value => { const deduction = plan.deductions.find(row => row.type === 'product' && row.targetId === value.id); return deduction ? { ...value, currentStock: Number(((value.currentStock || 0) - deduction.quantityTotal).toFixed(4)) } : value; });
      next.stockMovements!.push(...plan.deductions.filter(row => row.type !== 'product' || row.targetId !== product.id).map((row, index) => ({ id: `${command.id}_ingredient_${index}`, date: command.date, targetId: row.targetId, type: row.type, quantity: -row.quantityTotal, reason: 'Insumo para entrega com produção automática', referenceId: sale.id })));
      next.stockMovements!.push(...automaticStockMovements(plan.automaticManufacturing, command.id, command.date, sale.id).filter(movement => movement.type !== 'product' || movement.targetId !== product.id || movement.quantity > 0));
    }
    const delta = command.kind === 'delivery' ? -command.quantity : command.restock ? command.quantity : 0;
    if (command.kind === 'return') next.products = next.products.map(p => p.id === productId ? { ...p, currentStock: (p.currentStock || 0) + delta } : p);
    const estimated = product ? getProductFinancialSplit(product) : {businessCostPerUnit:item.unitCost,laborRemunerationPerUnit:0};
    const deliveryBusinessCost = manufacturedQuantity && product ? ((command.quantity-manufacturedQuantity)*(product.inventoryBusinessCost ?? estimated.businessCostPerUnit)+manufacturedQuantity*estimated.businessCostPerUnit)/command.quantity : product?.inventoryBusinessCost ?? item.unitBusinessCost ?? estimated.businessCostPerUnit;
    const deliveryLaborCost = manufacturedQuantity && product ? ((command.quantity-manufacturedQuantity)*(product.inventoryLaborCost ?? estimated.laborRemunerationPerUnit)+manufacturedQuantity*estimated.laborRemunerationPerUnit)/command.quantity : product?.inventoryLaborCost ?? item.unitLaborRemuneration ?? estimated.laborRemunerationPerUnit;
    const allocated = allocateCents(cents(sale.totalRevenue-(sale.shippingCharged||0)),sale.items!.map(it=>cents(it.quantity*it.unitPrice)));
    const priorEvent = sale.deliveryHistory?.find(e=>e.itemId===item.id&&e.kind==='delivery');
    const event: DeliveryEvent = { ...command, unitBusinessCost: command.kind==='return' ? priorEvent?.unitBusinessCost ?? item.unitBusinessCost ?? estimated.businessCostPerUnit : deliveryBusinessCost, unitLaborRemuneration: command.kind==='return' ? priorEvent?.unitLaborRemuneration ?? item.unitLaborRemuneration ?? estimated.laborRemunerationPerUnit : deliveryLaborCost, unitRevenueCents: command.kind==='return' ? priorEvent?.unitRevenueCents ?? allocated[sale.items!.findIndex(it=>it.id===item.id)]/item.quantity : allocated[sale.items!.findIndex(it=>it.id===item.id)]/item.quantity };
    if(command.kind==='return' && command.restock && product) next.products=next.products.map(p=>p.id===product.id?{...p,inventoryBusinessCost:((product.currentStock||0)*(product.inventoryBusinessCost??estimated.businessCostPerUnit)+command.quantity*(event.unitBusinessCost||0))/((product.currentStock||0)+command.quantity),inventoryLaborCost:((product.currentStock||0)*(product.inventoryLaborCost??estimated.laborRemunerationPerUnit)+command.quantity*(event.unitLaborRemuneration||0))/((product.currentStock||0)+command.quantity)}:p);
    sale.deliveryHistory = [...(sale.deliveryHistory || []), event];
    sale.items = sale.items!.map(it => it.id === item.id ? { ...it, deliveredQuantity: (it.deliveredQuantity || 0) + (command.kind === 'delivery' ? command.quantity : 0), returnedQuantity: (it.returnedQuantity || 0) + (command.kind === 'return' ? command.quantity : 0), stockConsumedQuantity: net + (command.kind === 'delivery' ? command.quantity : -command.quantity), reservedQuantity: Math.max(0, (it.reservedQuantity || 0) - (command.kind === 'delivery' ? command.quantity : 0)) } : it);
    sale.deliveryStatus = deliveryStatus(sale); sale.deliveryActualDate = sale.deliveryStatus === 'entregue' ? command.date : undefined; save(sale);
    next.stockMovements!.push({ id: command.id, date: command.date, targetId: productId || '', type: 'product', quantity: delta, reason: command.kind === 'delivery' ? 'Entrega' : command.restock ? 'Devolução ao estoque' : 'Devolução com perda', referenceId: sale.id });
  }
  if(command.type==='refund_order') {
    if(finance.entries.some(e=>e.id===command.id))return source;
    const sale=migrateFinanceOrder(findOrder(command.saleId));
    if(!isActiveOrder(sale))fail('Use o histórico do cancelamento para este pedido.');
    const weights=sale.items!.map(it=>cents(it.quantity*it.unitPrice));
    const revenues=allocateCents(cents(sale.totalRevenue-(sale.shippingCharged||0)),weights);
    const returnedValue=sale.items!.reduce((n,it,i)=>n+Math.round(revenues[i]*(it.returnedQuantity||0)/it.quantity),0);
    if(command.amountCents>returnedValue-(sale.returnAdjustmentCents||0))fail('O valor supera as peças devolvidas ainda não compensadas.');
    entry(makeEntry(command.destination==='credit'?'credit_release':'refund', money(command.amountCents),{id:command.id,saleId:sale.id,customerId:sale.customerId,date:command.date,account:command.account,note:'Compensação de devolução parcial'}));
    save({...sale,returnAdjustmentCents:(sale.returnAdjustmentCents||0)+command.amountCents});
  }
  if (command.type === 'cancel_order') {
    const sale = migrateFinanceOrder(findOrder(command.saleId));
    if (sale.commercialStatus === 'cancelled') return source;
    if (sale.items!.some(it => (it.deliveredQuantity || 0) > (it.returnedQuantity || 0))) fail('Registre a devolução dos itens entregues antes de cancelar.');
    const paid = orderPaid(sale, finance);
    if (paid > 0) {
      if (command.destination === 'credit' && !sale.customerId) fail('Selecione o cliente para devolver o valor em crédito.');
      const usedCredit=activeEntries(finance).filter(e=>e.saleId===sale.id).reduce((n,e)=>n+(e.kind==='credit_use'?e.amountCents:e.kind==='credit_release'?-(e.restoredCreditCents||0):0),0);
      const concessions=activeEntries(finance).filter(e=>e.saleId===sale.id&&e.kind==='credit_use').reduce((n,e)=>n+(e.concessionCents||0),0);
      if(command.destination==='credit') entry({ id:command.id,kind:'credit_release',saleId:sale.id,customerId:sale.customerId,amountCents:paid,concessionCents:Math.min(paid,concessions),date:command.date,createdAt:new Date().toISOString(),note:'Cancelamento do pedido',account:'Principal' });
      else {
        const restore=Math.min(paid,usedCredit);
        if(restore>0)entry({id:`${command.id}_credit`,kind:'credit_release',saleId:sale.id,customerId:sale.customerId,amountCents:restore,concessionCents:Math.min(restore,concessions),date:command.date,createdAt:new Date().toISOString(),note:'Cancelamento: crédito original restaurado'});
        if(paid>restore)entry({id:command.id,kind:'refund',saleId:sale.id,customerId:sale.customerId,amountCents:paid-restore,date:command.date,createdAt:new Date().toISOString(),note:'Cancelamento do pedido',account:'Principal'});
      }
    }
    save({ ...sale, commercialStatus: 'cancelled', cancelledAt: command.date, items: sale.items!.map(it => ({ ...it, reservedQuantity: 0 })) });
  }
  validateFinanceData(finance);
  if(next.sales.some(s=>orderPaid(s,finance)<0))fail('O movimento depende de valores já devolvidos. Confira os estornos antes de continuar.');
  return next;
}
export function deliveryStatus(sale: Sale): Sale['deliveryStatus'] {
  const items = orderItems(sale); const net = items.reduce((s, it) => s + (it.deliveredQuantity || 0) - (it.returnedQuantity || 0), 0);
  return net <= 0 ? 'pendente_entrega' : items.every(it => (it.deliveredQuantity || 0) - (it.returnedQuantity || 0) >= it.quantity) ? 'entregue' : 'parcial';
}
export function allocateCents(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, v) => s + v, 0); if (!sum) return weights.map(() => 0);
  const raw = weights.map(w => total * w / sum), result = raw.map(Math.floor);
  const indices = raw.map((v, i) => ({ i, rest: v - result[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let remaining = total - result.reduce((s, v) => s + v, 0), i = 0; remaining > 0; remaining--, i++) result[indices[i % indices.length].i]++;
  return result;
}
export const makeEntry = (kind: FinanceEntry['kind'], amount: number, fields: Partial<FinanceEntry> = {}): FinanceEntry => ({ id: newId(), kind, amountCents: cents(amount), date: localDateString(), createdAt: new Date().toISOString(), account: 'Principal', ...fields });
