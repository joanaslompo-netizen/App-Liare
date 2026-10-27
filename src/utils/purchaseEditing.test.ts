import assert from 'node:assert/strict';
import { applyFinanceCommand, emptyFinance, activeEntries, accountBalance, billBalance, makeEntry } from './financeLedger';
import { purchaseFingerprint, purchaseItemId, purchasePaymentState } from './purchaseEditing';
import { DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './storage';
import type { Purchase } from '../types';
import type { FinanceCommand } from './financeLedger';
const workspace = () => ({ sales: [], products: [], productions: [{ id: 'past', totalCost: 123 }], purchases: [] as Purchase[],
  materials: ['wax', 'jar'].map(id => ({ ...DEFAULT_MATERIALS[0], id, name: id, unit: 'un' as const, packageUnit: 'un' as const,
    packageQuantity: 10, packagePrice: 20, unitCost: 2, inventoryUnitCost: 2, currentStock: 5 })),
  settings: DEFAULT_SETTINGS, finance: { ...emptyFinance(), accounts: [{ id: 'bank', name: 'Banco' }], cards: [{ id: 'card', name: 'Cartão', closingDay: 5, dueDay: 12, paymentAccount: 'bank' }] }, stockMovements: [] });
const purchase = (id = 'purchase'): Purchase => ({ id, date: '2026-10-01', supplierName: 'Fornecedor', createdAt: '2026-10-01',
  shippingCost: 10, totalAmount: 110, items: [{ id: 'line', materialId: 'wax', materialName: 'wax', quantity: 2, unit: 'un', packagePrice: 100, totalPrice: 100 }] });
const buy = (source: any, p = purchase(), payment = { paidNow: true, account: 'bank', dueDate: p.date, installments: 1 }) =>
  applyFinanceCommand(source, { type: 'purchase', purchase: p, updateStock: true, ...payment });
let sequence = 0;
function edit(source: any, patch: Partial<Purchase>, overrides: any = {}) {
  const original = source.purchases[0];
  const value = { ...original, items: original.items.map((item: any, index: number) => ({ ...item, id: purchaseItemId(original, index) })), ...patch };
  const command: Extract<FinanceCommand, { type: 'edit_purchase' }> = { type: 'edit_purchase', purchase: value, expectedFingerprint: purchaseFingerprint(original),
    operationId: `edit-${++sequence}`, date: '2026-10-27', updateStock: original.stockApplied ?? true,
    paidNow: false, dueDate: original.date, account: 'bank', installments: 1, ...original.paymentPlan, ...overrides };
  return { result: applyFinanceCommand(source, command), command };
}
const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
let original = buy(workspace()), before = JSON.stringify(original);
const rows = [{ ...original.purchases[0].items[0], quantity: 3, totalPrice: 150 },
  { id: 'jar-line', materialId: 'jar', materialName: 'jar', quantity: 1, unit: 'un' as const, packagePrice: 20, totalPrice: 20 }];
const first = edit(original, { items: rows, shippingCost: 0, totalAmount: 170, invoiceNumber: 'CORRIGIDA' });
assert.equal(JSON.stringify(original), before, 'Nenhum campo da origem é alterado.');
assert.equal(first.result.purchases.length, 1);assert.equal(first.result.purchases[0].id, original.purchases[0].id);
assert.deepEqual(first.result.materials.map((material: any) => material.currentStock), [35, 15]);
assert.deepEqual(first.result.stockMovements.slice(1).map((move: any) => move.quantity), [10, 10]);
assert.equal(accountBalance(first.result.finance, 'bank'), -17000);
assert.equal(accountBalance(first.result.finance, 'bank', '2026-10-01'), -17000, 'Corrigir o lançamento também corrige o saldo histórico, sem somar dois pagamentos no passado.');
assert.equal(activeEntries(first.result.finance).filter(entry => entry.kind === 'purchase_payment').length, 1);
assert.equal(first.result.finance.entries[0].amountCents, 11000, 'O pagamento original fica no histórico.');
assert.equal(first.result.purchases[0].edits[0].previous.totalAmount, 110);
assert.equal(applyFinanceCommand(first.result, first.command), first.result, 'Repetir a gravação não duplica efeitos.');
assert.deepEqual(first.result.productions, original.productions);
const removed = edit(original, { items: [{ id: 'jar-only', materialId: 'jar', materialName: 'jar', quantity: 1, unit: 'un', packagePrice: 20, totalPrice: 20 }], shippingCost: 0, totalAmount: 20 }).result;
assert.equal(removed.materials[0].currentStock, 5);close(removed.materials[0].inventoryUnitCost, 2);
close(removed.materials[0].unitCost, 2);
const metadata = edit(first.result, { notes: 'Nota corrigida' }).result;
assert.deepEqual(metadata.materials, first.result.materials);assert.deepEqual(metadata.finance, first.result.finance);
assert.equal(metadata.stockMovements.length, first.result.stockMovements.length);
assert.throws(() => applyFinanceCommand(metadata, { ...first.command, operationId: 'conflicting' }), /outro aparelho/);

// The saved conversion survives later package-size changes.
const changedPackage = { ...first.result, materials: first.result.materials.map((material: any) => material.id === 'wax' ? { ...material, packageQuantity: 50 } : material) };
const converted = edit(changedPackage, { items: [{ ...rows[0], quantity: 4, totalPrice: 200 }, rows[1]], totalAmount: 220 }).result;
assert.equal(converted.purchases[0].items[0].baseQuantity, 40);assert.equal(converted.materials[0].currentStock, 45);

// Reprice only the portion remaining after consumption; historical production costs do not change.
let consumed = buy(workspace());
consumed = { ...consumed, materials: consumed.materials.map((material: any) => material.id === 'wax' ? { ...material, currentStock: 12.5 } : material),
  stockMovements: [...consumed.stockMovements, { id: 'used', date: '2026-10-02', targetId: 'wax', type: 'material', quantity: -12.5, reason: 'Produção' }] };
const repriced = edit(consumed, { items: [{ ...consumed.purchases[0].items[0], totalPrice: 200 }], totalAmount: 210 }).result;
close(repriced.materials[0].inventoryUnitCost, 8.8); // 10 retained units gain R$5 each on a pool worth R$60.
assert.deepEqual(repriced.productions, consumed.productions);
const unchanged = JSON.stringify(consumed);
assert.throws(() => edit(consumed, { items: [], totalAmount: 10 }), /quantidades/);
assert.throws(() => edit(consumed, { items: [{ ...consumed.purchases[0].items[0], quantity: .1, totalPrice: 5 }], totalAmount: 15 }), /mais unidades/);
assert.equal(JSON.stringify(consumed), unchanged, 'Falhas não deixam estorno, pagamento ou estoque parcial.');

const cardPayment = { paidNow: false, account: 'bank', dueDate: '2026-10-12', installments: 3, cardId: 'card' };
let card = buy(workspace(), { ...purchase(), totalAmount: 300, shippingCost: 0, items: [{ ...purchase().items[0], totalPrice: 300 }] }, cardPayment);
const rescheduled = edit(card, {}, { installments: 2, dueDate: '2026-11-12' }).result;
assert.equal(rescheduled.finance.bills.filter((bill: any) => !bill.cancelledAt).length, 2);
assert.deepEqual(rescheduled.finance.bills.filter((bill: any) => !bill.cancelledAt).map((bill: any) => bill.amountCents), [15000, 15000]);
assert.equal(rescheduled.finance.entries.length, 0);
card = applyFinanceCommand(card, { type: 'entry', entry: makeEntry('purchase_payment', 100, { id: 'manual-payment', billId: card.finance.bills[0].id, purchaseId: 'purchase', account: 'bank', date: '2026-10-12' }) });
const withPaidInstallment = edit(card, { items: [{ ...card.purchases[0].items[0], totalPrice: 450 }], totalAmount: 450 }).result;
assert.deepEqual(withPaidInstallment.finance.entries, card.finance.entries);
assert.equal(accountBalance(withPaidInstallment.finance, 'bank'), -10000);
assert.deepEqual(withPaidInstallment.finance.bills.map((bill: any) => bill.amountCents), [10000, 17500, 17500]);
assert.equal(withPaidInstallment.finance.bills.reduce((sum: number, bill: any) => sum + billBalance(bill, withPaidInstallment.finance), 0), 35000);
assert.throws(() => edit(card, { items: [{ ...card.purchases[0].items[0], totalPrice: 50 }], totalAmount: 50 }), /menor que o valor já pago/);
assert.throws(() => edit(card, {}, { installments: 2 }), /pagamentos já registrados/);

const unpaid = edit(original, {}, { paidNow: false }).result;
assert.equal(accountBalance(unpaid.finance, 'bank'), 0);
assert.equal(purchasePaymentState(unpaid.purchases[0], unpaid.finance).payments.length, 0);
assert.equal(unpaid.finance.bills.filter((bill: any) => !bill.cancelledAt).reduce((sum: number, bill: any) => sum + billBalance(bill, unpaid.finance), 0), 11000);

const legacyPurchase = { ...purchase(), stockApplied: undefined, paymentPlan: undefined };
const legacy = { ...workspace(), purchases: [legacyPurchase] };
assert.throws(() => edit(legacy, { notes: 'Corrigido' }), /estoque da compra original/);
const fixedLegacy = edit(legacy, { notes: 'Corrigido' }, { originalStockApplied: true }).result;
assert.equal(edit(legacy, { date: '2026-10-27' }, { originalStockApplied: true }).result.purchases[0].date, '2026-10-27');
assert.deepEqual(fixedLegacy.finance, legacy.finance, 'Compra antiga não cria pagamentos retroativos.');
assert.deepEqual(fixedLegacy.materials, legacy.materials);
assert.equal(fixedLegacy.purchases[0].notes, 'Corrigido');
assert.throws(() => edit({ ...original, purchases: [{ ...original.purchases[0], cancelledAt: '2026-10-02' }] }, {}), /canceladas/);
for (const bad of [NaN, Infinity, -1]) assert.throws(() => edit(original, { shippingCost: bad }), /quantidades/);
assert.throws(() => edit(original, { totalAmount: 1000 }), /quantidades/);
console.log('Compras editáveis: diferença de estoque, preços e consumo, pacote histórico, pagamentos/estornos, parcelas pagas, legado, repetição, conflitos e falhas atômicas passaram.');
