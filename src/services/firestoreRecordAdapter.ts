import {doc,getDocFromCache,getDocFromServer,runTransaction,type Firestore,type Transaction} from 'firebase/firestore';
import {type RecordAdapter,type StoreWrite} from './workspaceRecordStore';
import { cloudQuotaGuard } from './cloudQuotaGuard';
/** Immutable record contents may be cached; manifests and the legacy guard never are. */
export function firestoreRecordAdapter(db:Firestore,uid:string):RecordAdapter {
  const cache=new Map<string,any>();
  const pending=new Map<string,Promise<any>>();
  const ref=(id:string)=>doc(db,'users',uid,'workspaces',id);
  const fromServer=async(operation:()=>Promise<any>)=>{
    cloudQuotaGuard.assertAllowed(uid,'read');
    try{return await operation();}catch(error){cloudQuotaGuard.record(uid,error,'read');throw error;}
  };
  const get=async(id:string,transaction?:Transaction)=>{
    if(/^r[45]_/.test(id) && cache.has(id))return {data:cache.get(id)};
    if (!transaction && /^r[45]_/.test(id)) {
      const existing=pending.get(id);
      if(existing)return existing;
      const read=(async()=>{
        // Content-addressed records are immutable and checked against the fresh
        // manifest's SHA-256 by readRecordHead. Never use this path for a head.
        let snap;
        try { snap=await getDocFromCache(ref(id)); } catch { /* cache miss */ }
        if(!snap?.exists())snap=await fromServer(()=>getDocFromServer(ref(id)));
        if(!snap.exists())return null;
        const data=snap.data();if(cache.size>2000)cache.clear();cache.set(id,data);
        return {data};
      })();
      pending.set(id,read);
      try{return await read;}finally{pending.delete(id);}
    }
    const snap=await fromServer(()=>transaction?transaction.get(ref(id)):getDocFromServer(ref(id)));
    if(!snap.exists())return null;
    const data=snap.data();if(/^r[45]_/.test(id)){if(cache.size>2000)cache.clear();cache.set(id,data);}
    return {data};
  };
  return {get:id=>get(id),transaction:async operation=>{
    cloudQuotaGuard.assertAllowed(uid,'read');cloudQuotaGuard.assertAllowed(uid,'write');
    for(let attempt=0;;attempt++) {
    let committedWrites:StoreWrite[]=[];
    try{const result=await runTransaction(db,async transaction=>{
    const writes:StoreWrite[]=[];
    const result=await operation({get:id=>get(id,transaction),set:write=>writes.push(write)});
    for(const write of writes)transaction.set(ref(write.id),write.data);
    committedWrites=writes;
    return result;
    }, { maxAttempts: 1 });
    for(const write of committedWrites)if(/^r[45]_/.test(write.id))cache.set(write.id,write.data);
    return result;
    }catch(error){
      cloudQuotaGuard.record(uid,error,'write');
      // The SDK retries RESOURCE_EXHAUSTED by default. Retry only a genuine
      // transaction race here; a daily quota failure gets exactly one attempt.
      if((error as {code?:string})?.code==='aborted' && attempt<2)continue;
      throw error;
    }
    }
  }};
}
