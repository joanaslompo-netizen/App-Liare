import assert from 'node:assert/strict';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from './storage';
import { applyFinanceCommand, cashEffect, creditBalance, emptyFinance, makeEntry, orderBalance, orderPaid } from './financeLedger';
import { automaticReceiptFee, isCreditCardReceipt, receiptFeeFields } from './receiptFees';
import { salesReportLines } from './salesReports';
import type { Sale } from '../types';

const sale: Sale = { id: 'sale', date: '2026-11-02', createdAt: '2026-11-02', productId: 'p', productName: 'Vela de teste',
  quantity: 1, unitPrice: 100, unitCost: 20, totalRevenue: 100, totalCost: 20, totalProfit: 80, marginPercent: 80, customerId: 'c', commercialStatus: 'confirmed',
  items: [{ id: 'item', productId: 'p', productName: 'Vela de teste', quantity: 1, unitPrice: 100, unitCost: 20, totalCost: 20 }] };
const initial = () => ({ sales: [] as Sale[], products: [{ ...DEFAULT_PRODUCTS[0], id: 'p', currentStock: 5 }],
  customers: [{ id: 'c', name: 'Cliente de teste', phone: '', createdAt: '2026-11-02' }], settings: DEFAULT_SETTINGS, finance: emptyFinance() });
const configured = (percent = 3.49) => applyFinanceCommand(initial(), { type: 'save_receipt_fee', creditPercent: percent, expectedPercent: null });
let workspace = configured();
const configurationBefore = structuredClone(workspace);
assert.equal(applyFinanceCommand(workspace, { type: 'save_receipt_fee', creditPercent: 3.49, expectedPercent: null }), workspace);
for (const creditPercent of [-1, 101, NaN, Infinity]) assert.throws(() => applyFinanceCommand(workspace, { type: 'save_receipt_fee', creditPercent }), /taxa/);
assert.throws(() => applyFinanceCommand(workspace, { type: 'save_receipt_fee', creditPercent: 5, expectedPercent: 2 }), /outro aparelho/);
assert.deepEqual(workspace, configurationBefore);
assert.equal(automaticReceiptFee(workspace.finance, 'Cartão de crédito', 10000), 349);
assert.equal(automaticReceiptFee(workspace.finance, 'Cartão de crédito', 3333), 116);
assert.equal(automaticReceiptFee(workspace.finance, 'PIX', 10000), 0);
assert.equal(automaticReceiptFee(workspace.finance, 'Cartão de débito', 10000), 0);
assert(isCreditCardReceipt('CARTÃO DE CRÉDITO'));
assert(isCreditCardReceipt('Cartão'), 'Legacy generic card receipts remain compatible.');
workspace = applyFinanceCommand(workspace, { type: 'save_order', sale });
const payment = makeEntry('receipt', 100, { id: 'payment', saleId: sale.id, method: 'Cartão de crédito',
  ...receiptFeeFields(workspace.finance, 'Cartão de crédito', 10000, null), date: '2026-11-02' });
workspace = applyFinanceCommand(workspace, { type: 'entry', entry: payment });
assert.equal(workspace.finance.entries[0].feeCents, 349);
assert.equal(workspace.finance.entries[0].feeRatePercent, 3.49);
assert.equal(cashEffect(workspace.finance.entries[0], workspace.finance), 9651);
assert.equal(orderPaid(workspace.sales[0], workspace.finance), 10000);
assert.equal(orderBalance(workspace.sales[0], workspace.finance), 0, 'The machine fee never remains owed by the customer.');
assert.equal(workspace.sales[0].discountAmount, undefined, 'A machine fee is not an order discount.');
assert.equal(salesReportLines(workspace.sales, workspace.products, workspace.finance, 'all', 'orders').reduce((sum, line) => sum + line.feeCents, 0), 349);
const paidBefore = structuredClone(workspace.finance.entries[0]);
workspace = applyFinanceCommand(workspace, { type: 'save_receipt_fee', creditPercent: 5, expectedPercent: 3.49 });
workspace = applyFinanceCommand(workspace, { type: 'entry', entry: payment });
assert.equal(workspace.finance.entries.length, 1);
assert.deepEqual(workspace.finance.entries[0], paidBefore, 'A new configuration and a retried payment never recalculate old receipts.');
assert.throws(() => applyFinanceCommand(workspace, { type: 'entry', entry: { ...payment, id: 'stale' } }), /taxa da maquininha foi atualizada/);

let pending = applyFinanceCommand(configured(3.5), { type: 'save_order', sale });
pending = applyFinanceCommand(pending, { type: 'entry', entry: makeEntry('receipt', 100, { id: 'pending', saleId: sale.id, method: 'Cartão de crédito', pendingSettlement: true, date: '2026-11-02' }) });
assert.equal(pending.finance.entries[0].feeCents, 350);
assert.equal(cashEffect(pending.finance.entries[0], pending.finance), 0);
assert.equal(orderBalance(pending.sales[0], pending.finance), 0);
pending = applyFinanceCommand(pending, { type: 'save_receipt_fee', creditPercent: 8 });
pending = applyFinanceCommand(pending, { type: 'entry', entry: makeEntry('settlement', 100, { id: 'settled', referenceId: 'pending', date: '2026-11-03' }) });
assert.equal(pending.finance.entries[1].feeCents, 350);
assert.equal(pending.finance.entries[1].feeRatePercent, 3.5);
assert.equal(pending.finance.entries.reduce((sum, entry) => sum + cashEffect(entry, pending.finance), 0), 9650, 'The deposit applies the original fee exactly once.');

for (const [method, expectedFee] of [['PIX', 0], ['Dinheiro', 0], ['Cartão de débito', 0], ['Cartão', 349]] as const) {
  const result = applyFinanceCommand(configured(), { type: 'save_order', sale, initialPaymentCents: 10000, initialMethod: method });
  assert.equal(result.finance.entries[0].feeCents || 0, expectedFee);
}
const first = applyFinanceCommand(configured(), { type: 'save_order', sale: { ...sale, initialReceipt: { method: 'Cartão de crédito', feeCalculation: 'automatic', feeRatePercent: 3.49 } }, initialPaymentCents: 10000 });
assert.equal(first.finance.entries[0].feeCents, 349);
assert.equal(orderBalance(first.sales[0], first.finance), 0);
const firstManual = applyFinanceCommand(configured(), { type: 'save_order', sale: { ...sale, initialReceipt: { method: 'Cartão de crédito', feeCalculation: 'manual', feeCents: 200, pendingSettlement: true } }, initialPaymentCents: 10000 });
assert.equal(firstManual.finance.entries[0].feeCents, 200);
assert(firstManual.finance.entries[0].pendingSettlement);
assert.equal(orderBalance(firstManual.sales[0], firstManual.finance), 0);
const overridden = applyFinanceCommand(configured(), { type: 'entry', entry: makeEntry('receipt', 120, { id: 'advance', customerId: 'c', method: 'Cartão de crédito', feeCalculation: 'manual', feeCents: 0, date: '2026-11-02' }) });
assert.equal(overridden.finance.entries[0].feeCents, 0);
assert.equal(creditBalance(overridden.finance, 'c'), 12000);
assert.equal(cashEffect(overridden.finance.entries[0], overridden.finance), 12000);
const legacy = applyFinanceCommand(configured(), { type: 'entry', entry: makeEntry('receipt', 100, { customerId: 'c', method: 'Cartão', feeCents: 250, date: '2026-11-02' }) });
assert.equal(legacy.finance.entries[0].feeCents, 250, 'Explicit older manual fees are preserved.');
for (const feeCents of [-1, 10001, NaN, 1.5]) assert.throws(() => applyFinanceCommand(configured(), { type: 'entry', entry: makeEntry('receipt', 100, { customerId: 'c', method: 'Cartão', feeCalculation: 'manual', feeCents, date: '2026-11-02' }) }), /taxa/);
assert.equal(automaticReceiptFee(configured(0).finance, 'Cartão', 10000), 0);
console.log('Taxa da maquininha: configuração, crédito automático, arredondamento, valor bruto/quitado, caixa líquido, entrada do pedido, antecipações, ajustes manuais, depósito único, histórico e repetição passaram.');
