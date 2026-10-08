import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as storage from '../src/utils/storage';
import { ensureOrderNumbers } from '../src/utils/orderNumbers';

const path = process.argv[2];
if (!path) throw new Error('Informe o caminho de uma cópia do backup JSON.');
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
}, configurable: true });
const writers = {
  materials: storage.saveMaterials, products: storage.saveProducts,
  purchases: storage.savePurchases, productions: storage.saveProductions,
  sales: storage.saveSales, customers: storage.saveCustomers,
  paymentMethods: storage.savePaymentMethods, suppliers: storage.saveSuppliers,
  todos: storage.saveTodos, projects: storage.saveProjects,
};
for (const [key, writer] of Object.entries(writers)) {
  assert(Array.isArray(data[key]), `Coleção inválida: ${key}`);
  writer(data[key]);
}
assert(data.settings && typeof data.settings === 'object');
storage.saveSettings(data.settings);
const reloaded = storage.loadStoredData();
for (const key of Object.keys(writers)) {
  assert.equal(reloaded[key].length, data[key].length, `Contagem alterada: ${key}`);
  for (let index = 0; index < data[key].length; index++) {
    // Existing loader fills missing stock defaults; all original fields must survive.
    for (const field of Object.keys(data[key][index])) {
      assert.deepEqual(reloaded[key][index][field], data[key][index][field], `${key}[${index}].${field}`);
    }
  }
}
assert.deepEqual(reloaded.settings, data.settings);
const numbered = ensureOrderNumbers(reloaded.sales, data.settings.lastOrderNumber || 0);
for (let index = 0; index < data.sales.length; index++) {
  if (data.sales[index].orderNumber) assert.equal(numbered[index].orderNumber, data.sales[index].orderNumber);
}
assert.deepEqual(storage.loadStoredData(), reloaded, 'Segunda abertura alterou dados');
console.log('Backup restaurado em memória: todas as coleções, campos originais, números de pedido e segunda abertura preservados.');
