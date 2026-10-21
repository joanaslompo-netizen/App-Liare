import { createRecordStore, HEAD_ID, LEGACY_ID, WorkspaceRevisionError } from './workspaceRecordStore';
import { firestoreRecordAdapter } from './firestoreRecordAdapter';
import { applyFinanceCommand, emptyFinance, validateFinanceData, type FinanceCommand } from "../utils/financeLedger";
import {
  doc,
  setDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, User } from '../lib/firebase';
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

export async function syncUserProfile(user: User): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Artesã(o)',
      photoURL: user.photoURL || '',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Erro ao sincronizar perfil de usuário no Firestore:', err);
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
  return {
    ...cloud,
    finance: { version: 1, entries: unionRecords(local.finance?.entries, cloud.finance?.entries), bills: mergeEntityList(base.bills || {}, local.finance?.bills, cloud.finance?.bills) },
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
export async function fetchWorkspaceFromCloud(userId:string):Promise<WorkspaceData|null> {
  if(!userId)return null;
  const loaded=await recordStore(userId).read();
  return loaded?workspaceFromData(loaded.data):null;
}
export async function fetchPreviousWorkspaceFromCloud(userId:string):Promise<WorkspaceData|null> {
  if(!userId)return null;
  const loaded=await recordStore(userId).previous();
  return loaded?workspaceFromData(loaded.data):null;
}
export function subscribeToWorkspace(userId:string,onData:(data:WorkspaceData)=>void,onError?:(error:Error)=>void):Unsubscribe {
  let stopped=false,sequence=0;
  // Both listeners are needed during cutover: a stale tab must never silently
  // change the legacy workspace behind the new record-based store.
  const refresh=async()=>{const current=++sequence;try{const data=await fetchWorkspaceFromCloud(userId);if(!stopped&&current===sequence&&data)onData(data);}catch(error){if(!stopped&&current===sequence)onError?.(error as Error);}};
  const listeners=[HEAD_ID,LEGACY_ID].map(id=>onSnapshot(doc(db,'users',userId,'workspaces',id),snapshot=>{
    if(!snapshot.metadata.hasPendingWrites)void refresh();
  },error=>{if(!stopped)onError?.(error);}));
  return ()=>{stopped=true;sequence++;listeners.forEach(unsubscribe=>unsubscribe());};
}

function unionRecords<T extends { id: string }>(local: T[] = [], cloud: T[] = []): T[] {
  const map = new Map(local.map(e => [e.id, e])); for (const e of cloud) map.set(e.id, e); return [...map.values()];
}
/** Each credit/order operation is recomputed inside the Firestore transaction. */
export async function executeFinanceInCloud(userId:string,local:WorkspaceData,base:WorkspaceSyncBase|null,command:FinanceCommand):Promise<WorkspaceData> {
  // Re-read and recalculate inside one transaction. A retry never consumes
  // stock or credit twice, and unrelated record changes are preserved.
  const store=recordStore(userId);
  for(let attempt=0;attempt<3;attempt++) {
    const loaded=await store.read();const expected=loaded?.data?.revision;
    try{return await mutateRecords(userId,cloud=>{
      const merged=cloud?mergeWorkspaceData(base||createWorkspaceSyncBase(cloud),local,cloud):local;
      if(cloud)merged.sales=merged.sales.map(s=>{
        const current=cloud.sales.find(x=>x.id===s.id);
        if(!current?.financialTracking)return s;
        return {...s,commercialStatus:current.commercialStatus,cancelledAt:current.cancelledAt,financialTracking:true,legacyPaidCents:current.legacyPaidCents,returnAdjustmentCents:current.returnAdjustmentCents,deliveryHistory:current.deliveryHistory,items:s.items?.map(it=>{const ci=current.items?.find(x=>x.id===it.id);return ci?{...it,deliveredQuantity:ci.deliveredQuantity,returnedQuantity:ci.returnedQuantity,stockConsumedQuantity:ci.stockConsumedQuantity}:it;})};
      });
      return sanitizeForFirestore(compactWorkspaceForCloud(applyFinanceCommand(merged,command)));
    },expected,'Financeiro');}catch(error){if(error instanceof CloudSyncConflictError&&attempt<2)continue;throw error;}
  }
  throw new Error('Não foi possível concluir a operação financeira.');
}
