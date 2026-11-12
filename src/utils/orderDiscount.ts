import type { DiscountCode, DiscountType, Sale } from '../types';

export type OrderDiscountMode = 'none' | 'code' | 'single-use' | DiscountType;

export interface OrderDiscountDraft {
  mode: OrderDiscountMode;
  codeId: string;
  manualValue: string;
  singleUse: { name: string; type: DiscountType; value: string };
}

export function initialOrderDiscount(sale?: Sale): OrderDiscountDraft {
  const type = sale?.discountType ?? (sale?.discountAmount ? 'fixed' : undefined);
  const value = sale?.discountValue ?? sale?.discountAmount;
  const singleUseName = sale?.discountCodeId ? '' : sale?.discountCode ?? '';
  return {
    mode: sale?.discountCodeId ? 'code' : singleUseName ? 'single-use' : type ?? 'none',
    codeId: sale?.discountCodeId ?? '',
    manualValue: value == null ? '' : String(value),
    singleUse: { name: singleUseName, type: singleUseName ? type ?? 'fixed' : 'percentage', value: singleUseName && value != null ? String(value) : '' },
  };
}

export function orderDiscountOptions(codes: DiscountCode[], sale?: Sale): DiscountCode[] {
  const active = codes.filter(code => code.active !== false && code.id !== sale?.discountCodeId);
  if (!sale?.discountCodeId) return active;
  const catalog = codes.find(code => code.id === sale.discountCodeId);
  const type = sale.discountValue != null ? sale.discountType ?? 'fixed' : 'fixed';
  return [{
    id: sale.discountCodeId,
    code: sale.discountCode ?? catalog?.code ?? 'DESCONTO',
    type,
    value: sale.discountValue ?? sale.discountAmount ?? 0,
    createdAt: sale.createdAt,
  }, ...active];
}

export function resolveOrderDiscount(draft: OrderDiscountDraft, codes: DiscountCode[], subtotal: number) {
  let type: DiscountType | undefined;
  let value = 0;
  let name: string | undefined;
  let codeId: string | undefined;
  let error = '';

  if (draft.mode === 'code') {
    const selected = codes.find(code => code.id === draft.codeId);
    if (!selected) error = 'Escolha um código de desconto.';
    else {
      type = selected.type;
      value = selected.value;
      name = selected.code;
      codeId = selected.id;
    }
  } else if (draft.mode === 'single-use') {
    ({ type } = draft.singleUse);
    name = draft.singleUse.name.trim();
    value = Number(draft.singleUse.value);
    if (!name || !Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 100)) {
      error = 'Informe o nome do código de uso único e um desconto válido.';
    }
  } else if (draft.mode !== 'none') {
    type = draft.mode;
    value = Number(draft.manualValue);
    if (!Number.isFinite(value) || value < 0 || (type === 'percentage' && value > 100)) {
      error = 'Informe um valor de desconto válido.';
    }
  }

  const validValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const amount = type === 'percentage' ? subtotal * Math.min(100, validValue) / 100 : validValue;
  const discountAmount = Math.max(0, Math.min(subtotal, amount));
  return {
    fields: {
      discountType: type,
      discountValue: type ? validValue : undefined,
      discountAmount: discountAmount || undefined,
      discountCode: name || undefined,
      discountCodeId: codeId,
    },
    error,
  };
}
