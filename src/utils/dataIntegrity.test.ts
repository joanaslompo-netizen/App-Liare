import assert from 'node:assert/strict';
import { inspectDataIntegrity } from './dataIntegrity';
import type { Material, Product, Sale } from '../types';
const data = {
  materials: [{ id: 'wax', name: 'Cera', currentStock: 10, unitCost: 2 }, { id: 'direct', name: 'Avulso', materialType: 'for_sale', currentStock: 1, unitCost: 5 }] as Material[],
  products: [{ id: 'candle', name: 'Vela', items: [{ type: 'material', targetId: 'wax', quantity: 2, unitCost: 2 }, { type: 'material', targetId: 'category:aromas', selectionMode: 'category', quantity: 1, unitCost: 3 }] }] as Product[],
  sales: [{ id: 'order', items: [{ productId: 'candle', quantity: 1 }, { productId: '', isCustom: true, quantity: 1 }, { productId: 'direct', quantity: 1 }], totalRevenue: 25 }] as Sale[],
};
const before = JSON.stringify(data);
assert.deepEqual(inspectDataIntegrity(data), []);
assert.equal(JSON.stringify(data), before);
const broken = { ...data, materials: [{ ...data.materials[0], currentStock: NaN }], products: [{ ...data.products[0], parentRecipeId: 'absent', items: [{ type: 'material', targetId: 'missing', name: 'Insumo', quantity: -1, unitCost: 0 }] }] as Product[] };
const codes = new Set(inspectDataIntegrity(broken).map((issue) => issue.code));
for (const code of ['invalid-number', 'negative-number', 'missing-base', 'missing-ingredient', 'missing-order-product']) assert(codes.has(code));
assert.deepEqual(inspectDataIntegrity({}), []);
assert(Number.isNaN(broken.materials[0].currentStock));
console.log('Integridade: categorias, personalizados e venda direta válidos; problemas detectados sem alterar dados.');
