import { createRecordStore, HEAD_ID, LEGACY_ID, WorkspaceRevisionError, canonicalJSON, decodeRecordHead, digest } from './workspaceRecordStore';
import { firestoreRecordAdapter } from './firestoreRecordAdapter';
import { cloudQuotaGuard } from './cloudQuotaGuard';
import { applyFinanceCommand, emptyFinance, validateFinanceData, type FinanceCommand } from "../utils/financeLedger";
import {
  doc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Material, Product, Purchase, Sale, Customer, Supplier, AtelierSettings, TodoItem, Production, ProductionProject, FinanceData, StockMovement } from '../types';

export interface WorkspaceData {
  finance?: FinanceData;
  stockMovements?: StockMovement[];
  materials: Material[];
  products: Product[];
  productions?: Production[];
  projects?: ProductionProject[];
  purchases: Purchase[];
  sales: Sale[];
  customers?: Customer[];
  paymentMethods?: string[];
  suppliers: Supplier[];
  settings: AtelierSettings;
  todos?: TodoItem[];
  version?: number;
  revision?: number;
  updatedAt?: string;
  lastModifiedBy?: string;
}

type WorkspaceEntityKey = 'materials' | 'products' | 'productions' | 'projects' | 'purchases' | 'sales' | 'customers' | 'suppliers' | 'todos';

export interface WorkspaceSyncBase {
  schema: 1;
  entities: Record<WorkspaceEntityKey, Record<string, string>>;
  paymentMethods: string;
  settings: string;
  bills?: Record<string, string>;
  accounts?: Record<string, string>;
  cards?: Record<string, string>;
}

export type CloudSyncStatus = 'offline' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

export class CloudSyncConflictError extends Error {
  cloudRevision: number;
  expectedRevision: number;
  cloudData?: WorkspaceData;

  constructor(cloudRevision: number, expectedRevision: number, cloudData?: WorkspaceData) {
    super('O backup da nuvem mudou desde a última sincronização. Nada foi sobrescrito.');
    this.name = 'CloudSyncConflictError';
    this.cloudRevision = cloudRevision;
    this.expectedRevision = expectedRevision;
    this.cloudData = cloudData;
  }
}

export class OrderSyncConflictError extends Error {
  constructor(order: Sale) {
    super(`O pedido #${order.orderNumber || order.id} recebeu outra alteração ou movimento na nuvem. Sua edição continua salva neste aparelho. Confira as duas versões antes de sincronizar.`);
    this.name = 'OrderSyncConflictError';
  }
}

function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as unknown as T;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map((item) => item === undefined ? null : sanitizeForFirestore(item)) as unknown as T;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) clean[key] = sanitizeForFirestore(value);
  }
  return clean as T;
}

function workspaceFromData(data: any): WorkspaceData {
  return {
    finance: data.finance || emptyFinance(), stockMovements: data.stockMovements || [],
    materials: data.materials || [], products: data.products || [], productions: data.productions || [], projects: data.projects || [],
    purchases: data.purchases || [], sales: data.sales || [], customers: data.customers || [],
    paymentMethods: data.paymentMethods || [], suppliers: data.suppliers || [], settings: data.settings,
    todos: data.todos || [], version: data.version, revision: data.revision || 0,
    updatedAt: data.updatedAt, lastModifiedBy: data.lastModifiedBy,
  };
}

const fingerprint = (value: unknown) => JSON.stringify(value === undefined ? '__missing__' : value);

function mergeEntityList<T extends { id: string }>(base: Record<string, string>, local: T[] = [], cloud: T[] = []): T[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  const cloudById = new Map(cloud.map((item) => [item.id, item]));
  const orderedIds = [
    ...local.map((item) => item.id),
    ...cloud.map((item) => item.id).filter((id) => !localById.has(id)),
    ...Object.keys(base).filter((id) => !localById.has(id) && !cloudById.has(id)),
  ];

  return orderedIds.flatMap((id) => {
    const localItem = localById.get(id);
    const cloudItem = cloudById.get(id);
    const localChanged = fingerprint(localItem) !== (base[id] ?? fingerprint(undefined));

    // A mudança pendente deste aparelho vence apenas para o registro alterado aqui.
    // Nos demais registros, preservamos a versão mais nova recebida da nuvem.
    const selected = localChanged ? localItem : cloudItem;
    return selected ? [selected] : [];
  });
}

function mergeValue<T>(baseFingerprint: string, local: T, cloud: T): T {
  return fingerprint(local) !== baseFingerprint ? local : cloud;
}

export function createWorkspaceSyncBase(workspace: WorkspaceData): WorkspaceSyncBase {
  const entities = {} as WorkspaceSyncBase['entities'];
  const lists: Record<WorkspaceEntityKey, Array<{ id: string }>> = {
    materials: workspace.materials,
    products: workspace.products,
    productions: workspace.productions || [],
    projects: workspace.projects || [],
    purchases: workspace.purchases,
    sales: workspace.sales,
    customers: workspace.customers || [],
    suppliers: workspace.suppliers,
    todos: workspace.todos || [],
  };

  (Object.keys(lists) as WorkspaceEntityKey[]).forEach((key) => {
    entities[key] = Object.fromEntries(lists[key].map((item) => [item.id, fingerprint(item)]));
  });

  return {
    schema: 1,
    entities,
    paymentMethods: fingerprint(workspace.paymentMethods || []),
    settings: fingerprint(workspace.settings),
    bills: Object.fromEntries((workspace.finance?.bills || []).map(b => [b.id, fingerprint(b)])),
    accounts: Object.fromEntries((workspace.finance?.accounts || []).map(account => [account.id, fingerprint(account)])),
    cards: Object.fromEntries((workspace.finance?.cards || []).map(card => [card.id, fingerprint(card)])),
  };
}

/**
 * Mesclagem em três vias: compara a cópia que este aparelho recebeu por último
 * com o estado local pendente e com a revisão atual da nuvem.
 */
export function mergeWorkspaceData(
  base: WorkspaceSyncBase,
  local: WorkspaceData,
  cloud: WorkspaceData
): WorkspaceData {
  // An offline edit may change reservations or release an overpayment as credit.
  // Never combine it blindly with a newer delivery, cancellation or receipt.
  // Unrelated orders, recipes and customer movements can still merge normally.
  const localEntries = new Map((local.finance?.entries || []).map(entry => [entry.id, entry]));
  const cloudSales = new Map(cloud.sales.map(sale => [sale.id, sale]));
  const editedSales: Sale[] = [];
  const same = (left: unknown, right: unknown) => canonicalJSON(sanitizeForFirestore(left ?? null)) === canonicalJSON(sanitizeForFirestore(right ?? null));
  // Reservations are derived from current stock, rather than a competing edit.
  const orderContent = (sale?: Sale) => sale && ({ ...sale, items: sale.items?.map(({ reservedQuantity, ...item }) => item) });
  const sameOrder = (left?: Sale, right?: Sale) => same(orderContent(left), orderContent(right));
  for (const sale of compactWorkspaceForCloud(local).sales) {
    const stored = base.entities.sales[sale.id];
    const previous = stored ? JSON.parse(stored) as Sale : undefined;
    if (sameOrder(sale, previous)) continue;
    const remote = cloudSales.get(sale.id);
    if (!sameOrder(remote, previous) && !sameOrder(remote, sale)) throw new OrderSyncConflictError(sale);
    if ((cloud.finance?.entries || []).some(entry => entry.saleId === sale.id && !same(entry, localEntries.get(entry.id)))) {
      throw new OrderSyncConflictError(sale);
    }
    editedSales.push(sale);
  }
  let merged: WorkspaceData = {
    ...cloud,
    finance: {
      ...cloud.finance, ...local.finance, version: 1,
      entries: unionRecords(local.finance?.entries, cloud.finance?.entries),
      bills: mergeEntityList(base.bills || {}, local.finance?.bills, cloud.finance?.bills),
      ...(local.finance?.accounts || cloud.finance?.accounts ? { accounts: mergeEntityList(base.accounts || {}, local.finance?.accounts, cloud.finance?.accounts) } : {}),
      ...(local.finance?.cards || cloud.finance?.cards ? { cards: mergeEntityList(base.cards || {}, local.finance?.cards, cloud.finance?.cards) } : {}),
    },
    stockMovements: unionRecords(local.stockMovements, cloud.stockMovements),
    materials: mergeEntityList(base.entities.materials, local.materials, cloud.materials),
    products: mergeEntityList(base.entities.products, local.products, cloud.products),
    productions: mergeEntityList(base.entities.productions, local.productions || [], cloud.productions || []),
    projects: mergeEntityList(base.entities.projects, local.projects || [], cloud.projects || []),
    purchases: mergeEntityList(base.entities.purchases, local.purchases, cloud.purchases),
    sales: mergeEntityList(base.entities.sales, local.sales, cloud.sales),
    customers: mergeEntityList(base.entities.customers, local.customers || [], cloud.customers || []),
    suppliers: mergeEntityList(base.entities.suppliers, local.suppliers, cloud.suppliers),
    todos: mergeEntityList(base.entities.todos, local.todos || [], cloud.todos || []),
    paymentMethods: mergeValue(base.paymentMethods, local.paymentMethods || [], cloud.paymentMethods || []),
    settings: mergeValue(base.settings, local.settings, cloud.settings),
  };
  // Recompute reservations with the latest merged stock and other orders. Local
  // receipts/credit releases keep their IDs and are not registered a second time.
  for (const sale of editedSales) merged = applyFinanceCommand(merged, { type: 'save_order', sale });
  return merged;
}

const isEmbeddedImage = (value?: string) =>
  typeof value === 'string' && value.startsWith('data:image/');

/**
 * Evita repetir a mesma foto Base64 em receitas, pedidos e produções.
 * A foto continua armazenada no produto do catálogo e as telas fazem fallback por productId.
 */
export function compactWorkspaceForCloud(workspace: WorkspaceData): WorkspaceData {
  const productImages = new Map(
    workspace.products
      .filter((product) => product.imageUrl)
      .map((product) => [product.id, product.imageUrl as string])
  );

  const matchesCatalogImage = (imageUrl: string | undefined, productIds: Array<string | undefined>) =>
    isEmbeddedImage(imageUrl) &&
    productIds.some((id) => !!id && productImages.get(id) === imageUrl);

  const sales = workspace.sales.map((sale) => {
    const firstItem = sale.items?.[0];
    const items = sale.items?.map((item) => {
      if (!matchesCatalogImage(item.productImageUrl, [item.customProductId, item.productId])) {
        return item;
      }
      const compactItem = { ...item };
      delete compactItem.productImageUrl;
      return compactItem;
    });

    const compactSale: Sale = { ...sale, items };
    if (
      matchesCatalogImage(sale.productImageUrl, [
        sale.productId,
        firstItem?.customProductId,
        firstItem?.productId,
      ])
    ) {
      delete compactSale.productImageUrl;
    }
    return compactSale;
  });

  const productions = (workspace.productions || []).map((production) => {
    if (!matchesCatalogImage(production.productImageUrl, [production.productId])) {
      return production;
    }
    const compactProduction = { ...production };
    delete compactProduction.productImageUrl;
    return compactProduction;
  });

  return {
    ...workspace,
    sales,
    productions,
  };
}

/**
 * Upload protegido por revisão (optimistic concurrency control).
 * Só grava se a revisão na nuvem ainda for exatamente a que este aparelho leu.
 * Antes de substituir o backup atual, preserva uma cópia na área de recuperação desta base.
 */
const stores = new Map<string, ReturnType<typeof createRecordStore>>();
function recordStore(userId:string) {
  let store=stores.get(userId);
  if(!store){store=createRecordStore(firestoreRecordAdapter(db,userId),userId);stores.set(userId,store);}
  return store;
}
async function mutateRecords(userId:string,mutator:(current:WorkspaceData|null)=>WorkspaceData,expectedRevision?:number,label='Web') {
  try { return workspaceFromData(await recordStore(userId).mutate(mutator,expectedRevision,label)); }
  catch(error){if(error instanceof WorkspaceRevisionError)throw new CloudSyncConflictError(error.cloudData.revision||0,error.expectedRevision,error.cloudData);throw error;}
}
export async function uploadWorkspaceToCloud(
  userId:string,workspace:WorkspaceData,deviceLabel='Web',expectedRevision?:number
):Promise<WorkspaceData> {
  if(!userId)throw new Error('Usuário não autenticado.');
  const compact=compactWorkspaceForCloud(workspace);
  validateFinanceData(compact.finance||emptyFinance());
  return mutateRecords(userId,()=>sanitizeForFirestore(compact),expectedRevision,deviceLabel);
}
const workspaceReads = new Map<string, Promise<WorkspaceData | null>>();
const workspaceObservations = new Map<string, { head: string | null; legacyDigest: string }>();
export function fetchWorkspaceFromCloud(userId:string):Promise<WorkspaceData|null> {
  if(!userId)return Promise.resolve(null);
  const pending=workspaceReads.get(userId);
  if(pending)return pending;
  const read=recordStore(userId).read()
    .then(async loaded=>{
      if(loaded)workspaceObservations.set(userId,{head:loaded.head?canonicalJSON(loaded.head):null,legacyDigest:loaded.head?.legacyDigest||await digest(loaded.data)});
      return loaded?workspaceFromData(loaded.data):null;
    })
    .finally(()=>{workspaceReads.delete(userId);});
  workspaceReads.set(userId,read);
  return read;
}
export async function fetchPreviousWorkspaceFromCloud(userId:string):Promise<WorkspaceData|null> {
  if(!userId)return null;
  const loaded=await recordStore(userId).previous();
  return loaded?workspaceFromData(loaded.data):null;
}
export function subscribeToWorkspace(userId:string,onData:(data:WorkspaceData)=>void,onError?:(error:Error)=>void):Unsubscribe {
  let stopped=false,sequence=0;
  try { cloudQuotaGuard.assertAllowed(userId,'read'); }
  catch(error) { queueMicrotask(()=>{if(!stopped)onError?.(error as Error);}); return ()=>{stopped=true;}; }
  let running=false,requested=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  // Both listeners are needed during cutover: a stale tab must never silently
  // change the legacy workspace behind the new record-based store.
  const refresh=async()=>{
    running=true;
    try {
      while(requested&&!stopped){
        requested=false;const current=sequence;
        try{const data=await fetchWorkspaceFromCloud(userId);if(!stopped&&current===sequence&&data)onData(data);}
        catch(error){if(!stopped&&current===sequence)onError?.(error as Error);}
      }
    } finally {running=false;}
  };
  const schedule=()=>{
    sequence++;requested=true;
    if(stopped||running||timer!==undefined)return;
    // The two initial snapshots describe one workspace, not two full downloads.
    timer=setTimeout(()=>{timer=undefined;void refresh();},0);
  };
  const listeners=[HEAD_ID,LEGACY_ID].map(id=>onSnapshot(doc(db,'users',userId,'workspaces',id),async snapshot=>{
    if(snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache||stopped)return;
    try {
      const known=workspaceObservations.get(userId);
      if(known && typeof snapshot.exists==='function') {
        if(id===HEAD_ID) {
          const fingerprint=snapshot.exists()?canonicalJSON(decodeRecordHead(snapshot.data(),userId)):null;
          if(fingerprint===known.head)return;
        } else if(await digest(snapshot.exists()?snapshot.data():null)===known.legacyDigest)return;
      }
      if(!stopped)schedule();
    }catch(error){if(!stopped)onError?.(error as Error);}
  },error=>{if(!stopped)onError?.(error);}));
  const stop=()=>{stopped=true;sequence++;if(timer!==undefined)clearTimeout(timer);listeners.forEach(unsubscribe=>unsubscribe());};
  const stopQuotaWatch=cloudQuotaGuard.subscribe(userId,()=>{
    try { cloudQuotaGuard.assertAllowed(userId,'read'); }
    catch(error) { stop();onError?.(error as Error); }
  });
  return ()=>{stop();stopQuotaWatch();};
}

function unionRecords<T extends { id: string }>(local: T[] = [], cloud: T[] = []): T[] {
  const map = new Map(local.map(e => [e.id, e])); for (const e of cloud) map.set(e.id, e); return [...map.values()];
}
/** Each credit/order operation is recomputed inside the Firestore transaction. */
export async function executeFinanceInCloud(userId:string,local:WorkspaceData,base:WorkspaceSyncBase|null,command:FinanceCommand,expectedRevision=local.revision):Promise<WorkspaceData> {
  // Re-read and recalculate inside one transaction. A retry never consumes
  // stock or credit twice, and unrelated record changes are preserved.
  let expected=expectedRevision;
  for(let attempt=0;attempt<3;attempt++) {
    try{return await mutateRecords(userId,cloud=>{
      const merged=cloud?mergeWorkspaceData(base||createWorkspaceSyncBase(cloud),local,cloud):local;
      if(cloud)merged.sales=merged.sales.map(s=>{
        const current=cloud.sales.find(x=>x.id===s.id);
        if(!current?.financialTracking)return s;
        return {...s,commercialStatus:current.commercialStatus,cancelledAt:current.cancelledAt,financialTracking:true,legacyPaidCents:current.legacyPaidCents,returnAdjustmentCents:current.returnAdjustmentCents,deliveryHistory:current.deliveryHistory,items:s.items?.map(it=>{const ci=current.items?.find(x=>x.id===it.id);return ci?{...it,deliveredQuantity:ci.deliveredQuantity,returnedQuantity:ci.returnedQuantity,stockConsumedQuantity:ci.stockConsumedQuantity}:it;})};
      });
      return sanitizeForFirestore(compactWorkspaceForCloud(applyFinanceCommand(merged,command)));
    },expected,'Financeiro');}catch(error){if(error instanceof CloudSyncConflictError&&attempt<2){expected=error.cloudRevision;continue;}throw error;}
  }
  throw new Error('Não foi possível concluir a operação financeira.');
}
