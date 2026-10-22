import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { cloudQuotaGuard } from './cloudQuotaGuard';

const disk = new Map<string, any>();
const server = new Map<string, any>();
const reads: string[] = [];
let transactionCalls = 0;
let transactionFailure: { code: string; message: string } | null = null;
const snapshot = (data: any) => ({ exists: () => data !== undefined, data: () => data });
const firestore = {
  doc: (_db: unknown, ...path: string[]) => path.at(-1)!,
  getDocFromCache: async (id: string) => {
    if (!disk.has(id)) throw Error('Cache miss');
    return snapshot(disk.get(id));
  },
  getDocFromServer: async (id: string) => {
    reads.push(id);
    await Promise.resolve();
    if (server.has(id)) disk.set(id, server.get(id));
    return snapshot(server.get(id));
  },
  runTransaction: async (_db: unknown, operation: any, options: any) => {
    assert.equal(options.maxAttempts, 1, 'O SDK não pode repetir cota automaticamente');
    transactionCalls++;
    if (transactionFailure) throw transactionFailure;
    return operation({
    get: async (id: string) => { reads.push(`transaction:${id}`); return snapshot(server.get(id)); },
    set: () => {},
    });
  },
};
const source = fs.readFileSync(new URL('./firestoreRecordAdapter.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports: any = {};
new Function('require', 'exports', compiled)((name: string) => {
  if (name === './cloudQuotaGuard') return { cloudQuotaGuard };
  assert.equal(name, 'firebase/firestore'); return firestore;
}, exports);

const record = 'r4_' + 'a'.repeat(32) + '_1';
server.set(record, { value: { id: 'one', name: 'Vela' } });
let adapter = exports.firestoreRecordAdapter({}, 'test');
await Promise.all([adapter.get(record), adapter.get(record)]);
assert.deepEqual(reads, [record], 'Leituras simultâneas do mesmo registro compartilham a consulta.');
adapter = exports.firestoreRecordAdapter({}, 'test'); // A fresh visit, with no in-memory cache.
assert.equal((await adapter.get(record)).data.value.name, 'Vela');
assert.deepEqual(reads, [record], 'Uma nova visita usa o registro imutável persistido.');
for (const id of ['records_liare_connected_v1', 'liare_connected_v1']) {
  disk.set(id, { revision: 1 }); server.set(id, { revision: 2 });
  assert.equal((await adapter.get(id)).data.revision, 2, 'Índice e proteção da base antiga vêm do servidor.');
  await adapter.transaction(async (context: any) => assert.equal((await context.get(id)).data.revision, 2));
  assert(reads.includes(`transaction:${id}`));
}
const absent = 'r4_' + 'b'.repeat(32) + '_2';
assert.equal(await adapter.get(absent), null);
server.set(absent, { value: { id: 'new' } });
assert.equal((await adapter.get(absent)).data.value.id, 'new', 'Falha/ausência não envenena o cache.');
transactionFailure = { code: 'resource-exhausted', message: 'Free daily write units per project' };
const beforeQuota = transactionCalls;
await assert.rejects(adapter.transaction(async () => null));
await assert.rejects(adapter.transaction(async () => null));
assert.equal(transactionCalls - beforeQuota, 1, 'A cota provoca uma chamada; a nova tentativa é bloqueada antes de chegar ao SDK');
console.log('PASS cache: nova visita sem baixar registro conhecido, consulta simultânea única, índices e transações atualizados no servidor, cache ausente recuperável.');
