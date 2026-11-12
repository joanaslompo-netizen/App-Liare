import type { DiscountCode, DiscountType, OrderDiscount, Sale } from '../types';

export type OrderDiscountMode = 'none' | 'code' | 'single-use' | DiscountType;

export interface OrderDiscountDraft {
  id: string;
  mode: OrderDiscountMode;
  codeId: string;
  manualValue: string;
  singleUse: { name: string; type: DiscountType; value: string };
  savedCode?: DiscountCode;
  customerDefault?: boolean;
}

export function createOrderDiscountDraft(): OrderDiscountDraft {
  return {
    id: crypto.randomUUID(),
    mode: 'none',
    codeId: '',
    manualValue: '',
    singleUse: { name: '', type: 'percentage', value: '' },
  };
}

export function initialOrderDiscounts(sale?: Sale): OrderDiscountDraft[] {
  const saved = sale?.discounts?.length ? sale.discounts : legacyDiscounts(sale);
  if (!saved.length) return [createOrderDiscountDraft()];

  return saved.map(discount => {
    const draft = createOrderDiscountDraft();
    if (discount.codeId) {
      return {
        ...draft,
        mode: 'code',
        codeId: discount.codeId,
        savedCode: {
          id: discount.codeId,
          code: discount.code ?? '',
          type: discount.type,
          value: discount.value,
          createdAt: sale?.createdAt ?? '',
        },
      };
    }
    if (discount.code) {
      return {
        ...draft,
        mode: 'single-use',
        singleUse: { name: discount.code, type: discount.type, value: String(discount.value) },
      };
    }
    return { ...draft, mode: discount.type, manualValue: String(discount.value) };
  });
}

function legacyDiscounts(sale?: Sale): OrderDiscount[] {
  if (!sale || !(sale.discountType || sale.discountAmount || sale.discountCode || sale.discountCodeId)) return [];
  return [{
    type: sale.discountValue != null ? sale.discountType ?? 'fixed' : 'fixed',
    value: sale.discountValue ?? sale.discountAmount ?? 0,
    amount: sale.discountAmount ?? 0,
    code: sale.discountCode,
    codeId: sale.discountCodeId,
  }];
}

export function orderDiscountOptions(codes: DiscountCode[], draft: OrderDiscountDraft): DiscountCode[] {
  const saved = draft.savedCode?.id === draft.codeId ? draft.savedCode : undefined;
  const active = codes.filter(code => code.active !== false && code.id !== saved?.id);
  if (!saved) return active;
  const name = saved.code || codes.find(code => code.id === saved.id)?.code || 'DESCONTO';
  return [{ ...saved, code: name }, ...active];
}

function resolveDiscount(draft: OrderDiscountDraft, codes: DiscountCode[]) {
  let terms: Omit<OrderDiscount, 'amount'> | undefined;
  let error = '';

  if (draft.mode === 'code') {
    const selected = orderDiscountOptions(codes, draft).find(code => code.id === draft.codeId);
    if (!selected) error = 'Escolha um código de desconto.';
    else terms = { type: selected.type, value: selected.value, code: selected.code, codeId: selected.id };
  } else if (draft.mode === 'single-use') {
    const { type, name, value } = draft.singleUse;
    const number = Number(value);
    if (!name.trim() || !Number.isFinite(number) || number <= 0 || (type === 'percentage' && number > 100)) {
      error = 'Informe o nome do código de uso único e um desconto válido.';
    } else terms = { type, value: number, code: name.trim() };
  } else if (draft.mode !== 'none') {
    const value = Number(draft.manualValue);
    if (!Number.isFinite(value) || value < 0 || (draft.mode === 'percentage' && value > 100)) {
      error = 'Informe um valor de desconto válido.';
    } else if (value > 0) terms = { type: draft.mode, value };
  }

  return { terms, error };
}

export function resolveOrderDiscounts(drafts: OrderDiscountDraft[], codes: DiscountCode[], subtotal: number) {
  const subtotalCents = Number.isFinite(subtotal) ? Math.max(0, Math.round(subtotal * 100)) : 0;
  let nominalCents = 0;
  let appliedCents = 0;
  let error = '';
  const discounts: OrderDiscount[] = [];

  const amounts = drafts.map(draft => {
    const resolved = resolveDiscount(draft, codes);
    error ||= resolved.error;
    if (!resolved.terms) return 0;

    const { type, value } = resolved.terms;
    const positiveValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    nominalCents += type === 'percentage' ? subtotalCents * Math.min(100, positiveValue) / 100 : positiveValue * 100;
    // Round the combined amount and assign each row its contribution to that total.
    const nextCents = Math.min(subtotalCents, Math.round(nominalCents));
    const amount = (nextCents - appliedCents) / 100;
    discounts.push({ ...resolved.terms, value: positiveValue, amount });
    appliedCents = nextCents;
    return amount;
  });
  const single = discounts.length === 1 ? discounts[0] : undefined;

  return {
    fields: {
      discounts: discounts.length ? discounts : undefined,
      discountAmount: appliedCents ? appliedCents / 100 : undefined,
      discountType: single?.type,
      discountValue: single?.value,
      discountCode: single?.code,
      discountCodeId: single?.codeId,
    },
    amounts,
    error,
  };
}
