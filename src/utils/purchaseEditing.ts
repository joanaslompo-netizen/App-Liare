import type { FinanceData, Material, Purchase, PurchaseItem, StockMovement } from '../types';
import { canonicalJSON } from '../services/workspaceRecordStore';
import { getUnitConversionMultiplier } from './formatters';

export const purchaseFingerprint = (purchase: Purchase) => canonicalJSON(purchase);
export const purchaseItemId = (purchase: Purchase, index: number) => purchase.items[index].id || `${purchase.id}_item_${index}`;

export function purchasePaymentState(purchase: Purchase, finance: FinanceData) {
  const bills = finance.bills.filter(bill => bill.purchaseId === purchase.id && !bill.cancelledAt);
  const billIds = new Set(bills.map(bill => bill.id));
  const reversed = new Set(finance.entries.filter(entry => entry.kind === 'reversal').map(entry => entry.referenceId));
  const payments = finance.entries.filter(entry => !reversed.has(entry.id)
    && ['purchase_payment', 'expense_payment'].includes(entry.kind)
    && (entry.purchaseId === purchase.id || billIds.has(entry.billId || '')));
  const automaticPayment = purchase.paymentPlan?.paidNow && payments.length === 1
    && payments[0].id === (purchase.autoPaymentId || `paid_${purchase.id}`) ? payments[0] : undefined;
  return { bills, payments, automaticPayment, locked: payments.length > 0 && !automaticPayment, legacy: !purchase.paymentPlan };
}

/** Keep the package conversion recorded on the original line, even if its material was later edited. */
export function preservePurchaseUnits(previous: Purchase, items: PurchaseItem[]): PurchaseItem[] {
  return items.map(item => {
    const index = previous.items.findIndex((_, index) => purchaseItemId(previous, index) === item.id);
    const old = previous.items[index];
    return old && old.materialId === item.materialId && old.unit === item.unit && old.baseQuantity !== undefined && old.quantity > 0
      ? { ...item, baseQuantity: old.baseQuantity * item.quantity / old.quantity } : item;
  });
}

/** Share of a purchase still present in a moving-average stock pool. Unknown legacy history is left valued as recorded. */
function retainedQuantity(material: Material, purchaseId: string, movements: StockMovement[]): number {
  const rows = movements.filter(move => move.type === 'material' && move.targetId === material.id);
  const start = rows.findIndex(move => move.referenceId === purchaseId && move.quantity > 0 && ['Compra', 'Edição de compra'].includes(move.reason));
  if (start < 0) return 0;
  const later = rows.slice(start);
  let pool = material.currentStock - later.reduce((sum, move) => sum + move.quantity, 0), retained = 0;
  if (pool < -0.0001) return 0;
  for (const move of later) {
    if (move.quantity >= 0) {
      if (move.referenceId === purchaseId) retained += move.quantity;
    } else if (move.referenceId === purchaseId && move.reason === 'Edição de compra') retained = Math.max(0, retained + move.quantity);
    else if (pool > 0) retained *= Math.max(0, pool + move.quantity) / pool;
    pool += move.quantity;
    if (pool < -0.0001) return 0;
  }
  return Math.max(0, Math.min(material.currentStock, retained));
}

export function correctPurchaseStock(materials: Material[], movements: StockMovement[], purchases: Purchase[], previous: Purchase,
  purchase: Purchase, originalStockApplied: boolean, updateStock: boolean, operationId: string, date: string) {
  const added: StockMovement[] = [];
  const aggregate = (record: Purchase, material: Material) => record.items.filter(row => row.materialId === material.id).reduce((sum, row) => ({
    quantity: sum.quantity + (row.baseQuantity ?? row.quantity * (material.packageQuantity || 1) * getUnitConversionMultiplier(row.unit || material.packageUnit, material.unit)),
    value: sum.value + (row.landedCost ?? row.totalPrice + (record.shippingCost || 0) * row.totalPrice / (record.items.reduce((sum, item) => sum + item.totalPrice, 0) || 1)),
  }), { quantity: 0, value: 0 });
  const next = materials.map(material => {
    const old = aggregate(previous, material), current = aggregate(purchase, material);
    if (!old.quantity && !current.quantity) return material;
    const beforeQuantity = originalStockApplied ? old.quantity : 0, afterQuantity = updateStock ? current.quantity : 0;
    const delta = Number((afterQuantity - beforeQuantity).toFixed(8));
    if (Math.abs(delta) < 0.00000001 && Math.abs(current.value - old.value) < 0.00000001 && current.quantity === old.quantity) return material;
    const quantity = Number((material.currentStock + delta).toFixed(8));
    if (quantity < -0.0001) throw new Error(`A correção de "${material.name}" retiraria mais unidades do que há no estoque. Confira a quantidade já consumida.`);
    const oldCost = old.quantity ? old.value / old.quantity : 0, newCost = current.quantity ? current.value / current.quantity : oldCost;
    const average = material.inventoryUnitCost ?? material.unitCost;
    const retained = originalStockApplied ? retainedQuantity(material, previous.id, movements) : 0;
    // Revalue only the original purchase's remaining share. Past production/sale snapshots stay intact.
    const value = Math.max(0, material.currentStock * average + (current.quantity ? retained * (newCost - oldCost) : 0));
    const removedOwn = Math.min(Math.max(0, -delta), retained);
    const otherQuantity = material.currentStock - retained;
    const otherCost = otherQuantity > 0 ? Math.max(0, material.currentStock * average - retained * oldCost) / otherQuantity : average;
    const nextValue = delta >= 0 ? value + delta * newCost : value - removedOwn * newCost - (-delta - removedOwn) * otherCost;
    const inventoryUnitCost = quantity > 0 ? Math.max(0, nextValue) / quantity : 0;
    const latest = purchases.filter(row => !row.cancelledAt && row.items.some(item => item.materialId === material.id))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
    const latestValue = latest ? aggregate(latest, material) : undefined;
    const last = latestValue?.quantity ? latestValue.value / latestValue.quantity : quantity > 0 ? inventoryUnitCost : material.unitCost;
    if (delta) added.push({ id: `purchase_edit_${operationId}_${material.id}`, date, targetId: material.id, type: 'material', quantity: delta,
      reason: 'Edição de compra', referenceId: purchase.id, businessUnitCost: newCost });
    return { ...material, currentStock: Math.max(0, quantity), inventoryUnitCost, lastPurchaseUnitCost: last, unitCost: last,
      packagePrice: last * (material.packageQuantity || 1) * getUnitConversionMultiplier(material.packageUnit, material.unit), updatedAt: date };
  });
  return { materials: next, movements: added };
}
