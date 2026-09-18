import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  Unsubscribe
} from 'firebase/firestore';
import { db, User } from '../lib/firebase';
import { Material, Product, Purchase, Sale, Customer, Supplier, AtelierSettings, TodoItem, Production } from '../types';

export interface WorkspaceData {
  materials: Material[];
  products: Product[];
  productions?: Production[];
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

export type CloudSyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error';

export class CloudSyncConflictError extends Error {
  constructor(public cloudRevision: number, public expectedRevision: number) {
    super('O backup da nuvem mudou desde a última sincronização. Nada foi sobrescrito.');
    this.name = 'CloudSyncConflictError';
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
    materials: data.materials || [], products: data.products || [], productions: data.productions || [],
    purchases: data.purchases || [], sales: data.sales || [], customers: data.customers || [],
    paymentMethods: data.paymentMethods || [], suppliers: data.suppliers || [], settings: data.settings,
    todos: data.todos || [], version: data.version, revision: data.revision || 0,
    updatedAt: data.updatedAt, lastModifiedBy: data.lastModifiedBy,
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
    if (snap.exists() && expectedRevision === undefined) {
      throw new CloudSyncConflictError(cloudRevision, -1);
    }
    if (snap.exists() && cloudRevision !== Number(expectedRevision || 0)) {
      throw new CloudSyncConflictError(cloudRevision, Number(expectedRevision || 0));
    }

    const now = new Date().toISOString();
    const nextRevision = cloudRevision + 1;
    const payload = sanitizeForFirestore({
      userId,
      version: 2,
      revision: nextRevision,
      updatedAt: now,
      lastModifiedBy: deviceLabel,
      materials: workspace.materials,
      products: workspace.products,
      productions: workspace.productions || [],
      purchases: workspace.purchases,
      sales: workspace.sales,
      customers: workspace.customers || [],
      paymentMethods: workspace.paymentMethods || [],
      suppliers: workspace.suppliers,
      settings: workspace.settings,
      todos: workspace.todos || [],
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
