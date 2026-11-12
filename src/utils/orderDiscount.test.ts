import assert from 'node:assert/strict';
import type { DiscountCode, Sale } from '../types';
import { createOrderDiscountDraft, initialOrderDiscounts, resolveOrderDiscounts } from './orderDiscount';

const percentage = (value: number) => ({ ...createOrderDiscountDraft(), mode: 'percentage' as const, manualValue: String(value) });
const fixed = (value: number) => ({ ...createOrderDiscountDraft(), mode: 'fixed' as const, manualValue: String(value) });

const combined = resolveOrderDiscounts([percentage(10), percentage(5), fixed(3)], [], 100);
assert.equal(combined.fields.discountAmount, 18);
assert.deepEqual(combined.amounts, [10, 5, 3]);
assert.equal(combined.fields.discountType, undefined);
assert.equal(combined.error, '');

const capped = resolveOrderDiscounts([percentage(90), percentage(20), fixed(50)], [], 100);
assert.equal(capped.fields.discountAmount, 100);
assert.deepEqual(capped.amounts, [90, 10, 0]);

const rounded = resolveOrderDiscounts([percentage(30), percentage(30)], [], 0.01);
assert.equal(rounded.fields.discountAmount, 0.01);
assert.deepEqual(rounded.amounts, [0, 0.01]);

const oldOrder = { discountAmount: 12.5 } as Sale;
assert.equal(resolveOrderDiscounts(initialOrderDiscounts(oldOrder), [], 100).fields.discountAmount, 12.5);

const catalog: DiscountCode[] = [{ id: 'vip', code: 'VIP20', type: 'percentage', value: 20, createdAt: '2026-11-12' }];
const legacyCode = { discountCodeId: 'vip', discountCode: 'VIP10', discountType: 'percentage', discountValue: 10 } as Sale;
const draft = [...initialOrderDiscounts(legacyCode), { ...createOrderDiscountDraft(), mode: 'code' as const, codeId: 'vip' }];
const result = resolveOrderDiscounts(draft, catalog, 100);
assert.equal(result.fields.discountAmount, 30);
assert.deepEqual(result.fields.discounts?.map(discount => discount.code), ['VIP10', 'VIP20']);

const reopened = initialOrderDiscounts(result.fields as Sale);
assert.deepEqual(resolveOrderDiscounts(reopened, [], 100).fields, result.fields, 'Os descontos salvos mantêm os valores mesmo sem o código no cadastro.');
assert(resolveOrderDiscounts([{ ...createOrderDiscountDraft(), mode: 'code' }], [], 100).error);
console.log('Descontos do pedido: soma sobre o subtotal, limite, centavos e histórico passaram.');
