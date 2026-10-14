import type { FinanceData, Product, Sale } from '../types';
import { activeEntries, allocateCents, cents, isActiveOrder, money, orderItems } from './financeLedger';
import { getSaleItemFinancialSplit } from './financials';

export interface ReportLine { productId: string; name: string; family: string; fragrance: string; quantity: number; revenueCents: number; businessCostCents: number; laborCents: number; feeCents: number; concessionCents: number; incomplete: boolean; legacy: boolean; }
export function salesReportLines(sales: Sale[], products: Product[], finance: FinanceData, month: string, basis: 'orders'|'delivered'): ReportLine[] {
  const result: ReportLine[] = [];
  const matches = (d: string) => month === 'all' || d.startsWith(month);
  for (const sale of sales) {
    if (sale.commercialStatus === 'draft' || (basis === 'orders' && sale.commercialStatus === 'cancelled')) continue;
    const items = orderItems(sale);
    const revenues = allocateCents(cents(sale.totalRevenue-(sale.shippingCharged||0)), items.map(it => cents(it.quantity * it.unitPrice)));
    const fees = activeEntries(finance).filter(e => e.saleId === sale.id && e.kind === 'receipt').reduce((s,e) => s + (e.feeCents || 0),0);
    const splitFees = allocateCents(fees, revenues);
    const concessions = activeEntries(finance).filter(e=>e.saleId===sale.id).reduce((n,e)=>n+(e.kind==='credit_use'?(e.concessionCents||0):0),0);
    const splitConcessions=allocateCents(Math.max(0,concessions),revenues);
    items.forEach((item,i) => {
      const product = products.find(p => p.id === (item.isCustom ? item.customProductId : item.productId));
      const split = getSaleItemFinancialSplit(item, products);
      let quantity = 0; let eventRevenue: number | undefined, eventCost: number | undefined, eventLabor: number | undefined; let deliveredInPeriod: number | undefined;
      if (basis === 'orders') quantity = matches(sale.date) ? item.quantity : 0;
      else if (sale.deliveryHistory?.length) {
        // Initial legacy delivered units are not guessed into a new month.
        const events = sale.deliveryHistory.filter(e => e.itemId === item.id);
        const periodEvents = events.filter(e=>matches(e.date));
        deliveredInPeriod=periodEvents.filter(e=>e.kind==='delivery').reduce((n,e)=>n+e.quantity,0);
        if(periodEvents.length && periodEvents.every(e=>e.unitRevenueCents!=null)) {
          eventRevenue=periodEvents.reduce((n,e)=>n+Math.round((e.unitRevenueCents||0)*e.quantity*(e.kind==='delivery'?1:-1)),0);
          eventCost=periodEvents.reduce((n,e)=>n+cents((e.unitBusinessCost||0)*e.quantity*(e.kind==='delivery'?1:e.restock?-1:0)),0);
          eventLabor=periodEvents.reduce((n,e)=>n+cents((e.unitLaborRemuneration||0)*e.quantity*(e.kind==='delivery'?1:e.restock?-1:0)),0);
        }
        quantity = events.filter(e => matches(e.date)).reduce((s,e) => s + (e.kind === 'delivery' ? e.quantity : -e.quantity),0);
        const prior = (item.deliveredQuantity ?? 0) - events.filter(e=>e.kind==='delivery').reduce((s,e)=>s+e.quantity,0);
        if (prior>0 && matches(sale.legacyDeliveryDate || sale.deliveryActualDate || sale.date)) { quantity += prior; eventRevenue=undefined;eventCost=undefined;eventLabor=undefined; }
      } else if (matches(sale.legacyDeliveryDate || sale.deliveryActualDate || sale.date)) quantity = (item.deliveredQuantity ?? item.stockConsumedQuantity ?? (sale.deliveryStatus === 'entregue' ? item.quantity : 0)) - (item.returnedQuantity || 0);
      if (!quantity && !eventRevenue && !eventCost) return;
      const factor = item.quantity > 0 ? quantity / item.quantity : 0;
      result.push({ productId: item.productId || `custom_${item.id}`, name: item.productName, family: product?.productFamily || '', fragrance: product?.fragrance || '', quantity, revenueCents: eventRevenue ?? Math.round(revenues[i]*factor), businessCostCents: eventCost ?? cents(split.businessCostPerUnit * quantity), laborCents: eventLabor ?? cents(split.laborRemunerationPerUnit * quantity), feeCents: Math.round(splitFees[i]*(basis==='orders'?factor:(deliveredInPeriod ?? Math.max(0,quantity))/item.quantity)), concessionCents:Math.round(splitConcessions[i]*factor), incomplete: !!item.costIncomplete || !!item.isCustom && !item.customRecipeItems?.length && !item.customProductId, legacy: item.unitBusinessCost == null });
    });
  }
  return result;
}
export const aggregateReportLines = (lines: ReportLine[]) => {
  const map = new Map<string, ReportLine>();
  for (const line of lines) { const old=map.get(line.productId); map.set(line.productId,old ? {...old, quantity:old.quantity+line.quantity,revenueCents:old.revenueCents+line.revenueCents,businessCostCents:old.businessCostCents+line.businessCostCents,laborCents:old.laborCents+line.laborCents,feeCents:old.feeCents+line.feeCents,concessionCents:old.concessionCents+line.concessionCents,incomplete:old.incomplete||line.incomplete,legacy:old.legacy||line.legacy} : {...line}); }
  return [...map.values()].sort((a,b)=>(b.revenueCents-b.businessCostCents-b.feeCents)-(a.revenueCents-a.businessCostCents-a.feeCents));
};
