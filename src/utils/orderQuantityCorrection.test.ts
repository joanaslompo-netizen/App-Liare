import assert from 'node:assert/strict';
import { applyFinanceCommand, emptyFinance, makeEntry, orderPaid, creditBalance, accountBalance, type FinanceCommand } from './financeLedger';
import { orderQuantityFingerprint } from './orderQuantityCorrection';
import { salesReportLines } from './salesReports';
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from './storage';
import type { Sale } from '../types';

const original: Sale = { id: 'order', orderNumber: 12, date: '2026-10-01', createdAt: '2026-10-01', customerId: 'customer', customerName: 'Cliente fictícia',
  productId: 'product', productName: 'Vela', quantity: 5, unitPrice: 50, unitCost: 10, totalRevenue: 250, totalCost: 50, totalProfit: 200, marginPercent: 80,
  financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'entregue', deliveryActualDate: '2026-10-02',
  items: [{ id: 'line', productId: 'product', productName: 'Vela', quantity: 5, unitPrice: 50, unitCost: 10, unitBusinessCost: 8, unitLaborRemuneration: 2, totalCost: 50,
    deliveredQuantity: 5, stockConsumedQuantity: 5 }],
  deliveryHistory: [{ id: 'original-delivery', itemId: 'line', kind: 'delivery', date: '2026-10-02', quantity: 5, unitRevenueCents: 5000, unitBusinessCost: 8, unitLaborRemuneration: 2 }] };
const initial = () => ({ sales: [structuredClone(original)], products: [{ ...DEFAULT_PRODUCTS[0], id: 'product', currentStock: 5, inventoryBusinessCost: 20, inventoryLaborCost: 4 }], materials: [], productions: [], customers: [{ id: 'customer', name: 'Cliente fictícia', phone: '', createdAt: '2026-10-01' }], settings: DEFAULT_SETTINGS, stockMovements: [],
  finance: { ...emptyFinance(), entries: [makeEntry('receipt', 250, { id: 'receipt', saleId: original.id, customerId: original.customerId, date: '2026-10-02', allocatedCents: 25000, account: 'Principal' })] } });
function correction(workspace: ReturnType<typeof initial>, quantity: number, restoreStock = true): Extract<FinanceCommand, { type: 'correct_order_quantity' }> {
  const sale = workspace.sales[0];
  return { type: 'correct_order_quantity', id: `correction-${quantity}`, date: '2026-11-03', restoreStock, expectedFingerprint: orderQuantityFingerprint(sale),
    sale: { ...sale, quantity, totalRevenue: quantity * 50, totalCost: quantity * 10, items: [{ ...sale.items![0], quantity, totalCost: quantity * 10 }] } };
}
const source = initial(), before = JSON.stringify(source), command = correction(source, 2);
const result = applyFinanceCommand(source, command), sale = result.sales[0];
assert.equal(JSON.stringify(source), before, 'A correção é pura até a confirmação da operação');
assert.equal(sale.quantity, 2);assert.equal(sale.items![0].deliveredQuantity, 2);assert.equal(sale.items![0].stockConsumedQuantity, 2);
assert.equal(sale.deliveryStatus, 'entregue');assert.equal(sale.deliveryActualDate, '2026-10-02');
assert.equal(result.products[0].currentStock, 8);assert.equal(result.stockMovements[0].quantity, 3);
assert.equal(result.products[0].inventoryBusinessCost, (5 * 20 + 3 * 8) / 8);
assert.equal(sale.deliveryHistory![0].quantity, 2);assert.equal(sale.deliveryHistory![0].date, '2026-10-02');
assert.deepEqual(sale.quantityCorrections![0].previousDeliveryHistory, original.deliveryHistory);
assert.deepEqual(result.finance.entries[0], source.finance.entries[0]);assert.equal(accountBalance(result.finance, 'Principal', '2026-12-31'), 25000);
assert.equal(creditBalance(result.finance, 'customer'), 15000);assert.equal(orderPaid(sale, result.finance), 10000);
assert.equal(applyFinanceCommand(result, command), result, 'Reenvio não repõe estoque nem libera crédito duas vezes');
const report = salesReportLines(result.sales, result.products, result.finance, '2026-10', 'delivered');
assert.equal(report[0].quantity, 2);assert.equal(report[0].revenueCents, 10000);assert.equal(report[0].businessCostCents, 1600);
assert.equal(salesReportLines(result.sales, result.products, result.finance, '2026-11', 'delivered').length, 0, 'Corrigir cadastro não cria uma devolução fictícia neste mês');
const repeated = applyFinanceCommand(result, correction(result, 1));assert.equal(repeated.products[0].currentStock, 9);assert.equal(repeated.sales[0].quantityCorrections!.length, 2);

const noStock = applyFinanceCommand(initial(), correction(initial(), 2, false));assert.equal(noStock.products[0].currentStock, 5);assert.equal(noStock.stockMovements.length, 0);
const legacy = initial();Object.assign(legacy.sales[0], { deliveryHistory: undefined, legacyDeliveryDate: '2026-10-02' });delete legacy.sales[0].items![0].stockConsumedQuantity;
const old = applyFinanceCommand(legacy, correction(legacy, 2));assert.equal(old.products[0].currentStock, 5, 'Sem baixa física conhecida, não inventa reposição');
assert.equal(salesReportLines(old.sales, old.products, old.finance, '2026-10', 'delivered')[0].quantity, 2);
const anonymous = initial();delete anonymous.sales[0].customerId;delete anonymous.finance.entries[0].customerId;
const anonymousResult = applyFinanceCommand(anonymous, correction(anonymous, 2));assert.equal(anonymousResult.finance.entries.length, 1);assert.equal(orderPaid(anonymousResult.sales[0], anonymousResult.finance), 25000);
assert.equal(applyFinanceCommand(anonymousResult, { type: 'save_order', sale: anonymousResult.sales[0] }).finance.entries.length, 1, 'O excedente sem cliente não se perde nem impede salvar novamente');

const discounted = initial();discounted.sales[0].totalRevenue = 200;discounted.sales[0].discountAmount = 50;
discounted.sales[0].deliveryHistory![0].unitRevenueCents = 4000;
const discountCommand = correction(discounted, 2);discountCommand.sale.totalRevenue = 50;
const discountResult = applyFinanceCommand(discounted, discountCommand);
assert.equal(salesReportLines(discountResult.sales, discountResult.products, discountResult.finance, '2026-10', 'delivered')[0].revenueCents, 5000, 'O desconto fixo é redistribuído conforme a quantidade corrigida');

const concurrent = initial();concurrent.sales[0].notes = 'Outra edição';assert.throws(() => applyFinanceCommand(concurrent, command), /outra alteração/);
assert.throws(() => applyFinanceCommand(source, { ...command, sale: { ...command.sale, items: [{ ...command.sale.items![0], productId: 'another' }] } }), /histórico/);
assert.throws(() => applyFinanceCommand(source, { ...command, sale: { ...command.sale, items: [{ ...command.sale.items![0], quantity: 0 }] } }), /quantidades/);
assert.equal(JSON.stringify(source), before, 'Falhas não alteram estoque nem histórico');
console.log('Correção de quantidade entregue: estoque opcional e custo histórico, evento original arquivado, mesma data de entrega, relatório corrigido, recebimento preservado, crédito/excedente, legado, desconto fixo e reenvio seguro.');
