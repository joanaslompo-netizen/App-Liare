/** Shared storage protocol. Keep byte-identical in the app and private connection. */
export const RECORD_SCHEMA = 5;
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
type RecordRef = { section: string; id: string; documentId: string; digest: string; depth?: number };
export type RecordHead = { userId: string; version: 4 | 5; storageSchema: 4 | 5; revision: number; updatedAt: string; lastModifiedBy: string; legacyDigest: string; header: any; sections: string[]; records: RecordRef[] };
const MAX_DELTA_DEPTH = 4;
const recordIdPattern = /^r[45]_[a-f0-9]{32}_[0-9]+$/;
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
  for(const key of Object.keys(source).sort())values.push({section:'field',id:key,value:source[key]});
  return {header,sections,values};
}
const refKey = (ref:{section:string;id:string}) => JSON.stringify([ref.section,ref.id]);
function recordOrderFingerprint(records:RecordRef[]):string {
  const groups:Record<string,RecordRef[]>={};
  for(const ref of records)(groups[ref.section]||=[]).push(ref);
  // Object-field order has no meaning; entity-list order still does.
  if(groups.field)groups.field.sort((a,b)=>a.id.localeCompare(b.id));
  return canonicalJSON(groups);
}
const compactDigest = (hex:string) => btoa(String.fromCharCode(...hex.match(/../g)!.map(byte=>parseInt(byte,16)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function expandDigest(value:string):string {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw new Error('Referência de registro inválida.');
  const bytes=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'=');
  if(bytes.length!==32)throw new Error('Referência de registro inválida.');
  return [...bytes].map(byte=>byte.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}
/** Same head ID makes older clients stop safely instead of writing a stale fork. */
export function decodeRecordHead(raw:any,uid:string):RecordHead {
  let head=raw;
  if(raw?.storageSchema===5 && Array.isArray(raw.recordRows)) {
    if(!Array.isArray(raw.recordSections)||raw.records!==undefined)throw new Error('Índice de registros inválido.');
    head={...raw,records:raw.recordRows.map((row:any)=>{
      if(!Array.isArray(row)||row.length<4||row.length>5||!Number.isSafeInteger(row[0])||typeof raw.recordSections[row[0]]!=='string')throw new Error('Referência de registro inválida.');
      return {section:raw.recordSections[row[0]],id:row[1],documentId:row[2],digest:expandDigest(row[3]),...(row[4]?{depth:row[4]}:{})};
    })};
    delete head.recordRows;delete head.recordSections;
  }
  if(![4,5].includes(head?.storageSchema) || head.version!==head.storageSchema || head.userId!==uid || !Number.isSafeInteger(head.revision) || !Array.isArray(head.records) || !Array.isArray(head.sections) || !/^[a-f0-9]{64}$/.test(head.legacyDigest))throw new Error('Índice de registros inválido. Atualize o aplicativo; a base anterior foi preservada.');
  const keys=new Set<string>();
  for(const ref of head.records){
    if(![...ENTITY_SECTIONS,'finance.entries','finance.bills','field'].includes(ref.section)||typeof ref.id!=='string'||!ref.id||!recordIdPattern.test(ref.documentId)||!/^[a-f0-9]{64}$/.test(ref.digest)||keys.has(refKey(ref))||!Number.isSafeInteger(ref.depth||0)||(ref.depth||0)<0||(ref.depth||0)>MAX_DELTA_DEPTH)throw new Error('Referência de registro inválida.');
    keys.add(refKey(ref));
  }
  if(head.sections.some((s:any)=>![...ENTITY_SECTIONS,'finance.entries','finance.bills'].includes(s)))throw new Error('Seção de registros inválida.');
  return head;
}
function encodeRecordHead(head:RecordHead):any {
  if(head.storageSchema===4)return head;
  const {records,...header}=head,recordSections=[...new Set(records.map(ref=>ref.section))];
  return {...header,recordSections,recordRows:records.map(ref=>[recordSections.indexOf(ref.section),ref.id,ref.documentId,compactDigest(ref.digest),...(ref.depth?[ref.depth]:[])])};
}
async function readRecordValue(context:ReadContext,uid:string,ref:RecordRef,visiting=new Set<string>()):Promise<any> {
  if(visiting.has(ref.documentId)||visiting.size>MAX_DELTA_DEPTH)throw new Error('Cadeia de versões inválida.');
  const doc=await context.get(ref.documentId),record=doc?.data;
  if(!record||record.userId!==uid||![4,5].includes(record.storageSchema)||record.section!==ref.section||record.recordId!==ref.id)throw new Error('Um registro está ausente ou inválido. Nada foi substituído; o backup anterior continua preservado.');
  let value;
  if(record.storageSchema===5 && record.encoding==='delta') {
    if(!Number.isSafeInteger(record.depth)||record.depth<1||record.depth>MAX_DELTA_DEPTH||record.depth!==ref.depth||!recordIdPattern.test(record.baseDocumentId)||!/^[a-f0-9]{64}$/.test(record.baseDigest)||!record.changes||typeof record.changes!=='object'||Array.isArray(record.changes)||!Array.isArray(record.deletedFields)||record.deletedFields.some((key:any)=>typeof key!=='string'||Object.hasOwn(record.changes,key)))throw new Error('Cadeia de versões inválida.');
    const next=new Set(visiting).add(ref.documentId);
    const base=await readRecordValue(context,uid,{...ref,documentId:record.baseDocumentId,digest:record.baseDigest,depth:record.depth-1},next);
    if(!base||typeof base!=='object'||Array.isArray(base))throw new Error('Base da versão inválida.');
    value={...base,...cleanJSON(record.changes)};
    for(const key of record.deletedFields)delete value[key];
  } else {
    if((ref.depth||0)!==0 || !Object.hasOwn(record,'value'))throw new Error('Conteúdo de registro inválido.');
    value=cleanJSON(record.value);
  }
  if(await digest(value)!==ref.digest)throw new Error('Um registro está ausente ou inválido. Nada foi substituído; o backup anterior continua preservado.');
  return value;
}
export async function readRecordHead(context:ReadContext,uid:string,head:RecordHead): Promise<any> {
  head=decodeRecordHead(head,uid);const data:any=cleanJSON(head.header);
  for(const section of head.sections){if(section.startsWith('finance.')){data.finance||={};data.finance[section.split('.')[1]]=[];}else data[section]=[];}
  const loaded=await mapLimited(head.records,async ref => {
    return {ref,value:await readRecordValue(context,uid,ref)};
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
  const oldValues=new Map((current?splitWorkspace(current).values:[]).map(value=>[refKey(value),value.value]));
  const changed:StoreWrite[]=[];
  const records=await mapLimited(split.values,async value => {
    const hash=await digest(value.value), old=oldRefs.get(refKey(value));
    if(old?.digest===hash)return old;
    const keyHash=(await digest([value.section,value.id])).slice(0,32);
    const documentId=`r5_${keyHash}_${revision}`;
    const metadata={userId:uid,version:5,storageSchema:5,updatedAt:now,section:value.section,recordId:value.id};
    let payload:any={...metadata,value:value.value},depth=0;
    const previous=oldValues.get(refKey(value));
    if(old && (old.depth||0)<MAX_DELTA_DEPTH && previous && value.value && typeof previous==='object' && typeof value.value==='object' && !Array.isArray(previous) && !Array.isArray(value.value)) {
      const changes=Object.fromEntries(Object.entries(value.value).filter(([key,item])=>!Object.hasOwn(previous,key)||canonicalJSON(item)!==canonicalJSON(previous[key])));
      const deletedFields=Object.keys(previous).filter(key=>!Object.hasOwn(value.value,key));
      const delta={...metadata,encoding:'delta',baseDocumentId:old.documentId,baseDigest:old.digest,depth:(old.depth||0)+1,changes,deletedFields};
      // Unchanged images and long notes stay in the immutable prior version.
      if(new TextEncoder().encode(canonicalJSON(delta)).length<new TextEncoder().encode(canonicalJSON(payload)).length*.65){payload=delta;depth=delta.depth;}
    }
    changed.push({id:documentId,createOnly:true,data:payload});
    return {section:value.section,id:value.id,documentId,digest:hash,...(depth?{depth}:{})};
  });
  // Ignore transport timestamps/revision when deciding if business data changed.
  const businessEqual=head && changed.length===0 && recordOrderFingerprint(records)===recordOrderFingerprint(head.records) && canonicalJSON(split.sections)===canonicalJSON(head.sections) && canonicalJSON({...split.header,revision:0,version:0,updatedAt:'',lastModifiedBy:'',userId:uid})===canonicalJSON({...head.header,revision:0,version:0,updatedAt:'',lastModifiedBy:'',userId:uid});
  if(businessEqual)return {data:current,writes:[] as StoreWrite[],head};
  const header={...split.header,userId:uid,version:3,revision,updatedAt:now,lastModifiedBy:label};
  const nextHead:RecordHead={userId:uid,version:5,storageSchema:5,revision,updatedAt:now,lastModifiedBy:label,legacyDigest:head?.legacyDigest||await digest(legacy),header,sections:split.sections,records};
  const writes:StoreWrite[]=[...changed];
  if(head)writes.push({id:PREVIOUS_HEAD_ID,data:encodeRecordHead(head)});
  // Exactly one complete archive at migration; never rewrite it on normal edits.
  else if(legacy)writes.push({id:ARCHIVE_ID,createOnly:true,data:{...legacy,userId:uid,version:Number(legacy.version||3),updatedAt:legacy.updatedAt||now}});
  writes.push({id:HEAD_ID,data:encodeRecordHead(nextHead)});
  if(writes.length>450)throw new Error('Esta migração excede o lote seguro de registros. A base anterior não foi alterada.');
  return {data:{...cleanJSON(next),...header},writes,head:nextHead};
}
export function createRecordStore(adapter:RecordAdapter,uid:string) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw new Error('Identificador de usuário inválido.');
  async function load(context:ReadContext,previous=false) {
    const headDoc=await context.get(previous?PREVIOUS_HEAD_ID:HEAD_ID);
    if(headDoc){
      const head=decodeRecordHead(headDoc.data,uid);
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
      await mapLimited(plan.writes.filter(write=>write.createOnly),async write=>{if(await context.get(write.id))throw new Error('Um registro de destino já existe. Nada foi sobrescrito.');});
      for(const write of plan.writes)context.set(write);
      return plan.data;
    }),
  };
}
