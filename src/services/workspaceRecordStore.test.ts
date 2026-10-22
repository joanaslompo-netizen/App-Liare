import assert from 'node:assert/strict';
import {createRecordStore,HEAD_ID,PREVIOUS_HEAD_ID,ARCHIVE_ID,LEGACY_ID,canonicalJSON,decodeRecordHead,LegacyWorkspaceChangedError,WorkspaceRevisionError,type RecordAdapter} from './workspaceRecordStore';
import {syncFailureKind,retryDelay} from './syncRetryPolicy';
export class MemoryAdapter implements RecordAdapter {
 docs=new Map<string,any>(); batches:any[][]=[]; fail=false; generation=0;
 async get(id:string){return this.docs.has(id)?{data:structuredClone(this.docs.get(id))}:null;}
 async transaction<T>(operation:any):Promise<T>{
  const generation=this.generation,pending:any[]=[];const result=await operation({get:(id:string)=>this.get(id),set:(write:any)=>pending.push(structuredClone(write))});
  if(this.fail)throw Object.assign(new Error('Quota exceeded'),{code:'resource-exhausted'});
  if(generation!==this.generation)throw new Error('aborted');
  for(const write of pending)if(write.createOnly&&this.docs.has(write.id))throw new Error('already exists');
  for(const write of pending)this.docs.set(write.id,write.data);
  if(pending.length){this.batches.push(pending);this.generation++;}
  return result;
 }
}
export const fixture=()=>({userId:'owner',version:3,revision:71,updatedAt:'2026-10-20T00:00:00Z',lastModifiedBy:'Web',materials:Array.from({length:75},(_,i)=>({id:`mat_${i}`,name:`Material ${i}`,currentStock:i,unit:'g',unitCost:.1})),products:Array.from({length:35},(_,i)=>({id:`prod_${i}`,name:`Vela ${i}`,actualPrice:55,currentStock:i,imageUrl:'data:image/png;base64,'+'a'.repeat(10000),items:[{targetId:`mat_${i}`,quantity:45}]})),productions:[{id:'production',productId:'prod_1',quantity:2}],purchases:[],sales:[{id:'sale',customerId:'customer',totalRevenue:55}],customers:[{id:'customer',name:'Cliente'}],suppliers:[],todos:[{id:'todo',done:false}],stockMovements:[{id:'movement',quantity:3}],projects:[],paymentMethods:['Pix'],settings:{defaultHourlyRate:35,defaultFixedCostPercent:12},finance:{version:1,entries:[{id:'entry',amountCents:3500}],bills:[{id:'bill',amountCents:1000}],customFinanceField:'preservado'},unknownFutureField:{nested:['ç',null,true,3]}});
const a=new MemoryAdapter(),original=fixture();a.docs.set(LEGACY_ID,structuredClone(original));const store=createRecordStore(a,'owner');
assert.deepEqual((await store.read())!.data,original);assert.equal(a.batches.length,0,'read-only never migrates');
const migrated=await store.mutate(current=>current,71,'Migração');assert.equal(migrated.revision,72);
const loaded=(await store.read())!.data;
for(const key of Object.keys(original).filter(k=>!['revision','updatedAt','lastModifiedBy'].includes(k)))assert.deepEqual(loaded[key],original[key],`roundtrip ${key}`);
assert.deepEqual(a.docs.get(LEGACY_ID),original,'original remains untouched');assert.deepEqual(a.docs.get(ARCHIVE_ID),original,'archive exactly preserves legacy');
assert.deepEqual((await store.previous())!.data,original);
const changed=structuredClone(loaded);changed.products[4].actualPrice=60;
await store.mutate(()=>changed,72);const batch=a.batches.at(-1)!;
assert.equal(batch.filter(x=>/^r[45]_/.test(x.id)).length,1,'one changed product writes one record');
assert.equal(batch.length,3,'changed record plus current and previous small manifests');
assert(!batch.some(x=>[LEGACY_ID,ARCHIVE_ID].includes(x.id)));
assert.deepEqual((await store.previous())!.data,loaded);
const legacyBytes=Buffer.byteLength(JSON.stringify(original))*2,writeBytes=Buffer.byteLength(JSON.stringify(batch));
assert(writeBytes<legacyBytes*.25,`${writeBytes} should be <25% of ${legacyBytes}`);
const current=(await store.read())!.data,count=a.batches.length;
await store.mutate(()=>({...current,updatedAt:'different',revision:999}),current.revision);
assert.equal(a.batches.length,count,'identical data causes zero writes');
const reduced=structuredClone(current);reduced.materials.shift();reduced.finance.entries.push({id:'entry2',amountCents:500});
await store.mutate(()=>reduced,current.revision);
assert.equal((await store.read())!.data.materials.length,74);assert.equal((await store.previous())!.data.materials.length,75);
const beforeFailure=canonicalJSON([...a.docs]);a.fail=true;
await assert.rejects(store.mutate(c=>({...c,settings:{changed:true}}),(await store.read())!.data.revision),/Quota/);
assert.equal(canonicalJSON([...a.docs]),beforeFailure,'quota failure leaves no partial commit');a.fail=false;
await assert.rejects(store.mutate(c=>c,1),WorkspaceRevisionError);
const head=decodeRecordHead(a.docs.get(HEAD_ID),'owner'),missing=head.records[0].documentId,record=a.docs.get(missing);a.docs.delete(missing);
await assert.rejects(store.read(),/ausente/);a.docs.set(missing,record);
a.docs.set(LEGACY_ID,{...original,revision:72});await assert.rejects(store.read(),LegacyWorkspaceChangedError);assert(a.docs.get(HEAD_ID));assert(a.docs.get(ARCHIVE_ID));
a.docs.set(LEGACY_ID,original);
const duplicate=structuredClone((await store.read())!.data);duplicate.materials.push(duplicate.materials[0]);await assert.rejects(store.mutate(()=>duplicate,head.revision),/duplicado/);
const emptyAdapter=new MemoryAdapter(),empty=createRecordStore(emptyAdapter,'owner');assert.equal(await empty.read(),null);
await empty.mutate(()=>({userId:'owner',materials:[],products:[],settings:{},finance:{version:1,entries:[],bills:[]}}));assert.equal((await empty.read())!.data.revision,1);
assert.equal(syncFailureKind({code:'resource-exhausted'}),'quota');assert.equal(syncFailureKind(new LegacyWorkspaceChangedError()),'blocked');assert.equal(syncFailureKind({code:'unavailable'}),'transient');assert.equal(syncFailureKind(new Error('Identificador duplicado')),'blocked');assert.deepEqual([1,2,3,4,5,6,7].map(retryDelay),[10000,20000,40000,80000,160000,300000,null]);
console.log(`PASS armazenamento: migração fiel, original e arquivo preservados, 1 edição = 1 registro, exclusões e histórico, no-op sem escrita, falha atômica, revisão, corrupção e aba antiga bloqueadas. Bytes na edição: ${writeBytes}/${legacyBytes} (${(100*writeBytes/legacyBytes).toFixed(1)}%).`);
