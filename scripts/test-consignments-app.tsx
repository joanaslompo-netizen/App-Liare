import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { workspaceStorage as storage } from '../src/utils/workspaceStorage';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';
import { cashEffect, orderBalance } from '../src/utils/financeLedger';
import { consignmentStock } from '../src/utils/consignments';
const dom = new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Event','MouseEvent','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const alerts:string[]=[];
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,alert:(message:string)=>alerts.push(message),confirm:()=>true,requestAnimationFrame:(fn:()=>void)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.scrollTo=()=>{};
storage.setItem('atelie_workspace_finance_v1',JSON.stringify({materials:[],products:[{...DEFAULT_PRODUCTS[0],id:'p',name:'Vela teste',actualPrice:25,currentStock:20,inventoryBusinessCost:10,inventoryLaborCost:5,isFamilyMother:false,parentRecipeId:undefined,productFamily:undefined,fragrance:undefined,isIntermediate:false,isCustomRecipe:false,isPaused:false}],purchases:[],productions:[],sales:[],customers:[],suppliers:[],paymentMethods:['PIX'],settings:DEFAULT_SETTINGS,todos:[],projects:[],finance:{version:1,entries:[],bills:[]},stockMovements:[]}));
const {createRoot}=await import('react-dom/client');const {default:App}=await import('../src/App');
let root=createRoot(document.querySelector('#root')!);
async function mount(){await act(async()=>root.render(<App/>));}
async function click(text:string){const element=[...document.querySelectorAll('button')].find(element=>element.textContent?.trim()===text);assert(element,`Botão ${text}`);await act(async()=>element.click());}
async function fill(label:string,value:string){const container=[...document.querySelectorAll('label')].find(element=>element.querySelector('span')?.textContent===label);assert(container,label);const element=container.querySelector('input,select,textarea') as HTMLInputElement;assert(element,label);await act(async()=>{const proto=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function open(){await act(async()=>(document.querySelector('[aria-label="Abrir atalhos rápidos"]') as HTMLElement).click());await click('Consignações');}
const saved=()=>JSON.parse(storage.getItem('atelie_workspace_finance_v1')!);
await mount();await open();await click('Novo local');await fill('Nome do local','Ponto de teste');await fill('Comissão do local (%)','20');await click('Salvar local');
assert.equal(saved().finance.consignmentLocations[0].commissionPercent,20);
await click('Enviar / repor velas');await fill('Adicionar produto ao envio','p');await fill('Quantidade do envio 1','10');await click('Confirmar envio');
assert.equal(saved().products[0].currentStock,10);assert.equal(saved().sales.length,0);assert.equal(saved().finance.entries.length,0);
await click('Conferir período');await fill('Restaram no local · Vela teste','6');await fill('Voltaram ao ateliê · Vela teste','1');
assert(document.querySelector('[aria-label="Prévia do acerto"]')?.textContent?.includes('60,00'));
assert.equal((([...document.querySelectorAll('button')].find(element=>element.textContent==='Confirmar conferência')) as HTMLButtonElement).disabled,true);
await act(async()=>{const checkbox=[...document.querySelectorAll('label')].find(label=>label.textContent?.includes('Conferi as quantidades'))!.querySelector('input')!;checkbox.click();});
await click('Confirmar conferência');
let data=saved();const locationId=data.finance.consignmentLocations[0].id;
assert.equal(data.products[0].currentStock,11);assert.equal(consignmentStock(data.stockMovements,locationId)[0].quantity,6);assert.equal(data.sales[0].totalRevenue,75);assert.equal(data.sales[0].consignmentCommissionCents,1500);assert.equal(orderBalance(data.sales[0],data.finance),6000);assert.equal(data.finance.entries.length,0);
await click('Registrar repasse');await fill('Valor do repasse recebido (R$)','20');await click('Confirmar recebimento do repasse');
data=saved();assert.equal(orderBalance(data.sales[0],data.finance),4000);assert.equal(data.finance.entries.reduce((n:number,entry:any)=>n+cashEffect(entry,data.finance),0),2000);
await act(async()=>root.unmount());root=createRoot(document.querySelector('#root')!);await mount();await open();
const local=[...document.querySelectorAll('button')].find(element=>element.textContent?.includes('Ponto de teste'));assert(local);await act(async()=>local.click());
assert(document.querySelector('.liare-consignments')?.textContent?.includes('40,00'));
await click('Editar local');await fill('Comissão do local (%)','30');await click('Salvar local');
assert.equal(saved().sales[0].consignmentCommissionCents,1500);
await click('Financeiro');await click('A receber');const pending=[...document.querySelectorAll('button')].find(element=>element.textContent?.includes('Consignação · Ponto de teste'));assert(pending);await act(async()=>pending.click());assert(document.querySelector('.liare-consignments'));
await click('Registrar repasse');await fill('Valor do repasse recebido (R$)','40');await click('Confirmar recebimento do repasse');
data=saved();assert.equal(orderBalance(data.sales[0],data.finance),0);assert.equal(data.finance.entries.reduce((n:number,entry:any)=>n+cashEffect(entry,data.finance),0),6000);
assert.deepEqual(alerts,[]);
await act(async()=>root.unmount());
console.log('App: cadastrar parceiro, transferir velas, conferir vendas/devolução, exigir confirmação, comissão separada, repasse parcial, reabertura, histórico e acesso pelo Financeiro passaram.');
process.exit(0);
