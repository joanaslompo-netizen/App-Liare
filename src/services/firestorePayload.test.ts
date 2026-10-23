import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, getFirestore, terminate, writeBatch } from 'firebase/firestore';
import { createRecordStore, decodeRecordHead, HEAD_ID, LEGACY_ID, PREVIOUS_HEAD_ID, type RecordAdapter, type StoreWrite, type WriteContext } from './workspaceRecordStore';
import { applyFinanceCommand, type FinanceCommand } from '../utils/financeLedger';
import { DEFAULT_SETTINGS } from '../utils/storage';
import { autoMaterials, autoProducts } from '../../scripts/automaticManufacturingFixtures';
import { buildProductionBatch, getProductionPlan } from '../utils/productionPlanning';

// Use the installed SDK's real write parser, without committing or contacting a
// server. A permissive transaction mock missed the nested-array regression.
const app = initializeApp({ projectId: 'payload-validation-only' }, 'payload-validation-only');
const db = getFirestore(app);
function validate(id: string, data: any) {
  writeBatch(db).set(doc(db, 'users', 'payload-owner', 'workspaces', id), data);
}
assert.throws(() => validate('bad-head', { recordRows: [[0, 'id', 'doc', 'digest']] }), /Nested arrays are not supported/);
class SDKCheckedMemoryAdapter implements RecordAdapter {
  docs = new Map<string, any>();
  async get(id: string) { return this.docs.has(id) ? { data: structuredClone(this.docs.get(id)) } : null; }
  async transaction<T>(operation: (context: WriteContext) => Promise<T>): Promise<T> {
    const pending: StoreWrite[] = [];
    const result = await operation({ get: id => this.get(id), set: write => { validate(write.id, write.data); pending.push(write); } });
    for (const write of pending) this.docs.set(write.id, structuredClone(write.data));
    return result;
  }
}
try {
  const adapter = new SDKCheckedMemoryAdapter();
  const original: any = { userId: 'payload-owner', revision: 71, version: 3, updatedAt: '2026-10-23T00:00:00Z',
    materials: [{ id: 'bag', name: 'Sacola de papel', unit: 'un', packageUnit: 'un', packageQuantity: 3, packagePrice: 60, unitCost: 20, currentStock: 5 }],
    products: [], purchases: [], sales: [], settings: DEFAULT_SETTINGS, finance: { version: 1, entries: [], bills: [] }, stockMovements: [],
  };
  adapter.docs.set(LEGACY_ID, structuredClone(original));
  const store = createRecordStore(adapter, 'payload-owner');
  const command: FinanceCommand = { type: 'purchase', updateStock: true, paidNow: false, dueDate: '2026-11-06', account: 'Principal',
    purchase: { id: 'purchase-test', date: '2026-10-23', supplierName: 'Fornecedor teste', shippingCost: 0, totalAmount: 60, createdAt: '2026-10-23',
      items: [{ materialId: 'bag', materialName: 'Sacola de papel', quantity: 1, unit: 'un', packagePrice: 60, totalPrice: 60 }] },
  };
  const saved = await store.mutate(data => applyFinanceCommand(data, command), 71);
  assert.equal(saved.materials[0].currentStock, 8);
  assert.equal(saved.purchases.length, 1);
  assert.equal(saved.finance.bills[0].amountCents, 6000);
  assert.deepEqual((await store.previous())!.data, original);
  assert.deepEqual((await store.read())!.data, saved);
  await store.mutate(data => ({ ...data, settings: { ...data.settings, hourlyRate: 36 } }), saved.revision);
  validate(PREVIOUS_HEAD_ID, adapter.docs.get(PREVIOUS_HEAD_ID));
  const head = adapter.docs.get(HEAD_ID);
  assert(head.recordRows.every((row: any) => typeof row === 'string'));
  assert.deepEqual(decodeRecordHead({ ...head, recordRows: head.recordRows.map(JSON.parse) }, 'payload-owner'), decodeRecordHead(head, 'payload-owner'), 'Previous tuple representation remains readable');
  assert.throws(() => decodeRecordHead({ ...head, recordRows: ['broken JSON'] }, 'payload-owner'), /inválida/);
  assert.deepEqual(adapter.docs.get(LEGACY_ID), original);
  let current = (await store.read())!.data;
  current = await store.mutate(data => applyFinanceCommand(data, { type: 'save_account', account: { id: 'bank', name: 'Conta teste' }, date: '2026-01-01', openingBalanceCents: 100000 }), current.revision);
  current = await store.mutate(data => applyFinanceCommand(data, { type: 'save_card', card: { id: 'card', name: 'Cartão teste', closingDay: 25, dueDay: 31, paymentAccount: 'bank' } }), current.revision);
  current = await store.mutate(data => applyFinanceCommand(data, { ...command, purchase: { ...command.purchase, id: 'card-purchase' }, cardId: 'card', installments: 3, dueDate: '2026-10-31' }), current.revision);
  assert.deepEqual((await store.read())!.data, current, 'Contas, cartões e parcelas também passam no parser real e sobrevivem à reconstrução');
  const production = buildProductionBatch([getProductionPlan(autoProducts[1], 1, autoMaterials, autoProducts)], '2026-10-23', '', true)[0];
  current = await store.mutate(data => ({ ...data, productions: [production] }), current.revision);
  assert.deepEqual((await store.read())!.data.productions[0].automaticManufacturing, production.automaticManufacturing, 'Histórico da fabricação automática passa no SDK real');
  console.log('PASS SDK real: compra, estoque, conta a pagar, manifesto atual/anterior e leitura exata; formato antigo recusado pelo SDK, novo formato aceito sem conexão nem commit real.');
} finally {
  await terminate(db);
  await deleteApp(app);
}
