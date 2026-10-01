import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  Unsubscribe
} from 'firebase/firestore';
import { db, User } from '../lib/firebase';
import { Material, Product, Purchase, Sale, Customer, Supplier, AtelierSettings, TodoItem, Production, ProductionProject } from '../types';

export interface WorkspaceData {
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
 * Antes de substituir o backup atual, preserva uma cópia em workspaces/previous.
 */
export async function uploadWorkspaceToCloud(
  userId: string,
  workspace: WorkspaceData,
  deviceLabel: string = 'Web',
  expectedRevision?: number
): Promise<WorkspaceData> {
  if (!userId) throw new Error('Usuário não autenticado.');

  const workspaceRef = doc(db, 'users', userId, 'workspaces', 'default');
  const previousRef = doc(db, 'users', userId, 'workspaces', 'previous');

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(workspaceRef);
    const current = snap.exists() ? snap.data() : null;
    const cloudRevision = Number(current?.revision || 0);

    // Existing legacy backups have revision 0. A client that has read them also expects 0.
    const currentWorkspace = current ? workspaceFromData(current) : undefined;

    if (snap.exists() && expectedRevision === undefined) {
      throw new CloudSyncConflictError(cloudRevision, -1, currentWorkspace);
    }
    if (snap.exists() && cloudRevision !== Number(expectedRevision || 0)) {
      throw new CloudSyncConflictError(
        cloudRevision,
        Number(expectedRevision || 0),
        currentWorkspace
      );
    }

    const now = new Date().toISOString();
    const nextRevision = cloudRevision + 1;
    const compactWorkspace = compactWorkspaceForCloud(workspace);
    const payload = sanitizeForFirestore({
      userId,
      version: 2,
      revision: nextRevision,
      updatedAt: now,
      lastModifiedBy: deviceLabel,
      materials: compactWorkspace.materials,
      products: compactWorkspace.products,
      productions: compactWorkspace.productions || [],
      projects: compactWorkspace.projects || [],
      purchases: compactWorkspace.purchases,
      sales: compactWorkspace.sales,
      customers: compactWorkspace.customers || [],
      paymentMethods: compactWorkspace.paymentMethods || [],
      suppliers: compactWorkspace.suppliers,
      settings: compactWorkspace.settings,
      todos: compactWorkspace.todos || [],
    });

    if (current) {
      transaction.set(previousRef, sanitizeForFirestore({
        ...current,
        backupOfRevision: cloudRevision,
        backedUpAt: now,
      }));
    }
    transaction.set(workspaceRef, payload);
    return workspaceFromData(payload);
  });
}

export async function fetchWorkspaceFromCloud(userId: string): Promise<WorkspaceData | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, 'users', userId, 'workspaces', 'default'));
  return snap.exists() ? workspaceFromData(snap.data()) : null;
}

export async function fetchPreviousWorkspaceFromCloud(userId: string): Promise<WorkspaceData | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, 'users', userId, 'workspaces', 'previous'));
  return snap.exists() ? workspaceFromData(snap.data()) : null;
}

export function subscribeToWorkspace(
  userId: string,
  onData: (data: WorkspaceData) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'users', userId, 'workspaces', 'default'), (snapshot) => {
    if (snapshot.exists()) onData(workspaceFromData(snapshot.data()));
  }, (error) => {
    console.warn('Erro na escuta em tempo real do Firestore:', error);
    if (onError) onError(error);
  });
}
