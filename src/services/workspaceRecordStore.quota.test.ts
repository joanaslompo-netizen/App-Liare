import assert from 'node:assert/strict';
import { createRecordStore, canonicalJSON, digest, splitWorkspace, HEAD_ID, LEGACY_ID, PREVIOUS_HEAD_ID, decodeRecordHead, type RecordAdapter } from './workspaceRecordStore';

class MemoryAdapter implements RecordAdapter {
  docs = new Map<string, any>();
  batches: any[][] = [];
  reads = 0;
  async get(id: string) { this.reads++; return this.docs.has(id) ? { data: structuredClone(this.docs.get(id)) } : null; }
  async transaction<T>(operation: any): Promise<T> {
    const writes: any[] = [];
    const result = await operation({ get: (id: string) => this.get(id), set: (write: any) => writes.push(structuredClone(write)) });
    for (const write of writes) { assert(!write.createOnly || !this.docs.has(write.id)); this.docs.set(write.id, write.data); }
    if (writes.length) this.batches.push(writes);
    return result;
  }
}
const uid = 'quota-audit';
const original: any = {
  userId: uid, version: 3, revision: 71, updatedAt: '2026-10-01', lastModifiedBy: 'Web',
  materials: Array.from({ length: 100 }, (_, i) => ({ id: `material_${i}`, currentStock: i, unitCost: .1 })),
  products: Array.from({ length: 65 }, (_, i) => ({ id: `product_${i}`, name: `Vela ${i}`, currentStock: 5, actualPrice: 86, imageUrl: 'data:image/jpeg;base64,' + 'a'.repeat(12000), notes: 'Preservar ç e 🌷', oldField: true })),
  sales: Array.from({ length: 117 }, (_, i) => ({ id: `order_${i}`, notes: 'histórico'.repeat(50), amountPaid: i })),
  productions: [], purchases: [], customers: [], suppliers: [], todos: [], stockMovements: [], projects: [],
  settings: { hourlyRate: 35 }, paymentMethods: ['PIX'], finance: { version: 1, entries: [], bills: [] }, futureField: { keep: [null, false, 1] },
};
const adapter = new MemoryAdapter();
adapter.docs.set(LEGACY_ID, structuredClone(original));
// Seed the published v4 layout, independently of the new writer.
const split = splitWorkspace(original);
const records = await Promise.all(split.values.map(async item => {
  const documentId = `r4_${(await digest([item.section, item.id])).slice(0, 32)}_71`;
  adapter.docs.set(documentId, { userId: uid, version: 4, storageSchema: 4, section: item.section, recordId: item.id, value: structuredClone(item.value) });
  return { section: item.section, id: item.id, documentId, digest: await digest(item.value) };
}));
const oldHead: any = { userId: uid, version: 4, storageSchema: 4, revision: 71, updatedAt: original.updatedAt, lastModifiedBy: 'Web', legacyDigest: await digest(original), header: split.header, sections: split.sections, records };
adapter.docs.set(HEAD_ID, oldHead);
const store = createRecordStore(adapter, uid);
assert.deepEqual((await store.read())!.data, original, 'Reader preserves all existing v4 data');
await store.mutate(data => data, 71);
assert.equal(adapter.batches.length, 0, 'Opening/no-op does not migrate or write');
await store.mutate(data => Object.fromEntries(Object.entries(data).reverse()), 71);
assert.equal(adapter.batches.length, 0, 'Different object-field order causes zero writes');

const changed = structuredClone(original);
changed.products[0].currentStock = 6;
delete changed.products[0].oldField;
const baselineBytes = Buffer.byteLength(canonicalJSON(oldHead)) * 2 + Buffer.byteLength(canonicalJSON({ value: changed.products[0] }));
const migrated = await store.mutate(() => changed, 71);
const writes = adapter.batches.at(-1)!;
const newBytes = writes.reduce((sum, write) => sum + Buffer.byteLength(canonicalJSON(write.data)), 0);
assert(newBytes < baselineBytes * .75, `${newBytes}/${baselineBytes}: the first v4-to-v5 write still preserves the full previous v4 manifest`);
const payload = writes.find(write => /^r5_/.test(write.id)).data;
assert.equal(payload.encoding, 'delta');
assert.equal(payload.changes.currentStock, 6);
assert(!canonicalJSON(writes).includes('data:image/'), 'Updating stock does not resend an unchanged photo');
assert.deepEqual((await store.previous())!.data, original);
const expected = { ...changed, ...splitWorkspace(migrated).header };
assert.deepEqual((await store.read())!.data, expected, 'Compact manifest and delta restore exact logical data');
assert.equal(adapter.docs.get(HEAD_ID).storageSchema, 5);
assert(!adapter.docs.get(HEAD_ID).records, 'The wire manifest uses compact rows');
assert.deepEqual(adapter.docs.get(LEGACY_ID), original, 'Original is untouched');

let current = (await store.read())!.data;
for (let i = 0; i < 7; i++) {
  const previous = structuredClone(current);
  current = await store.mutate(data => ({ ...data, products: data.products.map((p: any, index: number) => index ? p : { ...p, currentStock: p.currentStock + 1 }) }), current.revision);
  assert.deepEqual((await store.previous())!.data, previous, 'Every previous revision remains restorable');
  const loaded = (await store.read())!.data;
  assert.equal(loaded.products[0].imageUrl, original.products[0].imageUrl);
  assert.equal(loaded.products[0].notes, original.products[0].notes);
  assert(!Object.hasOwn(loaded.products[0], 'oldField'));
  assert.deepEqual(loaded.sales, original.sales);
  const head = decodeRecordHead(adapter.docs.get(HEAD_ID), uid);
  assert(head.records.every(ref => (ref.depth || 0) <= 4));
}
const replacement = 'data:image/jpeg;base64,' + 'b'.repeat(12000);
current = await store.mutate(data => ({ ...data, products: data.products.map((p: any, index: number) => index ? p : { ...p, imageUrl: replacement }) }), current.revision);
assert.equal((await store.read())!.data.products[0].imageUrl, replacement, 'A changed photo is stored, never dropped');

// Corrupt an inherited base; integrity checks must refuse to reconstruct it.
current = await store.mutate(data => ({ ...data, products: data.products.map((p: any, index: number) => index ? p : { ...p, currentStock: p.currentStock + 1 }) }), current.revision);
const head = decodeRecordHead(adapter.docs.get(HEAD_ID), uid);
const ref = head.records.find(ref => ref.section === 'products' && ref.id === 'product_0')!;
const delta = adapter.docs.get(ref.documentId);
assert.equal(delta.encoding, 'delta');
const base = adapter.docs.get(delta.baseDocumentId);
adapter.docs.set(delta.baseDocumentId, { ...base, value: { ...base.value, imageUrl: 'corrupted' } });
await assert.rejects(store.read(), /ausente|inválid/);
adapter.docs.set(delta.baseDocumentId, base);
adapter.docs.set(ref.documentId, { ...delta, baseDocumentId: ref.documentId });
await assert.rejects(store.read(), /versões inválida/);
adapter.docs.set(ref.documentId, delta);
assert.deepEqual((await store.read())!.data.sales, original.sales);
assert(adapter.docs.has(PREVIOUS_HEAD_ID));
console.log(`PASS quota protocol: v4 compatibility, v5 exact reconstruction, compact manifests, delta photos, bounded chains, history, field deletion, image replacement and corruption. Single-stock payload ${baselineBytes} -> ${newBytes} bytes (${(100 * (1 - newBytes / baselineBytes)).toFixed(1)}% less; synthetic 286-record workload).`);
