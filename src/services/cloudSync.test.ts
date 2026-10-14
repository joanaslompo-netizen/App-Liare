import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as ledger from '../utils/financeLedger';
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from '../utils/storage';
// Exercise the actual service against a transaction simulator, without credentials or real data.
const source=fs.readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');
let cloud:any={materials:[],products:[{...DEFAULT_PRODUCTS[0],id:'p',currentStock:10}],sales:[],purchases:[],customers:[{id:'c',name:'Cliente'}],suppliers:[],settings:DEFAULT_SETTINGS,finance:ledger.emptyFinance(),revision:1};
const sale=(id:string)=>({id,date:'2026-10-14',productId:'p',productName:'Vela',quantity:1,unitPrice:250,totalRevenue:250,totalCost:20,items:[{id:`line_${id}`,productId:'p',productName:'Vela',quantity:1,unitPrice:250,unitCost:20,totalCost:20}],customerId:'c',financialTracking:true,legacyPaidCents:0});
cloud.sales=[sale('a'),sale('b')];
cloud.finance.entries=[ledger.makeEntry('receipt',300,{id:'advance',customerId:'c'})];
const firestore={doc:(_:unknown,...path:string[])=>path.join('/'),runTransaction:async(_:unknown,callback:any)=>{
  for(let attempt=0;attempt<5;attempt++){
    const start=structuredClone(cloud),revision=cloud.revision,writes=new Map<string,unknown>();
    const tx={get:async()=>{await new Promise(r=>setTimeout(r,0));return {exists:()=>true,data:()=>structuredClone(start)};},set:(ref:string,value:unknown)=>writes.set(ref,value)};
    const result=await callback(tx);
    if(cloud.revision!==revision)continue;
    const value=writes.get('users/test/workspaces/default');if(value)cloud=value;
    return result;
  }
  throw Error('Transaction retry limit');
}};
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports:any={};
new Function('require','exports',compiled)((name:string)=>name==='firebase/firestore'?firestore:name==='../lib/firebase'?{db:{}}:name==='../utils/financeLedger'?ledger:assert.fail(`Unexpected import ${name}`),exports);
const local=structuredClone(cloud),base=exports.createWorkspaceSyncBase(local);
const results=await Promise.allSettled(['a','b'].map(id=>exports.executeFinanceInCloud('test',local,base,{type:'entry',entry:ledger.makeEntry('credit_use',250,{id:`use_${id}`,saleId:id,customerId:'c'})})));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
assert.equal(ledger.creditBalance(cloud.finance,'c'),5000);
assert.equal(cloud.finance.entries.filter((e:any)=>e.kind==='credit_use').length,1);
const merged=exports.mergeWorkspaceData(base,{...local,finance:ledger.emptyFinance()},cloud);
assert.equal(ledger.creditBalance(merged.finance,'c'),5000);
console.log('Sincronização simulada: duas utilizações simultâneas de R$250 sobre crédito R$300 permitem uma só; saldo R$50 e eventos preservados.');
