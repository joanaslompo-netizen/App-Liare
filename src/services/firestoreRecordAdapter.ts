import {doc,getDocFromCache,getDocFromServer,runTransaction,type Firestore,type Transaction} from 'firebase/firestore';
import {type RecordAdapter,type StoreWrite} from './workspaceRecordStore';
/** Immutable record contents may be cached; manifests and the legacy guard never are. */
export function firestoreRecordAdapter(db:Firestore,uid:string):RecordAdapter {
  const cache=new Map<string,any>();
  const pending=new Map<string,Promise<any>>();
  const ref=(id:string)=>doc(db,'users',uid,'workspaces',id);
  const get=async(id:string,transaction?:Transaction)=>{
    if(id.startsWith('r4_') && cache.has(id))return {data:cache.get(id)};
    if (!transaction && id.startsWith('r4_')) {
      const existing=pending.get(id);
      if(existing)return existing;
      const read=(async()=>{
        // Content-addressed records are immutable and checked against the fresh
        // manifest's SHA-256 by readRecordHead. Never use this path for a head.
        let snap;
        try { snap=await getDocFromCache(ref(id)); } catch { /* cache miss */ }
        if(!snap?.exists())snap=await getDocFromServer(ref(id));
        if(!snap.exists())return null;
        const data=snap.data();if(cache.size>2000)cache.clear();cache.set(id,data);
        return {data};
      })();
      pending.set(id,read);
      try{return await read;}finally{pending.delete(id);}
    }
    const snap=transaction?await transaction.get(ref(id)):await getDocFromServer(ref(id));
    if(!snap.exists())return null;
    const data=snap.data();if(id.startsWith('r4_')){if(cache.size>2000)cache.clear();cache.set(id,data);}
    return {data};
  };
  return {get:id=>get(id),transaction:operation=>runTransaction(db,async transaction=>{
    const writes:StoreWrite[]=[];
    const result=await operation({get:id=>get(id,transaction),set:write=>writes.push(write)});
    for(const write of writes)transaction.set(ref(write.id),write.data);
    return result;
  })};
}
