import {doc,getDocFromServer,runTransaction,type Firestore,type Transaction} from 'firebase/firestore';
import {type RecordAdapter,type StoreWrite} from './workspaceRecordStore';
/** Immutable record contents may be cached; manifests and the legacy guard never are. */
export function firestoreRecordAdapter(db:Firestore,uid:string):RecordAdapter {
  const cache=new Map<string,any>();
  const ref=(id:string)=>doc(db,'users',uid,'workspaces',id);
  const get=async(id:string,transaction?:Transaction)=>{
    if(id.startsWith('r4_') && cache.has(id))return {data:cache.get(id)};
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
