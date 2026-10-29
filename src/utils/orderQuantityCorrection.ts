import type { Sale, SaleItem } from '../types';
import { canonicalJSON } from '../services/workspaceRecordStore';

export interface OrderQuantityCorrectionOptions {
  id: string;
  date: string;
  expectedFingerprint: string;
  restoreStock: boolean;
}

/** Payment projections and stock reservations may refresh without editing an order. */
export const orderQuantityFingerprint = (sale: Sale) => canonicalJSON({
  ...sale, amountPaid: undefined, paymentStatus: undefined, paymentLabel: undefined,
  items: sale.items?.map(({ reservedQuantity, ...item }) => item),
});

export const quantityCorrections = (original: Sale, items: SaleItem[]) => (original.items || []).flatMap(old => {
  const current = items.find(item => item.id === old.id);
  const delivered = Math.max(0, (old.deliveredQuantity || 0) - (old.returnedQuantity || 0));
  if (!current || !Number.isSafeInteger(current.quantity) || current.quantity < 1 || current.quantity >= delivered) return [];
  const difference = delivered - current.quantity;
  const tracked = old.stockConsumedQuantity ?? (old.customStockConsumed || original.deliveryHistory?.some(event => event.itemId === old.id && event.kind === 'delivery') ? delivered : 0);
  return [{ itemId: old.id!, productName: old.productName, quantityBefore: old.quantity,
    quantityAfter: current.quantity, deliveredBefore: delivered, deliveredAfter: current.quantity,
    difference, restorable: Math.min(difference, Math.max(0, tracked)),
    productId: old.isCustom ? old.customProductId : old.productId }];
});
