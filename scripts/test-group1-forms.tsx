import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => { throw Error(message); }, confirm: () => { throw Error('Confirmação inesperada'); }, requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
const { createRoot } = await import('react-dom/client');
const { PurchasesView } = await import('../src/components/PurchasesView');
const { HomeView } = await import('../src/components/HomeView');
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { MaterialsView } = await import('../src/components/MaterialsView');
const { ProductsView } = await import('../src/components/ProductsView');
const { SalesView } = await import('../src/components/SalesView');
const { DEFAULT_MATERIALS, DEFAULT_PRODUCTS, DEFAULT_SETTINGS } = await import('../src/utils/storage');
const noop = () => {};
let root = createRoot(document.querySelector('#root')!);
async function render(node: React.ReactNode) { await act(async () => root.render(node)); }
async function click(selector: string) { const node = document.querySelector(selector); assert(node, selector); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); }
async function submit() { const form = document.querySelector('.liare-form-dialog form'); assert(form); await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))); }
async function reset() { await act(async () => root.unmount()); root = createRoot(document.querySelector('#root')!); }
for (const usageType of ['consumable','durable']) {
  const material = { ...DEFAULT_MATERIALS[0], id: 'test', usageType, currentStock: 13, notes: 'Preservar', legacyData: { value: 42 }, durableDimensions: usageType === 'durable' ? '12 x 5 cm' : undefined, supplierId: 'supplier', supplierName: 'Fornecedor Teste' };
  let saved: any;
  await render(<MaterialsView materials={[material as any]} suppliers={[{id:'supplier',name:'Fornecedor Teste',createdAt:'2026-01-01'}]} onSaveMaterial={value => {saved=value;}} onDeleteMaterial={noop} onQuickStockChange={noop} />);
  await click('#btn-edit-material-test');
  assert(document.querySelectorAll('details:not([open])').length > 0);
  await submit(); assert(saved); assert.equal(saved.currentStock,13); assert.equal(saved.notes,'Preservar'); assert.equal(saved.supplierId,'supplier'); assert.deepEqual(saved.legacyData,material.legacyData);
  if (usageType === 'durable') assert.equal(saved.durableDimensions,material.durableDimensions);
  await reset();
}
const product = { ...DEFAULT_PRODUCTS[0], id: 'test', currentStock: 7, minStock: 2, standardStock: 11, notes:'Detalhe salvo', actualPrice:55, isCustomRecipe:true, legacyData:{ value:43 } };
let savedProduct: any;
await render(<ProductsView products={[product]} materials={DEFAULT_MATERIALS} defaultHourlyRate={35} defaultFixedCostPercent={10} defaultProfitMargin={45} onSaveProduct={value=>{savedProduct=value;}} onDeleteProduct={noop} onDuplicateProduct={noop} />);
// As personalizadas ficam fora do catálogo e continuam acessíveis pela área secundária.
assert.equal(document.querySelector('#btn-edit-product-test'),null);
await act(async()=>{ const buttons=[...document.querySelectorAll('button')]; buttons.find(button=>button.textContent?.includes('Personalizadas ('))!.click(); });
await click('#btn-edit-product-test');
await submit(); assert(savedProduct); for (const field of ['currentStock','minStock','standardStock','notes','actualPrice','isCustomRecipe','legacyData']) assert.deepEqual(savedProduct[field],product[field]);
await reset();
const sale = { id:'order-test',date:'2026-01-01',orderNumber:123,productId:product.id,productName:product.name,quantity:1,unitPrice:55,unitCost:5,totalRevenue:55,totalCost:5,totalProfit:50,customerName:'Cliente Teste',paymentMethod:'PIX',paymentStatus:'pago',deliveryStatus:'entregue',orderType:'pronta_entrega',amountPaid:55,createdAt:'2026-01-01',legacyData:{ value:44 },items:[{id:'row',productId:product.id,productName:product.name,quantity:1,unitPrice:55,unitCost:5,totalCost:5,stockConsumedQuantity:1}] };
let savedSale:any;
await render(<SalesView settings={DEFAULT_SETTINGS} sales={[sale as any]} products={[product]} materials={DEFAULT_MATERIALS} customers={[]} paymentMethods={['PIX']} discountCodes={[]} initialSaleId={sale.id} onSaveSale={value=>{savedSale=value;}} onReserveSaleItem={()=>null} onReleaseSaleItemReservation={()=>null} onProduceCustomItem={()=>null} onDeleteSale={noop} onSaveCustomer={noop} onAddPaymentMethod={noop} />);
assert(document.querySelector('.liare-form-dialog')); await submit(); assert(savedSale); assert.deepEqual(savedSale.legacyData,sale.legacyData); assert.equal(savedSale.orderNumber,sale.orderNumber); await reset();
console.log('Formulários: salvar com Mais opções recolhidas preserva estoque, notas, fornecedor, durável, preço, personalizado, número e campos antigos.');

async function fill(selector: string, value: string) {
  const node = document.querySelector(selector) as HTMLInputElement; assert(node);
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
let savedPurchase: any;
await render(<PurchasesView purchases={[]} materials={[DEFAULT_MATERIALS[0]]} suppliers={[]} onSavePurchase={value=>{savedPurchase=value;}} onDeletePurchase={noop} />);
await act(async()=>{ [...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Registrar Compra'))!.click(); });
await fill('[aria-label="Nome do fornecedor avulso"]','Loja Avulsa');
await act(async()=>{ (document.querySelector('#combobox-material-search') as HTMLInputElement).focus(); });
await click('ul li'); await click('#btn-insert-purchase-item'); await submit();
assert(savedPurchase); assert.equal(savedPurchase.supplierName,'Loja Avulsa'); assert.equal(savedPurchase.supplierId,undefined); assert.equal(savedPurchase.items.length,1); await reset();
const homeSales = [
  {...sale,id:'later',customerName:'Entrega Tardia',deliveryStatus:'pendente_entrega',deliveryScheduledDate:'2026-12-15',paymentStatus:'pendente_pagamento',amountPaid:20},
  {...sale,id:'sooner',customerName:'Entrega Próxima',deliveryStatus:'pendente_entrega',deliveryScheduledDate:'2026-12-01',paymentStatus:'pendente_pagamento',amountPaid:55},
];
const opened: string[] = [];
await render(<HomeView artisanName="Teste" atelierName="Teste" materials={[]} products={[product]} purchases={[]} sales={homeSales as any} todos={[]} onUpdateTodos={noop} onNavigate={noop} onOpenSale={id=>opened.push(id)} />);
const deliverySection = [...document.querySelectorAll('section')].find(section=>section.textContent?.includes('Próximas entregas'))!;
const deliveryButtons = [...deliverySection.querySelectorAll('button')].filter(button=>button.textContent?.includes('Entrega '));
assert.equal(deliveryButtons.length,2); assert(deliveryButtons[0].textContent?.includes('Entrega Próxima'));
await act(async()=>{deliveryButtons[0].click();}); assert.deepEqual(opened,['sooner']);
const receiptButton = [...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Entrega Tardia') && button.textContent?.includes('35,00'));
assert(receiptButton); await act(async()=>{receiptButton.click();}); assert.deepEqual(opened,['sooner','later']);
assert(![...document.querySelectorAll('button')].some(button=>button.textContent?.includes('Entrega Próxima') && button.textContent?.includes('0,00')));
await reset();
console.log('Fluxos: fornecedor avulso salvo, entregas em ordem e saldo parcial abre o pedido exato; pedido quitado fora das cobranças.');
