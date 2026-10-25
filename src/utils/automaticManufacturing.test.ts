import assert from 'node:assert/strict';
import { planAutomaticConsumption } from './automaticManufacturing';
import { buildProductionBatch, getProductionPlan, aggregateProductionDeductions } from './productionPlanning';
import { applyFinanceCommand, emptyFinance } from './financeLedger';
import { DEFAULT_SETTINGS } from './storage';
import type { Sale } from '../types';
import { autoMaterials, autoProducts, ingredient } from '../../scripts/automaticManufacturingFixtures';
const before=JSON.stringify({autoMaterials,autoProducts});
const plan=getProductionPlan(autoProducts[1],1,autoMaterials,autoProducts);
const quantity=(id:string)=>plan.deductions.find(item=>item.targetId===id)?.quantityTotal || 0;
assert.equal(quantity('decoration'),1);
assert.equal(quantity('blend'),20);
assert.equal(quantity('wax'),36);
assert.equal(quantity('aroma'),4);
assert.equal(plan.hasStockShortage,false);
assert.equal(plan.automaticManufacturing.find(event=>event.targetId==='decoration')?.quantity,1);
assert.equal(plan.automaticManufacturing.find(event=>event.targetId==='blend')?.quantity,40);
assert.equal(JSON.stringify({autoMaterials,autoProducts}),before,'Simular não muda estoque nem histórico');
const batch=buildProductionBatch([plan,plan],'2026-10-23','',true);
const total=aggregateProductionDeductions([plan,plan],true);
assert.equal(total.find(item=>item.targetId==='wax')?.quantityTotal,99,'Duas produções compartilham o mesmo saldo de componentes');
assert.equal(batch[1].deductedItems.find(item=>item.targetId==='wax')?.stockBefore,64);
assert.equal(batch[1].deductedItems.find(item=>item.targetId==='wax')?.stockAfter,1);
assert.equal(batch[0].automaticManufacturing?.length,2);
const missing=getProductionPlan(autoProducts[1],1,autoMaterials.map(material=>material.id==='wax'?{...material,currentStock:35}:material),autoProducts);
assert(missing.hasStockShortage,'A falta real aparece nos materiais básicos');
const cycle=autoMaterials.map(material=>material.id==='blend'?{...material,currentStock:0,recipeItems:[ingredient('blend','material',100)]}:material);
assert(planAutomaticConsumption([ingredient('blend','material',10)],cycle,autoProducts).errors.some(error=>/circular/.test(error)));
const invalid=autoMaterials.map(material=>material.id==='blend'?{...material,currentStock:0,batchYield:0}:material);
assert(planAutomaticConsumption([ingredient('blend','material',10)],invalid,autoProducts).errors.some(error=>/rendimento/.test(error)));

const sale: Sale={id:'sale',date:'2026-10-23',productId:'candle',productName:'Vela',quantity:1,unitPrice:100,unitCost:70,totalRevenue:100,totalCost:70,totalProfit:30,marginPercent:30,createdAt:'2026-10-23',items:[{id:'row',productId:'candle',productName:'Vela',quantity:1,unitPrice:100,unitCost:70,totalCost:70}]};
const initial=()=>({sales:[] as Sale[],products:structuredClone(autoProducts),materials:structuredClone(autoMaterials),productions:[],settings:DEFAULT_SETTINGS,finance:emptyFinance(),stockMovements:[]});
let workspace=applyFinanceCommand(initial(),{type:'save_order',sale});
assert.equal(workspace.materials[0].currentStock,100,'Salvar pedido não fabrica nem consome');
const delivery={type:'deliver' as const,saleId:'sale',itemId:'row',quantity:1,date:'2026-10-23',id:'delivery',kind:'delivery' as const};
workspace=applyFinanceCommand(workspace,delivery);
assert.equal(workspace.materials[0].currentStock,64);
assert.equal(workspace.materials[1].currentStock,96);
assert.equal(workspace.materials[2].currentStock,0);
assert.equal(workspace.products[0].currentStock,0);
assert.equal(workspace.products[1].currentStock,0);
assert.equal(workspace.stockMovements.filter(movement=>movement.reason==='Produção automática').length,3);
for(const id of ['wax','aroma','blend','decoration','candle']){
  const original=autoMaterials.find(value=>value.id===id) || autoProducts.find(value=>value.id===id)!;
  const current=workspace.materials.find(value=>value.id===id) || workspace.products.find(value=>value.id===id)!;
  assert.equal((original.currentStock||0)+workspace.stockMovements.filter(movement=>movement.targetId===id).reduce((sum,movement)=>sum+movement.quantity,0),current.currentStock,`Histórico corresponde ao saldo de ${id}`);
}
const snapshot=JSON.stringify(workspace);
workspace=applyFinanceCommand(workspace,delivery);
assert.equal(JSON.stringify(workspace),snapshot,'Repetir a entrega não fabrica nem consome duas vezes');
workspace=applyFinanceCommand(workspace,{...delivery,id:'return',kind:'return',restock:true});
assert.equal(workspace.products[1].currentStock,1);
assert.equal(workspace.materials[0].currentStock,64,'Devolver a vela não desfaz sua fabricação real');
let shortage=applyFinanceCommand(initial(),{type:'save_order',sale});
shortage.materials[0].currentStock=35;
const shortageBefore=JSON.stringify(shortage);
assert.throws(()=>applyFinanceCommand(shortage,delivery),/insuficiente/);
assert.equal(JSON.stringify(shortage),shortageBefore,'Falha não deixa consumo parcial');
const inProgress={...buildProductionBatch([getProductionPlan(autoProducts[1],1,autoMaterials,autoProducts)],'2026-10-23','',true)[0],status:'in_progress' as const};
assert.throws(()=>applyFinanceCommand({...applyFinanceCommand(initial(),{type:'save_order',sale}),productions:[inProgress]},delivery),/andamento/);

const customSale: Sale = {
  ...sale, productId: 'custom_placeholder', productName: 'Personalizado avulso', quantity: 3,
  totalRevenue: 300, totalCost: 0, unitCost: 0,
  items: [{ ...sale.items![0], productId: 'custom_placeholder', productName: 'Personalizado avulso',
    isCustom: true, quantity: 3, unitCost: 0, totalCost: 0 }],
};
for (const composition of [undefined, []]) {
  let custom = applyFinanceCommand(initial(), { type: 'save_order', sale: {
    ...customSale, items: customSale.items!.map(item => ({ ...item, customRecipeItems: composition })),
  } });
  const beforeDelivery = JSON.stringify(custom);
  const original = custom;
  custom = applyFinanceCommand(custom, delivery);
  assert.equal(JSON.stringify(original), beforeDelivery, 'Entrega não modifica a base de origem');
  const customId = custom.sales[0].items![0].customProductId!;
  assert(customId);
  assert.equal(custom.sales[0].deliveryStatus, 'parcial');
  assert.equal(custom.sales[0].items![0].customProducedQuantity, 1);
  assert.equal(custom.sales[0].items![0].stockConsumedQuantity, 1);
  assert.equal(custom.sales[0].items![0].costIncomplete, true, 'Sem composição, custo continua incompleto');
  assert.equal(custom.products.find(product => product.id === customId)!.currentStock, 0);
  assert.equal(custom.products.find(product => product.id === customId)!.isCustomRecipe, true);
  assert.deepEqual(custom.materials, original.materials, 'Sem composição, não desconta materiais');
  assert.deepEqual(custom.finance, original.finance, 'Entregar não registra pagamento');
  assert.deepEqual(custom.stockMovements.filter(move => move.targetId === customId).map(move => move.quantity), [1, -1]);
  assert.equal(applyFinanceCommand(custom, delivery), custom, 'Repetição não fabrica nem entrega duas vezes');
  custom = applyFinanceCommand(custom, { ...delivery, id: 'custom_final', quantity: 2 });
  assert.equal(custom.sales[0].deliveryStatus, 'entregue');
  assert.equal(custom.sales[0].items![0].customProductId, customId);
  assert.equal(custom.sales[0].items![0].customProducedQuantity, 3);
  assert.equal(custom.products.filter(product => product.isCustomRecipe).length, 1);
  assert.throws(() => applyFinanceCommand(custom, { ...delivery, id: 'too_many' }), /saldo/);
  custom = applyFinanceCommand(custom, { ...delivery, id: 'custom_return', kind: 'return', restock: true });
  assert.equal(custom.products.find(product => product.id === customId)!.currentStock, 1);
  custom = applyFinanceCommand(custom, { ...delivery, id: 'custom_redelivery' });
  assert.equal(custom.sales[0].deliveryStatus, 'entregue');
  assert.equal(custom.sales[0].items![0].customProducedQuantity, 3, 'Peça devolvida usa estoque sem nova fabricação');
  assert.equal(custom.products.find(product => product.id === customId)!.currentStock, 0);
  assert.equal(custom.stockMovements.filter(move => move.targetId === customId).reduce((sum, move) => sum + move.quantity, 0), 0);
}

// A custom composition gets the same nested manufacturing and stock validation as a catalog recipe.
const withComposition = applyFinanceCommand(initial(), { type: 'save_order', sale: {
  ...customSale, items: customSale.items!.map(item => ({ ...item, customRecipeItems: autoProducts[1].items })),
} });
const customMade = applyFinanceCommand(withComposition, delivery);
assert.equal(customMade.materials[0].currentStock, 64);
assert.equal(customMade.materials[1].currentStock, 96);
assert.equal(customMade.products.find(product => product.id === customMade.sales[0].items![0].customProductId)!.currentStock, 0);
const insufficient = { ...withComposition, materials: withComposition.materials.map(material => ({ ...material, currentStock: 0 })) };
const insufficientBefore = JSON.stringify(insufficient);
assert.throws(() => applyFinanceCommand(insufficient, delivery), /insuficiente/);
assert.equal(JSON.stringify(insufficient), insufficientBefore, 'Falha não cria receita avulsa nem baixa parcialmente');

const emptyCatalog = applyFinanceCommand({ ...initial(), products: autoProducts.map(product => ({ ...product, items: [] })) }, { type: 'save_order', sale });
assert.throws(() => applyFinanceCommand(emptyCatalog, delivery), /insuficiente/, 'A exceção sem composição é restrita aos personalizados');
const missingCatalog = applyFinanceCommand({ ...initial(), products: [] }, { type: 'save_order', sale });
assert.throws(() => applyFinanceCommand(missingCatalog, delivery), /não encontrado/);
console.log('PASS fabricação automática: estoque parcial, receitas aninhadas, lote compartilhado, falta real, ciclos, simulação sem escrita, entrega idempotente, devolução e histórico exato.');
