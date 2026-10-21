/** Shared storage protocol. Keep byte-identical in the app and private connection. */
export const RECORD_SCHEMA = 4;
export const LEGACY_ID = 'liare_connected_v1';
export const HEAD_ID = 'records_liare_connected_v1';
export const PREVIOUS_HEAD_ID = 'previous_records_liare_connected_v1';
export const ARCHIVE_ID = 'archive_liare_connected_v1';
const ENTITY_SECTIONS = ['materials','products','productions','projects','purchases','sales','customers','suppliers','todos','stockMovements'] as const;
const HEADER_KEYS = ['userId','version','revision','updatedAt','lastModifiedBy'];
export type StoredDocument = { data: any };
export type StoreWrite = { id: string; data: any; createOnly?: boolean };
export interface ReadContext { get(id: string): Promise<StoredDocument | null> }
export interface WriteContext extends ReadContext { set(write: StoreWrite): void }
export interface RecordAdapter extends ReadContext {
  transaction<T>(operation: (context: WriteContext) => Promise<T>): Promise<T>;
}
type RecordRef = { section: string; id: string; documentId: string; digest: string };
export type RecordHead = { userId: string; version: 4; storageSchema: 4; revision: number; updatedAt: string; lastModifiedBy: string; legacyDigest: string; header: any; sections: string[]; records: RecordRef[] };
export class LegacyWorkspaceChangedError extends Error {
  code = 'legacy-workspace-changed';
  constructor() { super('Uma versão antiga do aplicativo alterou a base anterior. Os dados das duas versões foram preservados. Atualize as abas e aparelhos e confira a mesclagem antes de continuar a sincronização.'); }
}
export class WorkspaceRevisionError extends Error {
  constructor(public cloudData: any, public expectedRevision: number) { super('A revisão da base mudou. Nenhum dado foi sobrescrito.'); }
}
export const cleanJSON = (value: any): any => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('O cadastro contém um número inválido.');
  if (Array.isArray(value)) return value.map(cleanJSON);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k,cleanJSON(v)]));
  if (['string','number','boolean'].includes(typeof value)) return value;
  throw new Error('Tipo de dado não suportado.');
};
export const canonicalJSON = (value: any): string => JSON.stringify(sortJSON(cleanJSON(value)));
function sortJSON(value: any): any {
  if (Array.isArray(value)) return value.map(sortJSON);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,sortJSON(value[k])]));
  return value;
}
export async function digest(value: any): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
}
export async function mapLimited<T,R>(items: T[], fn: (value:T,index:number) => Promise<R>, limit=8): Promise<R[]> {
  const results = new Array<R>(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async () => { for (;;) { const index=next++; if(index>=items.length)return; results[index]=await fn(items[index],index); } }));
  return results;
}
export function splitWorkspace(workspace: any) {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) throw new Error('Base inválida.');
  const source=cleanJSON(workspace), header:any={}, sections:string[]=[], values:Array<{section:string;id:string;value:any}>=[];
  for(const key of HEADER_KEYS)if(key in source){header[key]=source[key];delete source[key];}
  for(const section of ENTITY_SECTIONS)if(section in source){
    if(!Array.isArray(source[section]))throw new Error(`Lista inválida: ${section}.`);
    sections.push(section); const seen=new Set<string>();
    for(const item of source[section]){
      if(!item || typeof item.id!=='string' || !item.id || seen.has(item.id))throw new Error(`Identificador ausente ou duplicado em ${section}.`);
      seen.add(item.id);values.push({section,id:item.id,value:item});
    }
    delete source[section];
  }
  if(source.finance && typeof source.finance==='object'){
    const finance={...source.finance};
    for(const name of ['entries','bills'])if(name in finance){
      const section=`finance.${name}`;if(!Array.isArray(finance[name]))throw new Error(`Lista inválida: ${section}.`);
      sections.push(section);const seen=new Set<string>();
      for(const item of finance[name]){
        if(!item || typeof item.id!=='string' || !item.id || seen.has(item.id))throw new Error(`Identificador ausente ou duplicado em ${section}.`);
        seen.add(item.id);values.push({section,id:item.id,value:item});
      }
      delete finance[name];
    }
    source.finance=finance;
  }
  // Configurations and unknown fields survive as individual top-level records.
  for(const [key,value] of Object.entries(source))values.push({section:'field',id:key,value});
  return {header,sections,values};
}
const refKey = (ref:{section:string;id:string}) => JSON.stringify([ref.section,ref.id]);
function assertHead(head:any,uid:string): asserts head is RecordHead {
  if(head?.storageSchema!==RECORD_SCHEMA || head.version!==4 || head.userId!==uid || !Number.isSafeInteger(head.revision) || !Array.isArray(head.records) || !Array.isArray(head.sections) || typeof head.legacyDigest!=='string')throw new Error('Índice de registros inválido. A base anterior foi preservada.');
  const keys=new Set<string>();
  for(const ref of head.records){
    if(typeof ref.section!=='string'||typeof ref.id!=='string'||!/^r4_[a-f0-9]{32}_[0-9]+$/.test(ref.documentId)||!/^[a-f0-9]{64}$/.test(ref.digest)||keys.has(refKey(ref)))throw new Error('Referência de registro inválida.');
    keys.add(refKey(ref));
  }
  if(head.sections.some((s:any)=>![...ENTITY_SECTIONS,'finance.entries','finance.bills'].includes(s)))throw new Error('Seção de registros inválida.');
}
export async function readRecordHead(context:ReadContext,uid:string,head:any): Promise<any> {
  assertHead(head,uid);const data:any=cleanJSON(head.header);
  for(const section of head.sections){if(section.startsWith('finance.')){data.finance||={};data.finance[section.split('.')[1]]=[];}else data[section]=[];}
  const loaded=await mapLimited(head.records,async ref => {
    const doc=await context.get(ref.documentId);
    if(!doc || doc.data?.userId!==uid || doc.data?.storageSchema!==4 || doc.data?.section!==ref.section || doc.data?.recordId!==ref.id || await digest(doc.data.value)!==ref.digest)throw new Error('Um registro está ausente ou inválido. Nada foi substituído; o backup anterior continua preservado.');
    return {ref,value:cleanJSON(doc.data.value)};
  });
  // Field records must be restored first, because finance has its own metadata.
  for(const {ref,value} of loaded)if(ref.section==='field')data[ref.id]=value;
  for(const section of head.sections)if(section.startsWith('finance.')){data.finance||={};data.finance[section.split('.')[1]]=[];}
  for(const {ref,value} of loaded)if(ref.section!=='field'){
    if(value?.id!==ref.id)throw new Error('Identificador do registro divergente.');
    if(ref.section.startsWith('finance.'))data.finance[ref.section.split('.')[1]].push(value);else data[ref.section].push(value);
  }
  return data;
}
export async function planRecordWrite(uid:string,next:any,current:any,head:RecordHead|null,legacy:any,label:string) {
  const split=splitWorkspace(next), now=new Date().toISOString();
  const currentRevision=Number(current?.revision||0), revision=currentRevision+1;
  if(!Number.isSafeInteger(currentRevision)||currentRevision<0)throw new Error('Revisão inválida.');
  if(next.userId && next.userId!==uid)throw new Error('A base pertence a outra conta.');
  const oldRefs=new Map((head?.records||[]).map(ref=>[refKey(ref),ref]));
  const changed:StoreWrite[]=[];
  const records=await mapLimited(split.values,async value => {
    const hash=await digest(value.value), old=oldRefs.get(refKey(value));
    if(old?.digest===hash)return old;
    const keyHash=(await digest([value.section,value.id])).slice(0,32);
    const documentId=`r4_${keyHash}_${revision}`;
    changed.push({id:documentId,createOnly:true,data:{userId:uid,version:4,storageSchema:4,updatedAt:now,section:value.section,recordId:value.id,value:value.value}});
    return {section:value.section,id:value.id,documentId,digest:hash};
  });
  // Ignore transport timestamps/revision when deciding if business data changed.
  const businessEqual=head && changed.length===0 && canonicalJSON(records)===canonicalJSON(head.records) && canonicalJSON(split.sections)===canonicalJSON(head.sections) && canonicalJSON({...split.header,revision:0,version:0,updatedAt:'',lastModifiedBy:'',userId:uid})===canonicalJSON({...head.header,revision:0,version:0,updatedAt:'',lastModifiedBy:'',userId:uid});
  if(businessEqual)return {data:current,writes:[] as StoreWrite[],head};
  const header={...split.header,userId:uid,version:3,revision,updatedAt:now,lastModifiedBy:label};
  const nextHead:RecordHead={userId:uid,version:4,storageSchema:4,revision,updatedAt:now,lastModifiedBy:label,legacyDigest:head?.legacyDigest||await digest(legacy),header,sections:split.sections,records};
  const writes:StoreWrite[]=[...changed];
  if(head)writes.push({id:PREVIOUS_HEAD_ID,data:head});
  // Exactly one complete archive at migration; never rewrite it on normal edits.
  else if(legacy)writes.push({id:ARCHIVE_ID,createOnly:true,data:{...legacy,userId:uid,version:Number(legacy.version||3),updatedAt:legacy.updatedAt||now}});
  writes.push({id:HEAD_ID,data:nextHead});
  if(writes.length>450)throw new Error('Esta migração excede o lote seguro de registros. A base anterior não foi alterada.');
  return {data:{...cleanJSON(next),...header},writes,head:nextHead};
}
export function createRecordStore(adapter:RecordAdapter,uid:string) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw new Error('Identificador de usuário inválido.');
  async function load(context:ReadContext,previous=false) {
    const headDoc=await context.get(previous?PREVIOUS_HEAD_ID:HEAD_ID);
    if(headDoc){
      const head=headDoc.data;assertHead(head,uid);
      if(!previous){const legacy=await context.get(LEGACY_ID);if(await digest(legacy?.data||null)!==head.legacyDigest)throw new LegacyWorkspaceChangedError();}
      return {data:await readRecordHead(context,uid,head),head};
    }
    if(previous){const archive=await context.get(ARCHIVE_ID);if(archive)return {data:archive.data,head:null};}
    const legacy=await context.get(previous?`previous_${LEGACY_ID}`:LEGACY_ID);
    return legacy?{data:legacy.data,head:null}:null;
  }
  return {
    read:()=>load(adapter),
    previous:()=>load(adapter,true),
    mutate:async (mutator:(current:any|null)=>any|Promise<any>,expectedRevision?:number,label='Web') => adapter.transaction(async context => {
      const loaded=await load(context),current=loaded?.data||null;
      if(current && (expectedRevision===undefined||Number(current.revision||0)!==expectedRevision))throw new WorkspaceRevisionError(current,expectedRevision??-1);
      const next=await mutator(current);
      const legacy=loaded?.head ? null : current;
      const plan=await planRecordWrite(uid,next,current,loaded?.head||null,legacy,label);
      // Web transactions require all reads before any write. createOnly checks also
      // make failed/retried migrations incapable of changing preexisting archives.
      for(const write of plan.writes)if(write.createOnly && await context.get(write.id))throw new Error('Um registro de destino já existe. Nada foi sobrescrito.');
      for(const write of plan.writes)context.set(write);
      return plan.data;
    }),
  };
}
