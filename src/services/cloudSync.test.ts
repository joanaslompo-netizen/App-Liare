import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as protocol from './workspaceRecordStore';
import * as workspaceConfig from '../config/workspace';
import * as ledger from '../utils/financeLedger';
import {DEFAULT_SETTINGS,DEFAULT_PRODUCTS} from '../utils/storage';
const docs=new Map<string,any>(),versions=new Map<string,number>();
const legacy=`users/test/workspaces/${workspaceConfig.WORKSPACE_ID}`;
let cloud:any={userId:'test',version:3,materials:[],products:[{...DEFAULT_PRODUCTS[0],id:'p',currentStock:10}],sales:[],purchases:[],customers:[{id:'c',name:'Cliente'}],suppliers:[],settings:DEFAULT_SETTINGS,finance:ledger.emptyFinance(),revision:1};
const sale=(id:string)=>({id,date:'2026-10-14',productId:'p',productName:'Vela',quantity:1,unitPrice:250,totalRevenue:250,totalCost:20,items:[{id:`line_${id}`,productId:'p',productName:'Vela',quantity:1,unitPrice:250,unitCost:20,totalCost:20}],customerId:'c',financialTracking:true,legacyPaidCents:0});
cloud.sales=[sale('a'),sale('b')];cloud.finance.entries=[ledger.makeEntry('receipt',300,{id:'advance',customerId:'c'})];docs.set(legacy,structuredClone(cloud));
const snapshot=(ref:string)=>({exists:()=>docs.has(ref),data:()=>structuredClone(docs.get(ref)),metadata:{hasPendingWrites:false}});
const firestore:any={doc:(_:unknown,...path:string[])=>path.join('/'),getDocFromServer:async(ref:string)=>snapshot(ref),onSnapshot:()=>()=>{},runTransaction:async(_:unknown,callback:any)=>{
 for(let attempt=0;attempt<5;attempt++){
  const reads=new Map<string,number>(),writes=new Map<string,any>();
  const tx={get:async(ref:string)=>{reads.set(ref,versions.get(ref)||0);await new Promise(r=>setTimeout(r,0));return snapshot(ref);},set:(ref:string,value:any)=>writes.set(ref,value)};
  const result=await callback(tx);
  if([...reads].some(([ref,version])=>(versions.get(ref)||0)!==version))continue;
  for(const [ref,value] of writes){docs.set(ref,structuredClone(value));versions.set(ref,(versions.get(ref)||0)+1);}
  return result;
 }
 throw Error('Transaction retry limit');
}};
function compile(path:string,imports:Record<string,any>){const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports:any={};new Function('require','exports',compiled)((name:string)=>name in imports?imports[name]:assert.fail(`Unexpected import ${name}`),exports);return exports;}
const adapter=compile('./firestoreRecordAdapter.ts',{'firebase/firestore':firestore,'./workspaceRecordStore':protocol});
const service=compile('./cloudSync.ts',{'firebase/firestore':firestore,'../lib/firebase':{db:{}},'../utils/financeLedger':ledger,'../config/workspace':workspaceConfig,'./workspaceRecordStore':protocol,'./firestoreRecordAdapter':adapter});
const local=structuredClone(cloud),base=service.createWorkspaceSyncBase(local);
const results=await Promise.allSettled(['a','b'].map(id=>service.executeFinanceInCloud('test',local,base,{type:'entry',entry:ledger.makeEntry('credit_use',250,{id:`use_${id}`,saleId:id,customerId:'c'})})));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
cloud=await service.fetchWorkspaceFromCloud('test');assert.equal(ledger.creditBalance(cloud.finance,'c'),5000);assert.equal(cloud.finance.entries.filter((e:any)=>e.kind==='credit_use').length,1);
assert.deepEqual(docs.get(legacy),local,'finance migration never modifies legacy source');
const merged=service.mergeWorkspaceData(base,{...local,finance:ledger.emptyFinance()},cloud);assert.equal(ledger.creditBalance(merged.finance,'c'),5000);
const device=structuredClone(cloud),remote=structuredClone(cloud);device.suppliers=[{id:'local_supplier',name:'Fornecedor local'}];remote.products.push({...remote.products[0],id:'chatgpt_recipe',name:'Receita da conexão'});
const combined=service.mergeWorkspaceData(service.createWorkspaceSyncBase(cloud),device,remote);assert(combined.products.some((p:any)=>p.id==='chatgpt_recipe'));assert(combined.suppliers.some((p:any)=>p.id==='local_supplier'));assert.deepEqual(combined.finance,remote.finance);
await service.uploadWorkspaceToCloud('test',combined,'Web',cloud.revision);const uploaded=await service.fetchWorkspaceFromCloud('test');assert.equal(uploaded.products.length,2);assert.equal(uploaded.suppliers.length,1);
assert.equal((await service.fetchPreviousWorkspaceFromCloud('test')).products.length,1);
await assert.rejects(service.uploadWorkspaceToCloud('test',local,'Web',1),service.CloudSyncConflictError);
console.log('PASS fluxo SDK: migração + sincronização, conflito entre dispositivos, backup anterior, receita remota com fornecedor local e dois usos concorrentes de R$250 sobre crédito R$300 permitem só um.');
