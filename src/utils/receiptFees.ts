import type { FinanceData, FinanceEntry } from '../types';

export const RECEIPT_METHODS = ['PIX', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Outro'];
export function isCreditCardReceipt(method?: string) {
  const text = (method || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ['cartao', 'cartao de credito', 'cartao credito', 'credito', 'credit_card'].includes(text);
}
export function receiptMethodFromCategory(value: string) {
  if (isCreditCardReceipt(value)) return 'Cartão de crédito';
  const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return RECEIPT_METHODS.find(method => normalized(method) === normalized(value));
}
export function creditReceiptRate(finance: FinanceData, method?: string) {
  return isCreditCardReceipt(method) ? finance.cardReceiptFee?.creditPercent ?? 0 : 0;
}
export function automaticReceiptFee(finance: FinanceData, method: string | undefined, amountCents: number) {
  const rate = creditReceiptRate(finance, method);
  return Number.isSafeInteger(amountCents) && amountCents > 0 ? Math.round(amountCents * rate / 100) : 0;
}
export function receiptFeeFields(finance: FinanceData, method: string, amountCents: number, manualFeeCents: number | null) {
  return manualFeeCents == null
    ? { feeCalculation: 'automatic' as const, feeRatePercent: creditReceiptRate(finance, method), feeCents: automaticReceiptFee(finance, method, amountCents) }
    : { feeCalculation: 'manual' as const, feeCents: manualFeeCents };
}

/** Applied only to new receipts, inside the financial transaction. Explicit
 * legacy/manual fees remain intact; settlements inherit the original snapshot. */
export function applyReceiptFee(entry: FinanceEntry, finance: FinanceData): FinanceEntry {
  if (entry.kind !== 'receipt' || entry.feeCalculation === 'manual'
    || (!entry.feeCalculation && entry.feeCents != null)) return entry;
  const rate = creditReceiptRate(finance, entry.method);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Confira a porcentagem da taxa da maquininha.');
  if (entry.feeCalculation === 'automatic' && entry.feeRatePercent != null && entry.feeRatePercent !== rate) {
    throw new Error('A taxa da maquininha foi atualizada. Confira o recebimento antes de registrar.');
  }
  if (!isCreditCardReceipt(entry.method) && entry.feeCalculation !== 'automatic') return entry;
  return { ...entry, feeCalculation: 'automatic', feeRatePercent: rate, feeCents: automaticReceiptFee(finance, entry.method, entry.amountCents) };
}
