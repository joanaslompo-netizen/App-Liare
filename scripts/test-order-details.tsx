import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import assert from 'node:assert/strict';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','localStorage'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const alerts:string[]=[];
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,alert:(m:string)=>alerts.push(m),confirm:()=>true,requestAnimationFrame:(f:()=>void)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.scrollTo=()=>{};
const {DEFAULT_SETTINGS,DEFAULT_PRODUCTS}=await import('../src/utils/storage');
const fixture:any={materials:[],products:[{...DEFAULT_PRODUCTS[0],id:'p',currentStock:10}],purchases:[],productions:[],sales:[{id:'s',orderNumber:1,date:'2026-10-14',productId:'p',productName:'Vela',quantity:1,unitPrice:120,unitCost:20,totalRevenue:120,totalCost:20,totalProfit:100,customerId:'c',customerName:'Cliente teste',financialTracking:true,legacyPaidCents:0,deliveryStatus:'pendente_entrega',createdAt:'2026-10-14',items:[{id:'line',productId:'p',productName:'Vela',quantity:1,unitPrice:120,unitCost:20,totalCost:20,unitBusinessCost:15,unitLaborRemuneration:5}]}],customers:[{id:'c',name:'Cliente teste',phone:'',createdAt:'2026-10-14'}],paymentMethods:['PIX'],suppliers:[],settings:DEFAULT_SETTINGS,todos:[],projects:[],finance:{version:1,entries:[],bills:[]},stockMovements:[]};
localStorage.setItem('atelie_workspace_finance_v1',JSON.stringify(fixture));
const {createRoot}=await import('react-dom/client');
const {default:App}=await import('../src/App');
let root=createRoot(document.querySelector('#root')!);
async function mount(){await act(async()=>root.render(<App/>));}
async function button(text:string){const el=[...document.querySelectorAll('button')].find(e=>e.textContent?.trim()===text);assert(el,`Botão: ${text}`);await act(async()=>el.click());}
async function field(label:string,value:string){const container=[...document.querySelectorAll('label')].find(e=>e.textContent?.includes(label));assert(container,`Campo: ${label}`);const el=(container.querySelector('input,select') || document.getElementById(container.htmlFor)) as HTMLInputElement;assert(el);await act(async()=>{const proto=el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function submit(){const form=document.querySelector('form');assert(form);await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));}
const saved=()=>JSON.parse(localStorage.getItem('atelie_workspace_finance_v1')!);

const {makeEntry}=await import('../src/utils/financeLedger');
Object.assign(fixture.products[0],{actualPrice:120,isIntermediate:false,isCustomRecipe:false,productFamily:undefined,fragrance:undefined});
fixture.products.push({...fixture.products[0],id:'p2',name:'Produto adicional',actualPrice:48,currentStock:10});
fixture.finance.entries=[makeEntry('receipt',50,{id:'receipt-original',saleId:'s',customerId:'c',date:'2026-10-15',method:'PIX',account:'Principal',allocatedCents:5000})] as any;
localStorage.setItem('atelie_workspace_finance_v1',JSON.stringify(fixture));
const originalReceipt=JSON.stringify(fixture.finance.entries[0]);
const detail=()=>document.querySelector('[data-testid=order-detail]')!;
async function editField(label:string,value:string){const el=detail().querySelector(`[aria-label="${label}"]`) as HTMLInputElement;assert(el,label);await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
async function openHomeOrder(){const el=[...document.querySelectorAll('button')].find(el=>el.textContent?.includes('Cliente teste')&&el.textContent?.includes('un a entregar'));assert(el);await act(async()=>el.click());assert(detail());}
async function chooseProduct(){const search=document.querySelector('#detail-product-search') as HTMLInputElement;assert(search);await act(async()=>{search.focus();Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(search,'Produto adicional');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});const option=[...document.querySelectorAll('li')].find(el=>el.textContent?.includes('Produto adicional'));assert(option);await act(async()=>option.click());}
await mount();await openHomeOrder();
assert.equal(detail().querySelectorAll('form').length,0,'A ficha abre para consulta, sem formulário');
assert.equal(document.querySelectorAll('.liare-form-dialog').length,0,'Sem pop-up ao abrir pedido');
await button('Editar itens');await editField('Quantidade de Vela','2');await editField('Preço de Vela','70');await button('Salvar itens do pedido');
let order=saved().sales[0];assert.equal(saved().sales.length,1);assert.equal(order.id,'s');assert.equal(order.orderNumber,1);assert.equal(order.totalRevenue,140);assert.equal(order.items[0].quantity,2);assert.equal(order.items[0].reservedQuantity,2);assert.equal(saved().products[0].currentStock,10);assert(detail().textContent?.includes('90,00'));assert.equal(JSON.stringify(saved().finance.entries[0]),originalReceipt);
await button('Editar itens');await button('Trocar produto');await chooseProduct();await button('Substituir item');await button('Salvar itens do pedido');
order=saved().sales[0];assert.equal(order.items[0].productId,'p2');assert.equal(order.totalRevenue,48);assert.equal(order.orderNumber,1);assert.equal(JSON.stringify(saved().finance.entries[0]),originalReceipt);assert(saved().finance.entries.some((entry:any)=>entry.kind==='credit_release'&&entry.amountCents===200));assert.equal(saved().products[1].currentStock,10);assert.equal(order.items[0].reservedQuantity,1);
await button('Editar itens');await chooseProduct();await button('Adicionar item');await button('Salvar itens do pedido');
order=saved().sales[0];assert.equal(order.items.length,2);assert.equal(order.totalRevenue,96);assert.equal(saved().sales.length,1);assert.equal(JSON.stringify(saved().finance.entries[0]),originalReceipt);
await button('Registrar entrega');await button('Registrar entrega');
order=saved().sales[0];assert.equal(order.deliveryStatus,'parcial');assert.equal(saved().products[1].currentStock,9);
await button('Editar itens');
const deliveredRow=detail().querySelector(`[data-order-item="${order.items[0].id}"]`)!;
assert((deliveredRow.querySelector('[aria-label="Preço de Produto adicional"]') as HTMLInputElement).disabled);
assert((deliveredRow.querySelector('[aria-label="Remover Produto adicional"]') as HTMLButtonElement).disabled);
await button('Cancelar alterações');await button('Voltar');
await button('Pedidos');
const search=[...document.querySelectorAll('input')].find(input=>input.placeholder?.startsWith('Buscar por cliente'))!;assert(search);
await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(search,'Cliente teste');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
await button('Pedido #000001');assert(detail());await button('Voltar');
assert.equal(search.value,'Cliente teste','Voltar preserva a busca da lista');
assert.equal(alerts.length,0,alerts.join('; '));
await act(async()=>root.unmount());root=createRoot(document.querySelector('#root')!);await mount();await openHomeOrder();
assert.equal(saved().sales.length,1);assert.equal(saved().sales[0].orderNumber,1);assert.equal(saved().sales[0].items.length,2);assert.equal(JSON.stringify(saved().finance.entries[0]),originalReceipt);
await act(async()=>root.unmount());
console.log('Pedidos: ficha ampla sem edição automática; quantidade/preço, troca e inclusão no mesmo pedido; recebimento original preservado; excedente em crédito; reservas sem baixa física; entrega parcial; itens entregues protegidos; busca e dados preservados ao voltar/reabrir.');
process.exit(0);
