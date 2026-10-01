import { Sale } from '../types';

export const formatOrderNumber = (number?: number) =>
  number ? String(number).padStart(6, '0') : 'A definir';

export const getHighestOrderNumber = (sales: Sale[]) =>
  sales.reduce((highest, sale) => Math.max(highest, sale.orderNumber || 0), 0);

/** Assign legacy orders in chronological order and preserve existing numbers. */
export const ensureOrderNumbers = (sales: Sale[], lastNumber = 0): Sale[] => {
  const used = new Set<number>();
  let next = Math.max(lastNumber, getHighestOrderNumber(sales));
  const assigned = new Map<string, number>();
  [...sales].sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  ).forEach((sale) => {
    const number = sale.orderNumber;
    if (number && Number.isSafeInteger(number) && number > 0 && !used.has(number)) {
      assigned.set(sale.id, number);
      used.add(number);
    } else {
      assigned.set(sale.id, ++next);
      used.add(next);
    }
  });
  return sales.map((sale) => sale.orderNumber === assigned.get(sale.id)
    ? sale : { ...sale, orderNumber: assigned.get(sale.id) });
};
