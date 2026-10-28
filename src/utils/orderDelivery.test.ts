import assert from 'node:assert/strict';
import { applyFinanceCommand, emptyFinance, type FinanceCommand } from './financeLedger';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from './storage';
import { autoMaterials, autoProducts } from '../../scripts/automaticManufacturingFixtures';
import type { Sale } from '../types';

const sale: Sale = { id: 'order', orderNumber: 1, date: '2026-10-01', createdAt: '2026-10-01', productId: 'a', productName: 'Vela A',
  quantity: 5, unitPrice: 50, unitCost: 10, totalRevenue: 250, totalCost: 50, totalProfit: 200, marginPercent: 80,
  commercialStatus: 'confirmed', financialTracking: true, legacyPaidCents: 5000, deliveryStatus: 'parcial', items: [
    { id: 'a', productId: 'a', productName: 'Vela A', quantity: 3, unitPrice: 50, unitCost: 10, totalCost: 30, deliveredQuantity: 1, reservedQuantity: 2 },
    { id: 'b', productId: 'b', productName: 'Vela B', quantity: 2, unitPrice: 50, unitCost: 10, totalCost: 20, reservedQuantity: 2 },
  ], deliveryHistory: [{ id: 'old', kind: 'delivery', itemId: 'a', quantity: 1, date: '2026-10-02', unitBusinessCost: 8 }] };
const initial = () => ({ sales: [structuredClone(sale)], products: ['a', 'b'].map(id => ({ ...DEFAULT_PRODUCTS[0], id, currentStock: 10 })),
  materials: [], productions: [], purchases: [], settings: DEFAULT_SETTINGS, finance: emptyFinance(), stockMovements: [] });
const command: Extract<FinanceCommand, { type: 'deliver_items' }> = { type: 'deliver_items', id: 'group', saleId: sale.id, date: '2026-10-28', note: 'Retirada no ateliê', items: [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }] };
const source = initial(), before = JSON.stringify(source);
const partial = applyFinanceCommand(source, command);
assert.equal(JSON.stringify(source), before);
assert.equal(partial.sales[0].deliveryStatus, 'parcial');
assert.deepEqual(partial.sales[0].items!.map(item => [item.deliveredQuantity, item.reservedQuantity]), [[3, 0], [1, 1]]);
assert.deepEqual(partial.products.map(product => product.currentStock), [8, 9]);
assert.equal(partial.sales[0].deliveryHistory!.length, 3);
assert.deepEqual(partial.sales[0].deliveryHistory![0], source.sales[0].deliveryHistory![0]);
assert(partial.sales[0].deliveryHistory!.slice(1).every(event => event.date === command.date && event.note === command.note));
assert.deepEqual(partial.finance, source.finance);
assert.equal(partial.sales[0].totalRevenue, sale.totalRevenue);
assert.equal(partial.sales[0].legacyPaidCents, sale.legacyPaidCents);
assert.equal(applyFinanceCommand(partial, command), partial, 'Repetir a mesma entrega é idempotente');
assert.throws(() => applyFinanceCommand(partial, { ...command, items: [{ itemId: 'a', quantity: 1 }] }), /outros dados/);
const all = applyFinanceCommand(partial, { ...command, id: 'finish', items: [{ itemId: 'b', quantity: 1 }] });
assert.equal(all.sales[0].deliveryStatus, 'entregue');assert.equal(all.sales[0].deliveryActualDate, command.date);
assert.deepEqual(all.products.map(product => product.currentStock), [8, 8]);
assert.equal(all.stockMovements.length, 3);

for (const invalid of [
  { ...command, items: [] },
  { ...command, items: [{ itemId: 'a', quantity: 1 }, { itemId: 'a', quantity: 1 }] },
  { ...command, items: [{ itemId: 'a', quantity: 0 }] },
  { ...command, items: [{ itemId: 'a', quantity: 0.5 }] },
  { ...command, items: [{ itemId: 'a', quantity: NaN }] },
  { ...command, date: '2026-02-31' },
  { ...command, items: [{ itemId: 'b', quantity: 1 }, { itemId: 'a', quantity: 99 }] },
  { ...command, items: [{ itemId: 'b', quantity: 1 }, { itemId: 'missing', quantity: 1 }] },
]) {
  assert.throws(() => applyFinanceCommand(source, invalid));
  assert.equal(JSON.stringify(source), before, 'Falha no segundo item não publica a primeira baixa');
}
for (const status of ['draft', 'cancelled'] as const) assert.throws(() => applyFinanceCommand({ ...source, sales: [{ ...sale, commercialStatus: status }] }, command), /não aceita entregas/);
const returned = initial();
returned.sales[0].items![0].returnedQuantity = 1;
assert.equal(applyFinanceCommand(returned, { ...command, items: [{ itemId: 'a', quantity: 3 }] }).sales[0].items![0].deliveredQuantity, 4, 'Uma peça devolvida pode ser entregue novamente');

// Two lines compete for the same ingredients. No manufacturing or ingredient
// deduction is committed when the second line cannot be delivered.
const shared = { ...initial(), products: structuredClone(autoProducts), materials: autoMaterials.map(material => material.id === 'wax' ? { ...material, currentStock: 70 } : structuredClone(material)), sales: [{ ...sale, items: ['one', 'two'].map(id => ({ id, productId: 'candle', productName: 'Vela teste', quantity: 1, unitPrice: 100, unitCost: 70, totalCost: 70 })) }] };
const sharedBefore = JSON.stringify(shared);
assert.throws(() => applyFinanceCommand(shared, { ...command, items: [{ itemId: 'one', quantity: 1 }, { itemId: 'two', quantity: 1 }] }), /insuficiente/);
assert.equal(JSON.stringify(shared), sharedBefore);
console.log('Entrega de vários itens: saldo por produto, estoque/reservas, histórico e recebimentos preservados; entrega parcial/total; repetição segura; devolução; falha atômica inclusive com insumos compartilhados.');
