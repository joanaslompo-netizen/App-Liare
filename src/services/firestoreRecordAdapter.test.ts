import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const disk = new Map<string, any>();
const server = new Map<string, any>();
const reads: string[] = [];
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
  runTransaction: async (_db: unknown, operation: any) => operation({
    get: async (id: string) => { reads.push(`transaction:${id}`); return snapshot(server.get(id)); },
    set: () => {},
  }),
};
const source = fs.readFileSync(new URL('./firestoreRecordAdapter.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports: any = {};
new Function('require', 'exports', compiled)((name: string) => {
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
console.log('PASS cache: nova visita sem baixar registro conhecido, consulta simultânea única, índices e transações atualizados no servidor, cache ausente recuperável.');
