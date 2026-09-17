import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
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
  updatedAt?: string;
  lastModifiedBy?: string;
}

export type CloudSyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error';

/**
 * Saves or updates user profile in /users/{userId}
 */
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

/**
 * Recursively sanitizes data before sending to Firestore:
 * - Removes keys with undefined values from objects
 * - Converts undefined in arrays to null
 */
function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => (item === undefined ? null : sanitizeForFirestore(item))) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}

/**
 * Uploads full atelier workspace to /users/{userId}/workspaces/default
 */
export async function uploadWorkspaceToCloud(
  userId: string, 
  workspace: WorkspaceData,
  deviceLabel: string = 'Web'
): Promise<void> {
  if (!userId) return;

  const workspaceRef = doc(db, 'users', userId, 'workspaces', 'default');
  const payload = {
    userId,
    version: 1,
    updatedAt: new Date().toISOString(),
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
  };

  const sanitizedPayload = sanitizeForFirestore(payload);
  await setDoc(workspaceRef, sanitizedPayload, { merge: true });
}

/**
 * Fetches workspace from cloud (one-time)
 */
export async function fetchWorkspaceFromCloud(userId: string): Promise<WorkspaceData | null> {
  if (!userId) return null;
  const workspaceRef = doc(db, 'users', userId, 'workspaces', 'default');
  const snap = await getDoc(workspaceRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      materials: data.materials || [],
      products: data.products || [],
      productions: data.productions || [],
      purchases: data.purchases || [],
      sales: data.sales || [],
      customers: data.customers || [],
      paymentMethods: data.paymentMethods || [],
      suppliers: data.suppliers || [],
      settings: data.settings,
      todos: data.todos || [],
      version: data.version,
      updatedAt: data.updatedAt,
      lastModifiedBy: data.lastModifiedBy,
    };
  }
  return null;
}

/**
 * Subscribes to real-time changes of the workspace document
 */
export function subscribeToWorkspace(
  userId: string,
  onData: (data: WorkspaceData) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const workspaceRef = doc(db, 'users', userId, 'workspaces', 'default');
  
  return onSnapshot(
    workspaceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onData({
          materials: data.materials || [],
          products: data.products || [],
          productions: data.productions || [],
          purchases: data.purchases || [],
          sales: data.sales || [],
          customers: data.customers || [],
          paymentMethods: data.paymentMethods || [],
          suppliers: data.suppliers || [],
          settings: data.settings,
          todos: data.todos || [],
          version: data.version,
          updatedAt: data.updatedAt,
          lastModifiedBy: data.lastModifiedBy,
        });
      }
    },
    (error) => {
      console.warn('Erro na escuta em tempo real do Firestore:', error);
      if (onError) onError(error);
    }
  );
}
