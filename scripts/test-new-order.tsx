import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,alert:(m:string)=>{throw Error(m)},confirm:()=>true});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
const {createRoot}=await import('react-dom/client');
const {SalesView}=await import('../src/components/SalesView');
const {DEFAULT_SETTINGS,DEFAULT_PRODUCTS,DEFAULT_MATERIALS}=await import('../src/utils/storage');
const product={...DEFAULT_PRODUCTS[0],id:'p',name:'Vela teste',actualPrice:50,isIntermediate:false,isCustomRecipe:false,productFamily:undefined,fragrance:undefined};
const material={...DEFAULT_MATERIALS[0],id:'m',name:'Insumo teste',unitCost:2,isVirtualRecipe:false};
let saved:any;const root=createRoot(document.querySelector('#root')!);const noop=()=>{};
await act(async()=>root.render(<SalesView settings={DEFAULT_SETTINGS} sales={[]} products={[product]} materials={[material]} customers={[]} paymentMethods={['PIX']} discountCodes={[{id:'coupon',code:'AMOR10',type:'percentage',value:10,active:true,createdAt:'2026-10-16'}]} openNewSaleSignal={1} onSaveSale={v=>{saved=v}} onDeleteSale={noop} onReserveSaleItem={()=>null} onReleaseSaleItemReservation={()=>null} onProduceCustomItem={()=>null} onSaveCustomer={noop} onAddPaymentMethod={noop}/>));
const page=()=>document.querySelector('.liare-new-order')!;
async function click(text:string){const el=[...page().querySelectorAll('button')].find(e=>e.textContent?.trim()===text);assert(el,`Botão ${text}`);await act(async()=>el.click());}
async function fill(label:string,value:string){const el=page().querySelector(`[aria-label="${label}"]`) as HTMLInputElement;assert(el,label);await act(async()=>{const proto=el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function input(selector:string,value:string){const el=page().querySelector(selector) as HTMLInputElement;assert(el,selector);await act(async()=>{el.focus();Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
async function labelCheck(text:string){const label=[...page().querySelectorAll('label')].find(el=>el.textContent?.includes(text));assert(label,text);await act(async()=>label.querySelector('input')!.click());}
async function search(selector:string,text:string){await input(selector,text);const option=[...page().querySelectorAll('li')].find(el=>el.textContent?.includes(text));assert(option,text);await act(async()=>option.click());}
assert(page());assert(!document.querySelector('.liare-form-dialog'));
await fill('Nome avulso','Cliente do teste');await fill('Telefone / WhatsApp','Contato teste');await fill('Data do pedido','2026-10-15');await fill('Canal de venda','WhatsApp');await click('Encomenda / PedidoProduzir para entregar depois');await fill('Data programada para entrega','2026-10-20');
await click('Continuar para produtos');await search('#order-product-search-combobox','Vela teste');await fill('Quantidade do produto','2');await fill('Preço do produto','60');
await click('Conferir pedido');assert(page().querySelector('[role="alert"]')?.textContent?.includes('em preenchimento'));assert(!saved);
await click('Adicionar');await labelCheck('Personalizado');await fill('Nome do item personalizado','Peça exclusiva');await fill('Quantidade personalizada','3');await fill('Preço personalizado','20');
const materialSearch=page().querySelector('input[placeholder*="material" i]') as HTMLInputElement;assert(materialSearch);
await search(`#${materialSearch.id}`,'Insumo teste');
// A selected material must be added to the composition, never silently dropped.
await click('Adicionar');assert(page().querySelector('[role="alert"]')?.textContent?.includes('insumo selecionado'));
const addMaterial=[...page().querySelectorAll('button')].find(el=>el.textContent?.trim()==='+ Insumo');assert(addMaterial);await act(async()=>addMaterial.click());
// Changing stages and item types keeps the unfinished personalized item.
await labelCheck('Personalizado');await labelCheck('Personalizado');await click('Voltar');await click('Continuar para produtos');assert.equal((page().querySelector('[aria-label="Nome do item personalizado"]') as HTMLInputElement).value,'Peça exclusiva');await click('Adicionar');
await click('Conferir pedido');await click('Código');await fill('Cupom de desconto','coupon');
await fill('Frete cobrado','12'); // freight is first numeric field in the review section
await click('PIX');await fill('Data prevista para recebimento','2026-10-21');
const paid=[...page().querySelectorAll('label')].find(el=>el.textContent?.includes('Valor já pago'))!.querySelector('input')!;await fill('Valor já pago','35');
await fill('Observações do pedido','Fita lilás e cartão');
await click('Voltar');await click('Voltar');assert.equal((page().querySelector('[aria-label="Nome avulso"]') as HTMLInputElement).value,'Cliente do teste');await click('Continuar para produtos');await click('Conferir pedido');assert.equal((page().querySelector('[aria-label="Observações do pedido"]') as HTMLInputElement).value,'Fita lilás e cartão');
await click('Concluir Pedido');assert(saved);assert.equal(saved.items.length,2);assert.equal(saved.items[0].quantity,2);assert.equal(saved.items[0].unitPrice,60);assert.equal(saved.items[1].quantity,3);assert.equal(saved.items[1].customRecipeItems[0].targetId,'m');assert.equal(saved.customerName,'Cliente do teste');assert.equal(saved.customerContact,'Contato teste');assert.equal(saved.channel,'WhatsApp');assert.equal(saved.date,'2026-10-15');assert.equal(saved.orderType,'encomenda');assert.equal(saved.deliveryScheduledDate,'2026-10-20');assert.equal(saved.paymentScheduledDate,'2026-10-21');assert.equal(saved.paymentMethod,'PIX');assert.equal(saved.discountCode,'AMOR10');assert.equal(saved.shippingCharged,12);assert.equal(saved.amountPaid,35);assert.equal(saved.notes,'Fita lilás e cartão');assert.equal(saved.totalRevenue,174);
await act(async()=>root.unmount());console.log('Novo pedido: todos os dados preservados entre etapas e ao salvar, composição personalizada mantida, itens incompletos protegidos.');
