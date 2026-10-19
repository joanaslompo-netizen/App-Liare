import { workspaceStorage as localStorage } from './utils/workspaceStorage';
import { getProductFinancialSplit } from "./utils/financials";
import { FinanceView } from "./components/FinanceView";
import { OrderDetailView, type OrderFocus } from "./components/OrderDetailView";
import { applyFinanceCommand, emptyFinance, projectOrder, type FinanceCommand } from "./utils/financeLedger";
import { executeFinanceInCloud } from "./services/cloudSync";
import { saveWorkspaceSnapshot } from "./utils/storage";
import type { FinanceData, StockMovement } from "./types";
import { ensureOrderNumbers, getHighestOrderNumber } from './utils/orderNumbers';
import React, { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { 
  loadStoredData, 
  cascadeRecalculateAllProducts,
  getVirtualRecipeLaborCost,
  DEFAULT_TODOS,
  DEFAULT_SETTINGS
} from './utils/storage';
import { 
  Material, 
  Product, 
  Purchase, 
  Production,
  ProductionIngredientDeduction,
  Sale,
  SaleItem,
  Customer,
  Supplier, 
  AtelierSettings,
  TodoItem,
  ProductionProject,
  NavTab
} from './types';
import { getUnitConversionMultiplier, isBirthdayInMonth } from './utils/formatters';
import { AtelierPreset } from './utils/presets';
import { HomeView } from './components/HomeView';
import { MaterialsView } from './components/MaterialsView';
import { ProductsView } from './components/ProductsView';
import { ProjectsView } from './components/ProjectsView';
import { PurchasesView } from './components/PurchasesView';
import { ProductionsView } from './components/ProductionsView';
import { SalesView } from './components/SalesView';
import { CustomersView } from './components/CustomersView';
import { ReportsView } from './components/ReportsView';
import { SuppliersView } from './components/SuppliersView';
import { SettingsModal } from './components/SettingsModal';
import { ExampleSelectorModal } from './components/ExampleSelectorModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  onAuthStateChanged, 
  User 
} from './lib/firebase';
import { 
  uploadWorkspaceToCloud, 
  subscribeToWorkspace, 
  syncUserProfile, 
  fetchWorkspaceFromCloud, 
  fetchPreviousWorkspaceFromCloud,
  mergeWorkspaceData,
  createWorkspaceSyncBase,
  WorkspaceData,
  WorkspaceSyncBase,
  CloudSyncStatus,
  CloudSyncConflictError
} from './services/cloudSync';
import { CheckCircle2, X, ShoppingBag, Hammer, Package, Tag, BarChart3, Plus, Settings, AlertTriangle, ClipboardList } from 'lucide-react';

const withDefaultDiscountCodes = (incoming: AtelierSettings): AtelierSettings => ({
  ...incoming,
  discountCodes:
    Array.isArray(incoming?.discountCodes)
      ? incoming.discountCodes
      : (DEFAULT_SETTINGS.discountCodes || []),
});

const CLOUD_SYNC_PENDING_KEY = 'atelie_cloud_sync_pending_v1';
const CLOUD_SYNC_BASE_KEY = 'atelie_cloud_sync_base_v1';
const CLOUD_SYNC_RECOVERY_KEY = 'atelie_cloud_sync_recovery_v1';
const AUTO_SYNC_DELAY_MS = 2000;

const readStoredCloudBase = (): WorkspaceSyncBase | null => {
  try {
    const stored = localStorage.getItem(CLOUD_SYNC_BASE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const storeCloudBase = (workspace: WorkspaceData) => {
  try {
    localStorage.setItem(CLOUD_SYNC_BASE_KEY, JSON.stringify(createWorkspaceSyncBase(workspace)));
  } catch (error) {
    console.warn('Não foi possível guardar a base local da sincronização:', error);
  }
};

const storePendingSync = (pending: boolean) => {
  try {
    if (pending) localStorage.setItem(CLOUD_SYNC_PENDING_KEY, 'true');
    else localStorage.removeItem(CLOUD_SYNC_PENDING_KEY);
  } catch (error) {
    console.warn('Não foi possível atualizar o estado local da sincronização:', error);
  }
};

export default function App() {
  // Load only this workspace’s device cache; a new cache starts empty.
  const [initialData] = useState(() => loadStoredData());
  const localStorageLimited = useSyncExternalStore(localStorage.subscribe, localStorage.isLimited, () => false);

  const [materials, setMaterials] = useState<Material[]>(initialData.materials);
  const [products, setProducts] = useState<Product[]>(initialData.products);
  const [purchases, setPurchases] = useState<Purchase[]>(initialData.purchases);
  const [productions, setProductions] = useState<Production[]>(initialData.productions || []);
  const [productionInitialProduct, setProductionInitialProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<Sale[]>(() => ensureOrderNumbers(initialData.sales, initialData.settings?.lastOrderNumber || 0));
  const [customers, setCustomers] = useState<Customer[]>(initialData.customers || []);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialData.paymentMethods || ['offline', 'site']);
  const [customerForNewSale, setCustomerForNewSale] = useState<Customer | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialData.suppliers);
  const [settings, setSettings] = useState<AtelierSettings>(() =>
    withDefaultDiscountCodes(initialData.settings)
  );
  const [todos, setTodos] = useState<TodoItem[]>(initialData.todos || DEFAULT_TODOS);
  const [finance, setFinance] = useState<FinanceData>(initialData.finance || emptyFinance());
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(initialData.stockMovements || []);
  const [financeBusy, setFinanceBusy] = useState(false);
  const financeLock = useRef(false);
  const [workflowSaleId, setWorkflowSaleId] = useState<string | null>(null);
  const [workflowFocus, setWorkflowFocus] = useState<OrderFocus>('overview');
  const orderReturnScroll = useRef(0);
  const displaySales = useMemo(() => sales.map(s => projectOrder(s, finance)), [sales, finance]);
  const [projects, setProjects] = useState<ProductionProject[]>(initialData.projects || []);

  // Cloud Sync & Auth State
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  const isIncomingCloudSyncRef = useRef(false);
  const syncTimeoutRef = useRef<any>(null);
  const cloudRevisionRef = useRef<number | undefined>(undefined);
  const cloudWorkspaceRef = useRef<WorkspaceData | null>(null);
  const hasLoadedCloudRef = useRef(false);
  const hasLocalChangesRef = useRef(localStorage.getItem(CLOUD_SYNC_PENDING_KEY) === 'true');
  const cloudBaseRef = useRef<WorkspaceSyncBase | null>(readStoredCloudBase());
  const workspaceRef = useRef<WorkspaceData>({
    materials, products, purchases, productions, sales, customers,
    paymentMethods, suppliers, settings, todos, projects, finance, stockMovements,
  });
  const localChangeVersionRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const syncAgainRef = useRef(false);
  const performCloudSyncRef = useRef<(showFeedback?: boolean) => Promise<void>>(async () => {});
  const hasObservedWorkspaceRef = useRef(false);

  // Active navigation tab - default to 'home' (initial dashboard screen)
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [filterLowStockInitial, setFilterLowStockInitial] = useState(false);
  const [homeSaleId, setHomeSaleId] = useState<string | null>(null);
  const [salesInitialFilter, setSalesInitialFilter] = useState<'all' | 'pending_delivery' | 'pending_payment'>('all');

  useEffect(() => { setWorkflowSaleId(null); }, [activeTab]);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExampleSelectorOpen, setIsExampleSelectorOpen] = useState(false);
  const [isQuickMoreOpen, setIsQuickMoreOpen] = useState(false);
  const [quickNewSaleSignal, setQuickNewSaleSignal] = useState(0);
  const [quickNewMaterialSignal, setQuickNewMaterialSignal] = useState(0);
  const [homeNewProductionSignal, setHomeNewProductionSignal] = useState(0);
  const [homeNewPurchaseSignal, setHomeNewPurchaseSignal] = useState(0);

  useEffect(() => {
    if (activeTab !== 'sales') setQuickNewSaleSignal(0);
    if (activeTab !== 'productions') setHomeNewProductionSignal(0);
    if (activeTab !== 'purchases') setHomeNewPurchaseSignal(0);
  }, [activeTab]);

  workspaceRef.current = {
    materials, products, purchases, productions, sales, customers,
    paymentMethods, suppliers, settings, todos, projects, finance, stockMovements,
  };

  const applyWorkspaceData = useCallback((workspace: WorkspaceData) => {
    isIncomingCloudSyncRef.current = true;
    workspaceRef.current = workspace;
    saveWorkspaceSnapshot(workspace);
    setFinance(workspace.finance || emptyFinance());
    setStockMovements(workspace.stockMovements || []);
    setMaterials(workspace.materials || []);
    setProducts(workspace.products || []);
    setPurchases(workspace.purchases || []);
    setProductions(workspace.productions || []);
    setSales(ensureOrderNumbers(workspace.sales || [], workspace.settings?.lastOrderNumber || 0));
    setCustomers(workspace.customers || []);
    setPaymentMethods(workspace.paymentMethods || []);
    setSuppliers(workspace.suppliers || []);
    if (workspace.settings) setSettings(withDefaultDiscountCodes(workspace.settings));
    setTodos(workspace.todos || []);
    setProjects(workspace.projects || []);
  }, []);

  const protectCurrentWorkspace = useCallback(() => {
    try {
      localStorage.setItem(CLOUD_SYNC_RECOVERY_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        workspace: workspaceRef.current,
      }));
    } catch (error) {
      console.warn('Não foi possível criar a cópia local de segurança:', error);
    }
  }, []);

  const handleFinanceAction = useCallback(async (command: FinanceCommand): Promise<boolean> => {
    if (financeLock.current || syncInFlightRef.current) { alert('Aguarde a operação em andamento.'); return false; }
    financeLock.current = true; setFinanceBusy(true); syncInFlightRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    try {
      if (user && (!hasLoadedCloudRef.current || !navigator.onLine)) throw new Error('Conecte a conta e aguarde a sincronização para registrar este movimento.');
      const updated = user ? await executeFinanceInCloud(user.uid, workspaceRef.current, cloudBaseRef.current, command) : applyFinanceCommand(workspaceRef.current, command);
      if (!localStorage.getItem("atelie_finance_initial_backup_v1")) localStorage.setItem("atelie_finance_initial_backup_v1", JSON.stringify(workspaceRef.current));
      saveWorkspaceSnapshot(updated);
      applyWorkspaceData(updated);
      if (user) {
        cloudWorkspaceRef.current = updated; cloudRevisionRef.current = updated.revision || 0;
        cloudBaseRef.current = createWorkspaceSyncBase(updated); storeCloudBase(updated);
        hasLocalChangesRef.current = false; storePendingSync(false); setSyncStatus('synced'); setLastSyncedAt(new Date());
      } else { hasLocalChangesRef.current = true; storePendingSync(true); setSyncStatus('offline'); }
      return true;
    } catch (error) { alert(error instanceof Error ? error.message : 'Não foi possível registrar.'); return false; }
    finally { financeLock.current = false; syncInFlightRef.current = false; setFinanceBusy(false); }
  }, [user, applyWorkspaceData]);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (!syncNotification) return;
    const timer = setTimeout(() => {
      setSyncNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [syncNotification]);

  const performCloudSync = useCallback(async (showFeedback = false) => {
    if (!user || !hasLoadedCloudRef.current) return;

    if (syncInFlightRef.current) {
      syncAgainRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    syncAgainRef.current = false;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setSyncStatus('syncing');

    const startedAtVersion = localChangeVersionRef.current;
    const localSnapshot = workspaceRef.current;
    const mergeBase = cloudBaseRef.current;

    try {
      let uploaded: WorkspaceData | null = null;
      let lastConflict: CloudSyncConflictError | null = null;
      let cloud = cloudWorkspaceRef.current;

      for (let attempt = 0; attempt < 3 && !uploaded; attempt += 1) {
        if (!hasLocalChangesRef.current && cloud) {
          uploaded = cloud;
          break;
        }

        const workspaceToUpload = cloud
          ? mergeWorkspaceData(mergeBase || createWorkspaceSyncBase(cloud), localSnapshot, cloud)
          : localSnapshot;

        try {
          uploaded = await uploadWorkspaceToCloud(
            user.uid,
            workspaceToUpload,
            'Web',
            cloud?.revision ?? cloudRevisionRef.current
          );
        } catch (error) {
          if (error instanceof CloudSyncConflictError) {
            lastConflict = error;
            if (error.cloudData) {
              cloud = error.cloudData;
              cloudWorkspaceRef.current = error.cloudData;
              cloudRevisionRef.current = error.cloudData.revision || 0;
              continue;
            }
          }
          throw error;
        }
      }

      if (!uploaded) throw lastConflict || new Error('Não foi possível concluir a sincronização.');

      cloudWorkspaceRef.current = uploaded;
      cloudRevisionRef.current = uploaded.revision || 0;
      setLastSyncedAt(new Date());

      if (localChangeVersionRef.current === startedAtVersion) {
        hasLocalChangesRef.current = false;
        storePendingSync(false);
        cloudBaseRef.current = createWorkspaceSyncBase(uploaded);
        storeCloudBase(uploaded);
        applyWorkspaceData(uploaded);
        setSyncStatus('synced');
        if (showFeedback) {
          setSyncNotification({
            message: 'Alterações enviadas com segurança. A versão anterior foi preservada como backup.',
            type: 'success',
          });
        }
      } else {
        hasLocalChangesRef.current = true;
        storePendingSync(true);
        setSyncStatus('pending');
        syncAgainRef.current = true;
      }
    } catch (error) {
      console.warn('Erro ao enviar dados para a nuvem:', error);
      hasLocalChangesRef.current = true;
      storePendingSync(true);
      setSyncStatus(error instanceof CloudSyncConflictError ? 'pending' : 'error');
      setSyncNotification({
        message: error instanceof CloudSyncConflictError
          ? 'Sua alteração continua salva neste aparelho e será enviada novamente automaticamente.'
          : 'Não foi possível acessar a nuvem agora. Sua alteração continua salva neste aparelho.',
        type: error instanceof CloudSyncConflictError ? 'info' : 'error',
      });
      syncAgainRef.current = true;
    } finally {
      syncInFlightRef.current = false;
      if (syncAgainRef.current) {
        syncAgainRef.current = false;
        syncTimeoutRef.current = setTimeout(() => {
          void performCloudSyncRef.current(false);
        }, AUTO_SYNC_DELAY_MS);
      }
    }
  }, [applyWorkspaceData, user]);

  performCloudSyncRef.current = performCloudSync;

  // Firebase Auth State Listener & Cloud Sync Subscription
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setSyncStatus('syncing');
        await syncUserProfile(currentUser);

        try {
          // Fetch user's cloud workspace
          const cloudData = await fetchWorkspaceFromCloud(currentUser.uid);
          
          if (cloudData) {
            cloudWorkspaceRef.current = cloudData;
            cloudRevisionRef.current = cloudData.revision || 0;
            hasLoadedCloudRef.current = true;

            if (hasLocalChangesRef.current) {
              // Existe trabalho local ainda não enviado: mantenha-o visível e use a
              // nuvem apenas como referência para a próxima mesclagem automática.
              if (!cloudBaseRef.current) {
                cloudBaseRef.current = createWorkspaceSyncBase(cloudData);
                storeCloudBase(cloudData);
              }
              setSyncStatus('pending');
              syncTimeoutRef.current = setTimeout(() => {
                void performCloudSyncRef.current(false);
              }, AUTO_SYNC_DELAY_MS);
            } else {
              cloudBaseRef.current = createWorkspaceSyncBase(cloudData);
              storeCloudBase(cloudData);
              applyWorkspaceData(cloudData);
              setSyncStatus('synced');
              setLastSyncedAt(new Date());
              setSyncNotification({
                message: `Conectado como ${currentUser.email}! Dados sincronizados com seu Notebook, Celular e Tablet.`,
                type: 'success',
              });
            }
          } else {
            // First time this user connects: upload their current local workspace to cloud so nothing is lost!
            const createdCloud = await uploadWorkspaceToCloud(currentUser.uid, {
              materials,
              products,
              purchases,
              productions,
              sales,
              customers,
              paymentMethods,
              suppliers,
              settings,
              todos,
              projects, finance, stockMovements,
            });
            cloudWorkspaceRef.current = createdCloud;
            cloudRevisionRef.current = createdCloud.revision || 1;
            hasLoadedCloudRef.current = true;
            hasLocalChangesRef.current = false;
            storePendingSync(false);
            cloudBaseRef.current = createWorkspaceSyncBase(createdCloud);
            storeCloudBase(createdCloud);
            isIncomingCloudSyncRef.current = true;
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            setSyncNotification({
              message: `Conta Google vinculada com sucesso! Seus dados cadastrados foram salvos com segurança na nuvem.`,
              type: 'success',
            });
          }
        } catch (err) {
          console.warn('Erro ao carregar dados do usuário na nuvem:', err);
          setSyncStatus('error');
        }

        // Subscribe to real-time changes across devices (Notebook <-> Phone <-> Tablet)
        unsubscribeDoc = subscribeToWorkspace(
          currentUser.uid,
          (updatedData) => {
            if (updatedData) {
              cloudWorkspaceRef.current = updatedData;
              const incomingRevision = updatedData.revision || 0;
              if (incomingRevision === cloudRevisionRef.current && !hasLocalChangesRef.current) return;

              // Uma revisão recebida nunca substitui trabalho local ainda pendente.
              // A próxima sincronização fará a mesclagem automaticamente.
              if (hasLocalChangesRef.current && hasLoadedCloudRef.current) {
                setSyncStatus('pending');
                if (incomingRevision !== cloudRevisionRef.current) syncAgainRef.current = true;
                return;
              }
              cloudRevisionRef.current = incomingRevision;
              hasLoadedCloudRef.current = true;
              hasLocalChangesRef.current = false;
              storePendingSync(false);
              cloudBaseRef.current = createWorkspaceSyncBase(updatedData);
              storeCloudBase(updatedData);
              applyWorkspaceData(updatedData);
              setSyncStatus('synced');
              setLastSyncedAt(new Date());
            }
          },
          (error) => {
            console.warn('Erro na sincronização em tempo real:', error);
            setSyncStatus('error');
          }
        );
      } else {
        cloudWorkspaceRef.current = null;
        cloudRevisionRef.current = undefined;
        hasLoadedCloudRef.current = false;
        setSyncStatus('offline');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [applyWorkspaceData]);

  // Alterações ficam salvas localmente na hora e entram em uma fila de envio.
  // Agrupa alterações rápidas e envia após dois segundos sem novas mudanças.
  useEffect(() => {
    if (!hasObservedWorkspaceRef.current) {
      hasObservedWorkspaceRef.current = true;
      return;
    }

    // Skip re-upload if this state change was just triggered by an incoming cloud update
    if (isIncomingCloudSyncRef.current) {
      isIncomingCloudSyncRef.current = false;
      return;
    }

    localChangeVersionRef.current += 1;
    hasLocalChangesRef.current = true;
    storePendingSync(true);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setSyncStatus('pending');

    if (!user || !hasLoadedCloudRef.current) return;

    syncTimeoutRef.current = setTimeout(() => {
      void performCloudSyncRef.current(false);
    }, AUTO_SYNC_DELAY_MS);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [materials, products, purchases, productions, sales, customers, paymentMethods, suppliers, settings, todos, projects, finance, stockMovements]);

  useEffect(() => { saveWorkspaceSnapshot(workspaceRef.current); }, [materials, products, purchases, productions, sales, customers, paymentMethods, suppliers, settings, todos, projects, finance, stockMovements]);

  // Auth Handlers
  const handleLoginGoogle = async () => {
    try {
      setSyncStatus('syncing');
      await signInWithPopup(auth, googleProvider);
      setIsCloudSyncOpen(false);
    } catch (err: any) {
      console.error('Erro ao autenticar com o Google:', err);
      setSyncStatus('offline');
      if (err?.code === 'auth/popup-blocked') {
        alert('O navegador bloqueou a janela pop-up do Google. Por favor, permita pop-ups para este site ou abra o aplicativo em uma nova aba.');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        alert('Não foi possível conectar com o Google: ' + (err?.message || 'Erro desconhecido.'));
      }
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja desconectar sua conta Google deste aparelho? Seus dados continuarão salvos com segurança na nuvem.')) {
      try {
        await firebaseSignOut(auth);
        setUser(null);
        setSyncStatus('offline');
        setIsCloudSyncOpen(false);
        setSyncNotification({
          message: 'Você se desconectou da conta Google neste aparelho. O aplicativo agora opera no modo local.',
          type: 'info',
        });
      } catch (err: any) {
        alert('Erro ao desconectar: ' + err?.message);
      }
    }
  };

  const handleForceSync = async () => {
    if (!user) {
      handleLoginGoogle();
      return;
    }
    await performCloudSync(true);
  };

  const handleImportFromCloud = async () => {
    if (!user) return;
    if (!confirm('Importar o backup atual da nuvem? Uma cópia temporária dos dados deste aparelho será guardada antes da substituição.')) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    try {
      setSyncStatus('syncing');
      const cloud = await fetchWorkspaceFromCloud(user.uid);
      if (!cloud) throw new Error('Nenhum backup foi encontrado na nuvem.');

      protectCurrentWorkspace();
      cloudWorkspaceRef.current = cloud;
      cloudRevisionRef.current = cloud.revision || 0;
      cloudBaseRef.current = createWorkspaceSyncBase(cloud);
      storeCloudBase(cloud);
      hasLocalChangesRef.current = false;
      storePendingSync(false);
      applyWorkspaceData(cloud);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncNotification({ message: 'Backup da nuvem importado com segurança.', type: 'success' });
    } catch (error: any) {
      setSyncStatus('error');
      alert('Erro ao importar da nuvem: ' + (error?.message || 'erro desconhecido'));
    } finally {
      syncInFlightRef.current = false;
    }
  };

  const handleRestorePreviousCloudBackup = async () => {
    if (!user) return;
    if (!confirm('Restaurar o backup anterior? O backup atual será preservado como a nova versão anterior, permitindo desfazer esta restauração.')) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    try {
      setSyncStatus('syncing');
      const [previous, current] = await Promise.all([
        fetchPreviousWorkspaceFromCloud(user.uid),
        fetchWorkspaceFromCloud(user.uid),
      ]);
      if (!previous) throw new Error('Ainda não existe um backup anterior para restaurar.');

      protectCurrentWorkspace();
      const restored = await uploadWorkspaceToCloud(
        user.uid,
        previous,
        'Restauração',
        current?.revision
      );
      cloudWorkspaceRef.current = restored;
      cloudRevisionRef.current = restored.revision || 0;
      cloudBaseRef.current = createWorkspaceSyncBase(restored);
      storeCloudBase(restored);
      hasLocalChangesRef.current = false;
      storePendingSync(false);
      applyWorkspaceData(restored);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncNotification({ message: 'Backup anterior restaurado com sucesso.', type: 'success' });
    } catch (error: any) {
      setSyncStatus('error');
      alert('Erro ao restaurar o backup anterior: ' + (error?.message || 'erro desconhecido'));
    } finally {
      syncInFlightRef.current = false;
    }
  };

  // Low stock counter
  const lowStockCount = materials.filter((m) => !m.isVirtualRecipe && m.usageType !== 'durable' && !m.isPaused && m.minStock > 0 && m.currentStock <= m.minStock).length;

  // Birthday customers count for this month
  const birthdayCustomersCount = useMemo(() => {
    return customers.filter((c) => isBirthdayInMonth(c.birthdate)).length;
  }, [customers]);

  // ----------------------------------------------------
  // Material Handlers
  // ----------------------------------------------------
  const handleSaveMaterial = useCallback((mat: Material) => {
    setMaterials((prev) => {
      const idx = prev.findIndex((m) => m.id === mat.id);
      let updated: Material[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = mat;
      } else {
        updated = [mat, ...prev];
      }

      // Cascade recalculate all products that might use this material!
      setProducts((currentProducts) => {
        return cascadeRecalculateAllProducts(updated, currentProducts);
      });

      return updated;
    });
  }, []);

  const handleDeleteMaterial = useCallback((id: string) => {
    // Check if any product recipe uses this material
    const usedIn = products.filter((p) => p.items.some((it) => it.type === 'material' && it.targetId === id));
    if (usedIn.length > 0) {
      alert(`Este material é utilizado nas receitas de: ${usedIn.map((p) => p.name).join(', ')}. Remova-o das receitas antes de excluir.`);
      return;
    }

    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, [products]);

  const handleQuickStockChange = useCallback((id: string, delta: number) => { void handleFinanceAction({type:'stock_adjust',materialId:id,delta,date:new Date().toLocaleDateString('sv-SE'),id:crypto.randomUUID()}); }, [handleFinanceAction]);

  // Produz um lote de um material feito no ateliê: consome os ingredientes
  // da receita e adiciona o rendimento ao estoque do próprio material.
  const handleProduceMaterial = useCallback((materialId: string, batchCount: number) => {
    const prev=workspaceRef.current.materials;
      const target = prev.find((m) => m.id === materialId);
      if (!target?.isMadeInAtelier || !target.recipeItems?.length || !target.batchYield) {
        alert('Este material não possui uma receita válida de produção no ateliê.');
        return;
      }

      if (target.isVirtualRecipe) {
        alert('Esta é uma receita virtual: ela é preparada automaticamente durante a produção da peça e não possui estoque próprio.');
        return;
      }

      const ingredientRequirements = target.recipeItems
        .map((item) => ({
          ...item,
          required: item.quantity * batchCount,
        }))
        .filter((item) => {
          const ingredient = prev.find((m) => m.id === item.targetId);
          return ingredient?.usageType !== 'durable';
        });

      const insufficient = ingredientRequirements.find((req) => {
        const ingredient = prev.find((m) => m.id === req.targetId);
        return !ingredient || ingredient.currentStock < req.required;
      });

      if (insufficient) {
        const ingredient = prev.find((m) => m.id === insufficient.targetId);
        alert('Estoque insuficiente de "' + (ingredient?.name || insufficient.name) + '". Necessário: ' +
          insufficient.required + ' ' + insufficient.unit + '. Disponível: ' +
          (ingredient?.currentStock ?? 0) + ' ' + (ingredient?.unit || insufficient.unit) + '.');
        return;
      }

      const updated = prev.map((m) => {
        if (m.id === materialId) {
          return {
            ...m,
            currentStock: Number((m.currentStock + m.batchYield! * batchCount).toFixed(4)),
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }

        const req = ingredientRequirements.find((item) => item.targetId === m.id);
        if (req) {
          return {
            ...m,
            currentStock: Number((m.currentStock - req.required).toFixed(4)),
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }

        return m;
      });

      setMaterials(updated);
      setStockMovements(moves=>[...moves,...ingredientRequirements.map(req=>({id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE'),targetId:req.targetId,type:'material' as const,quantity:-req.required,reason:'Produção de material interno',referenceId:materialId})),{id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE'),targetId:materialId,type:'material' as const,quantity:target.batchYield*batchCount,reason:'Material interno finalizado'}]);
  }, []);

  // ----------------------------------------------------
  // Product Handlers
  // ----------------------------------------------------
  const handleSaveProduct = useCallback((prod: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === prod.id);
      let updated: Product[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = prod;
      } else {
        updated = [prod, ...prev];
      }

      if (prod.isFamilyMother && !prod.parentRecipeId && prod.productFamily?.trim()) {
        updated = updated.map((p) =>
          p.id !== prod.id && !p.isCustomRecipe && !p.isFamilyMother && !p.parentRecipeId
          && p.productFamily?.trim() === prod.productFamily.trim()
            ? { ...p, parentRecipeId: prod.id }
            : p
        );
      }

      // Cascade recalculate other products that might use this product as a sub-product (component)!
      return cascadeRecalculateAllProducts(materials, updated);
    });
  }, [materials]);

  const handleDeleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id).map((p) =>
      p.parentRecipeId === id ? { ...p, parentRecipeId: undefined } : p
    ));
  }, []);

  const handleDuplicateProduct = useCallback((prod: Product) => {
    const copy: Product = {
      ...prod,
      id: `prod_${Date.now()}`,
      parentRecipeId: prod.isCustomRecipe ? undefined : (prod.parentRecipeId || prod.id),
      isFamilyMother: false,
      name: `${prod.name} (Cópia)`,
      customName: `${prod.name} (Cópia)`,
      currentStock: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    handleSaveProduct(copy);
  }, [handleSaveProduct]);

  const handleQuickProductStockChange = useCallback((id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const currentStock = p.currentStock ?? 0;
          const newStock = Math.max(0, currentStock + delta);
          return {
            ...p,
            currentStock: newStock,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );
  }, []);

  const handleOpenProductionFromProduct = useCallback((prod: Product) => {
    setProductionInitialProduct(prod);
    setActiveTab('productions');
  }, []);

  // ----------------------------------------------------
  // Purchase Handlers
  // ----------------------------------------------------
  const handleSavePurchase = useCallback(async (purchase: Purchase, updateStock: boolean, payment?: {paidNow: boolean; dueDate: string; account: string}) => handleFinanceAction({type:'purchase',purchase,updateStock,paidNow:payment?.paidNow ?? false,dueDate:payment?.dueDate || purchase.date,account:payment?.account || 'Principal'}), [handleFinanceAction]);

  const handleDeletePurchase = useCallback((id: string) => { if(confirm('Cancelar a compra e reverter a entrada de estoque? O histórico será preservado.')) void handleFinanceAction({type:'cancel_purchase',purchaseId:id,date:new Date().toLocaleDateString('sv-SE')}); }, [handleFinanceAction]);

  // ----------------------------------------------------
  // Production Handlers (Baixa de Insumos & Entrada no Estoque)
  // ----------------------------------------------------
  const handleSaveProduction = useCallback((production: Production, updateStock: boolean) => {
    if(workspaceRef.current.productions?.some(p=>p.id===production.id))return;
    if(updateStock) setStockMovements(prev=>[...prev,...production.deductedItems.map(d=>({id:`${production.id}_${d.targetId}`,date:production.date,targetId:d.targetId,type:d.type,quantity:-d.quantityTotal,reason:'Produção',referenceId:production.id})),...(production.quantityProduced>0?[{id:`${production.id}_finished`,date:production.date,targetId:production.productId,type:'product' as const,quantity:production.quantityProduced,reason:'Produto finalizado',referenceId:production.id}]:[])]);
    setProductions((prev) => [production, ...prev]);

    if (updateStock) {
      // 1. Aumenta o estoque do produto acabado / receita produzida
      setProducts((prevProducts) => {
        return prevProducts.map((p) => {
          if (p.id === production.productId) {
            const current = p.currentStock ?? 0;
            return {
              ...p,
              currentStock: current + production.quantityProduced,
              inventoryBusinessCost: production.quantityProduced>0 ? (current*(p.inventoryBusinessCost ?? getProductFinancialSplit(p).businessCostPerUnit)+production.quantityProduced*Math.max(0,production.costPerUnit-getProductFinancialSplit(p).laborRemunerationPerUnit))/(current+production.quantityProduced) : p.inventoryBusinessCost,
              inventoryLaborCost: production.quantityProduced>0 ? (current*(p.inventoryLaborCost ?? getProductFinancialSplit(p).laborRemunerationPerUnit)+production.quantityProduced*getProductFinancialSplit(p).laborRemunerationPerUnit)/(current+production.quantityProduced) : p.inventoryLaborCost,
              updatedAt: new Date().toISOString().split('T')[0],
            };
          }
          return p;
        });
      });

      // 2. Baixa os materiais consumidos
      const materialDeductions = production.deductedItems.filter((it) => it.type === 'material');
      if (materialDeductions.length > 0) {
        setMaterials((prevMaterials) => {
          return prevMaterials.map((mat) => {
            const deduction = materialDeductions.find((it) => it.targetId === mat.id);
            if (deduction && mat.usageType !== 'durable') {
              const newStock = Math.max(0, Number((mat.currentStock - deduction.quantityTotal).toFixed(4)));
              return {
                ...mat,
                currentStock: newStock,
                updatedAt: new Date().toISOString().split('T')[0],
              };
            }
            return mat;
          });
        });
      }

      // 3. Baixa sub-produtos / componentes intermediários consumidos (se houver)
      const productDeductions = production.deductedItems.filter((it) => it.type === 'product');
      if (productDeductions.length > 0) {
        setProducts((prevProducts) => {
          return prevProducts.map((p) => {
            const deduction = productDeductions.find((it) => it.targetId === p.id);
            if (deduction && p.id !== production.productId) {
              const current = p.currentStock ?? 0;
              const newStock = Math.max(0, Number((current - deduction.quantityTotal).toFixed(4)));
              return {
                ...p,
                currentStock: newStock,
                updatedAt: new Date().toISOString().split('T')[0],
              };
            }
            return p;
          });
        });
      }
    }
  }, []);

  const handleAdvanceProductionStage = useCallback((
    production: Production,
    deductions: ProductionIngredientDeduction[],
    finishedQuantityDelta: number
  ) => {
    setProductions((prev) => prev.map((item) => (
      item.id === production.id ? production : item
    )));

    if (production.stockTrackingEnabled === false) return;
    setStockMovements(prev=>[...prev,...deductions.map(d=>({id:crypto.randomUUID(),date:production.date,targetId:d.targetId,type:d.type,quantity:-d.quantityTotal,reason:'Etapa de produção',referenceId:production.id})),...(finishedQuantityDelta>0?[{id:crypto.randomUUID(),date:production.date,targetId:production.productId,type:'product' as const,quantity:finishedQuantityDelta,reason:'Produto finalizado',referenceId:production.id}]:[])]);

    if (finishedQuantityDelta > 0) {
      setProducts((prevProducts) => prevProducts.map((product) => {
        if (product.id !== production.productId) return product;
        return {
          ...product,
          currentStock: Number(((product.currentStock ?? 0) + finishedQuantityDelta).toFixed(4)),
          inventoryBusinessCost: ((product.currentStock||0)*(product.inventoryBusinessCost ?? getProductFinancialSplit(product).businessCostPerUnit)+finishedQuantityDelta*Math.max(0,(production.targetQuantity?(production.plannedTotalCost ?? production.totalCost)/production.targetQuantity:production.costPerUnit)-getProductFinancialSplit(product).laborRemunerationPerUnit))/((product.currentStock||0)+finishedQuantityDelta),
          inventoryLaborCost: ((product.currentStock||0)*(product.inventoryLaborCost ?? getProductFinancialSplit(product).laborRemunerationPerUnit)+finishedQuantityDelta*getProductFinancialSplit(product).laborRemunerationPerUnit)/((product.currentStock||0)+finishedQuantityDelta),
          updatedAt: new Date().toISOString().split('T')[0],
        };
      }));
    }

    const materialDeductions = deductions.filter((item) => item.type === 'material');
    if (materialDeductions.length > 0) {
      setMaterials((prevMaterials) => prevMaterials.map((material) => {
        const deduction = materialDeductions.find((item) => item.targetId === material.id);
        if (!deduction || material.usageType === 'durable') return material;
        return {
          ...material,
          currentStock: Math.max(
            0,
            Number((material.currentStock - deduction.quantityTotal).toFixed(4))
          ),
          updatedAt: new Date().toISOString().split('T')[0],
        };
      }));
    }

    const productDeductions = deductions.filter((item) => item.type === 'product');
    if (productDeductions.length > 0) {
      setProducts((prevProducts) => prevProducts.map((product) => {
        const deduction = productDeductions.find((item) => item.targetId === product.id);
        if (!deduction || product.id === production.productId) return product;
        return {
          ...product,
          currentStock: Math.max(
            0,
            Number(((product.currentStock ?? 0) - deduction.quantityTotal).toFixed(4))
          ),
          updatedAt: new Date().toISOString().split('T')[0],
        };
      }));
    }
  }, []);

  const handleDeleteProduction = useCallback((id: string, revertStock: boolean) => {
    setProductions((prev) => {
      const prodToRevert = prev.find((p) => p.id === id);
      if (revertStock && prodToRevert && prodToRevert.stockTrackingEnabled !== false) {
        // Estorna o produto produzido (diminui)
        setProducts((prevProducts) => {
          return prevProducts.map((p) => {
            if (p.id === prodToRevert.productId) {
              const current = p.currentStock ?? 0;
              return {
                ...p,
                currentStock: Math.max(0, current - prodToRevert.quantityProduced),
                updatedAt: new Date().toISOString().split('T')[0],
              };
            }
            return p;
          });
        });

        // Devolve os materiais consumidos ao estoque
        const materialDeductions = prodToRevert.deductedItems.filter((it) => it.type === 'material');
        if (materialDeductions.length > 0) {
          setMaterials((prevMaterials) => {
            return prevMaterials.map((mat) => {
              const deduction = materialDeductions.find((it) => it.targetId === mat.id);
              if (deduction && mat.usageType !== 'durable') {
                const quantityActuallyDeducted = Math.max(
                  0,
                  Number((deduction.stockBefore - Math.max(0, deduction.stockAfter)).toFixed(4))
                );
                return {
                  ...mat,
                  currentStock: Number((mat.currentStock + quantityActuallyDeducted).toFixed(4)),
                  updatedAt: new Date().toISOString().split('T')[0],
                };
              }
              return mat;
            });
          });
        }

        // Devolve os sub-produtos consumidos ao estoque
        const productDeductions = prodToRevert.deductedItems.filter((it) => it.type === 'product');
        if (productDeductions.length > 0) {
          setProducts((prevProducts) => {
            return prevProducts.map((p) => {
              const deduction = productDeductions.find((it) => it.targetId === p.id);
              if (deduction && p.id !== prodToRevert.productId) {
                const current = p.currentStock ?? 0;
                const quantityActuallyDeducted = Math.max(
                  0,
                  Number((deduction.stockBefore - Math.max(0, deduction.stockAfter)).toFixed(4))
                );
                return {
                  ...p,
                  currentStock: Number((current + quantityActuallyDeducted).toFixed(4)),
                  updatedAt: new Date().toISOString().split('T')[0],
                };
              }
              return p;
            });
          });
        }
      }

      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // ----------------------------------------------------
  // Produção de Item Personalizado
  // Cria/atualiza uma receita separada, registra a produção,
  // baixa os insumos reais e coloca +1 unidade em estoque.
  // ----------------------------------------------------
  const handleProduceCustomItem = useCallback((
    saleId: string,
    item: SaleItem,
    customer?: { id?: string; name?: string }
  ): { productId: string; productionId: string; producedQuantity: number; unitCost: number } | null => {
    if (!item.isCustom || !item.id) {
      alert('Não foi possível identificar este item personalizado.');
      return null;
    }
    if (!item.customRecipeItems?.length) {
      alert('Preencha os insumos/composição do item antes de produzir.');
      return null;
    }

    type PendingDeduction = {
      id: string;
      targetId: string;
      type: 'material' | 'product';
      name: string;
      unit: string;
      quantityTotal: number;
      unitCost: number;
    };

    const aggregated = new Map<string, PendingDeduction>();

    const addDeduction = (
      id: string,
      targetId: string,
      type: 'material' | 'product',
      name: string,
      unit: string,
      quantity: number,
      unitCost: number
    ) => {
      const key = `${type}:${targetId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantityTotal += quantity;
        return;
      }
      aggregated.set(key, {
        id,
        targetId,
        type,
        name,
        unit,
        quantityTotal: quantity,
        unitCost,
      });
    };

    for (const customItem of item.customRecipeItems) {
      if (customItem.type === 'material') {
        const mat = materials.find((m) => m.id === customItem.targetId);
        if (!mat) {
          alert(`O material "${customItem.name}" não foi encontrado no cadastro.`);
          return null;
        }

        if (mat.usageType === 'durable') {
          continue;
        }

        if (mat.isVirtualRecipe && mat.recipeItems?.length) {
          const virtualYield = Math.max(0.0001, mat.batchYield || 1);
          const scale = customItem.quantity / virtualYield;

          for (const recipeItem of mat.recipeItems) {
            const required = recipeItem.quantity * scale;

            if (recipeItem.type === 'material' && recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
              const chosenId = customItem.categorySelections?.[recipeItem.id];
              const chosen = materials.find(
                (m) => m.id === chosenId && !m.isVirtualRecipe && m.category === recipeItem.targetCategory
              );
              if (!chosen) {
                alert(`Escolha qual material da categoria "${recipeItem.targetCategory}" será usado em "${mat.name}" antes de produzir.`);
                return null;
              }

              if (chosen.usageType !== 'durable') {
                addDeduction(
                  `${customItem.id}_${recipeItem.id}`,
                  chosen.id,
                  'material',
                  chosen.name,
                  chosen.unit,
                  required,
                  chosen.unitCost
                );
              }
              continue;
            }

            if (recipeItem.type === 'material') {
              const child = materials.find((m) => m.id === recipeItem.targetId);
              if (!child) {
                alert(`O ingrediente "${recipeItem.name}" da receita virtual não foi encontrado.`);
                return null;
              }
              if (child.usageType !== 'durable') {
                addDeduction(
                  `${customItem.id}_${recipeItem.id}`,
                  child.id,
                  'material',
                  child.name,
                  child.unit,
                  required,
                  child.unitCost
                );
              }
              continue;
            }

            const subProduct = products.find((p) => p.id === recipeItem.targetId);
            if (!subProduct) {
              alert(`O componente "${recipeItem.name}" da receita virtual não foi encontrado.`);
              return null;
            }
            const subCost = subProduct.unitCostFromBatch > 0 ? subProduct.unitCostFromBatch : subProduct.totalCost;
            addDeduction(
              `${customItem.id}_${recipeItem.id}`,
              subProduct.id,
              'product',
              subProduct.name,
              recipeItem.unit || 'un',
              required,
              subCost
            );
          }
          continue;
        }

        addDeduction(
          customItem.id,
          mat.id,
          'material',
          mat.name,
          mat.unit,
          customItem.quantity,
          mat.unitCost
        );
        continue;
      }

      const subProduct = products.find((p) => p.id === customItem.targetId);
      if (!subProduct) {
        alert(`O componente "${customItem.name}" não foi encontrado no cadastro.`);
        return null;
      }
      const subCost = subProduct.unitCostFromBatch > 0 ? subProduct.unitCostFromBatch : subProduct.totalCost;
      addDeduction(
        customItem.id,
        subProduct.id,
        'product',
        subProduct.name,
        customItem.unit || 'un',
        customItem.quantity,
        subCost
      );
    }

    const pending = Array.from(aggregated.values());

    for (const deduction of pending) {
      if (deduction.type === 'material') {
        const mat = materials.find((m) => m.id === deduction.targetId);
        if (!mat || mat.currentStock < deduction.quantityTotal) {
          alert(
            `Estoque insuficiente de "${deduction.name}". Necessário: ${Number(deduction.quantityTotal.toFixed(4))} ${deduction.unit}. Disponível: ${Number((mat?.currentStock || 0).toFixed(4))} ${deduction.unit}.`
          );
          return null;
        }
      } else {
        const prod = products.find((p) => p.id === deduction.targetId);
        const stock = prod?.currentStock ?? 0;
        if (!prod || stock < deduction.quantityTotal) {
          alert(
            `Estoque insuficiente do componente "${deduction.name}". Necessário: ${Number(deduction.quantityTotal.toFixed(4))}. Disponível: ${Number(stock.toFixed(4))}.`
          );
          return null;
        }
      }
    }

    const deductedItems: ProductionIngredientDeduction[] = pending.map((deduction) => {
      const stockBefore = deduction.type === 'material'
        ? (materials.find((m) => m.id === deduction.targetId)?.currentStock ?? 0)
        : (products.find((p) => p.id === deduction.targetId)?.currentStock ?? 0);
      const stockAfter = Number((stockBefore - deduction.quantityTotal).toFixed(4));
      return {
        id: deduction.id,
        targetId: deduction.targetId,
        type: deduction.type,
        name: deduction.name,
        unit: deduction.unit,
        quantityPerBatch: deduction.quantityTotal,
        quantityTotal: deduction.quantityTotal,
        unitCost: deduction.unitCost,
        totalCost: deduction.unitCost * deduction.quantityTotal,
        stockBefore,
        stockAfter,
      };
    });

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const existingCustomProduct = item.customProductId
      ? products.find((p) => p.id === item.customProductId)
      : undefined;
    const productId = existingCustomProduct?.id || `custom_prod_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const productionId = `production_custom_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const materialsCost = deductedItems.reduce((sum, d) => sum + d.totalCost, 0)
      + getVirtualRecipeLaborCost(item.customRecipeItems, materials);
    const unitCost = materialsCost;
    const customBusinessCost =
      materialsCost +
      (existingCustomProduct?.fixedCost ?? 0) +
      (existingCustomProduct?.otherCosts ?? 0);
    const customLaborRemuneration = existingCustomProduct?.laborCost ?? 0;

    const customProduct: Product = {
      id: productId,
      name: item.productName,
      category: 'Personalizadas',
      description: customer?.name ? `Receita personalizada criada para ${customer.name}.` : 'Receita personalizada criada a partir de um pedido.',
      imageUrl: item.productImageUrl,
      isIntermediate: false,
      items: item.customRecipeItems.map((ri) => ({ ...ri })),
      materialsCost,
      productionTimeMinutes: existingCustomProduct?.productionTimeMinutes ?? 0,
      hourlyRate: existingCustomProduct?.hourlyRate ?? 0,
      laborCost: existingCustomProduct?.laborCost ?? 0,
      fixedCostPercent: existingCustomProduct?.fixedCostPercent ?? 0,
      fixedCost: existingCustomProduct?.fixedCost ?? 0,
      otherCosts: existingCustomProduct?.otherCosts ?? 0,
      totalCost: unitCost,
      profitMarginPercent: existingCustomProduct?.profitMarginPercent ?? 0,
      suggestedPrice: existingCustomProduct?.suggestedPrice ?? item.unitPrice,
      actualPrice: item.unitPrice,
      calculatedMarginPercent: item.unitPrice > 0 ? ((item.unitPrice - customBusinessCost) / item.unitPrice) * 100 : 0,
      netProfit: item.unitPrice - customBusinessCost,
      batchYield: 1,
      unitCostFromBatch: unitCost,
      currentStock: (existingCustomProduct?.currentStock ?? 0) + 1,
      minStock: 0,
      standardStock: 0,
      notes: existingCustomProduct?.notes,
      isCustomRecipe: true,
      sourceSaleId: saleId,
      sourceSaleItemId: item.id,
      sourceCustomerId: customer?.id,
      sourceCustomerName: customer?.name,
      createdAt: existingCustomProduct?.createdAt || today,
      updatedAt: today,
    };

    const production: Production = {
      id: productionId,
      date: today,
      productId,
      productName: item.productName,
      productCategory: 'Personalizadas',
      productImageUrl: item.productImageUrl,
      isIntermediate: false,
      batchYield: 1,
      batchCount: 1,
      quantityProduced: 1,
      costPerUnit: unitCost,
      totalCost: unitCost,
      deductedItems,
      notes: customer?.name
        ? `Item personalizado do pedido de ${customer.name}.`
        : 'Item personalizado produzido a partir de pedido.',
      createdAt: today,
    };

    setMaterials((prev) =>
      prev.map((mat) => {
        const deduction = deductedItems.find((d) => d.type === 'material' && d.targetId === mat.id);
        if (!deduction) return mat;
        return {
          ...mat,
          currentStock: Math.max(0, Number((mat.currentStock - deduction.quantityTotal).toFixed(4))),
          updatedAt: today,
        };
      })
    );

    setProducts((prev) => {
      let next = prev.map((prod) => {
        const componentDeduction = deductedItems.find(
          (d) => d.type === 'product' && d.targetId === prod.id && prod.id !== productId
        );
        if (componentDeduction) {
          return {
            ...prod,
            currentStock: Math.max(0, Number(((prod.currentStock ?? 0) - componentDeduction.quantityTotal).toFixed(4))),
            updatedAt: today,
          };
        }
        return prod;
      });

      const idx = next.findIndex((prod) => prod.id === productId);
      if (idx >= 0) {
        next = [...next];
        next[idx] = customProduct;
        return next;
      }
      return [customProduct, ...next];
    });

    setProductions((prev) => [production, ...prev]);

    const producedQuantity = (item.customProducedQuantity ?? 0) + 1;
    setSales((prev) =>
      prev.map((sale) => {
        if (sale.id !== saleId || !sale.items) return sale;

        const updatedItems = sale.items.map((saleItem) =>
          saleItem.id === item.id
            ? {
                ...saleItem,
                customProductId: productId,
                customProductionId: productionId,
                customProducedAt: today,
                customProducedQuantity: producedQuantity,
                reservedQuantity: Math.min(
                  saleItem.quantity,
                  (saleItem.reservedQuantity || 0) + 1
                ),
                unitCost,
                unitBusinessCost: customBusinessCost,
                unitLaborRemuneration: customLaborRemuneration,
                totalCost: unitCost * saleItem.quantity,
              }
            : saleItem
        );
        const saleRevenue = updatedItems.reduce(
          (sum, saleItem) => sum + (saleItem.subtotal ?? saleItem.quantity * saleItem.unitPrice),
          0
        );
        const saleCost = updatedItems.reduce((sum, saleItem) => sum + saleItem.totalCost, 0);
        const saleBusinessCost = updatedItems.reduce(
          (sum, saleItem) => sum + (saleItem.unitBusinessCost ?? saleItem.unitCost) * saleItem.quantity,
          0
        );
        const saleLaborRemuneration = updatedItems.reduce(
          (sum, saleItem) => sum + (saleItem.unitLaborRemuneration ?? 0) * saleItem.quantity,
          0
        );
        const saleProfit = saleRevenue - saleBusinessCost;
        const commercialProfit = saleProfit - saleLaborRemuneration;

        return {
          ...sale,
          items: updatedItems,
          totalCost: saleCost,
          totalBusinessCost: saleBusinessCost,
          totalLaborRemuneration: saleLaborRemuneration,
          commercialProfit,
          totalProfit: saleProfit,
          marginPercent: saleRevenue > 0 ? (saleProfit / saleRevenue) * 100 : 0,
        };
      })
    );

    return { productId, productionId, producedQuantity, unitCost };
  }, [materials, products]);

  // ----------------------------------------------------
  // Reservas de estoque para pedidos
  // A reserva não altera o estoque físico: apenas separa a peça para um pedido.
  // ----------------------------------------------------
  const handleReserveSaleItem = useCallback((saleId: string, itemId: string): number | null => {
    const sale = sales.find((s) => s.id === saleId);
    const item = sale?.items?.find((saleItem) => saleItem.id === itemId);
    if (!sale || !item) return null;

    if (sale.deliveryStatus === 'entregue') {
      alert('Este pedido já foi entregue.');
      return null;
    }

    const stockProductId = item.isCustom ? item.customProductId : item.productId;
    if (!stockProductId) {
      alert('Este item ainda não possui uma peça produzida em estoque para reservar.');
      return null;
    }

    const stockProduct = products.find((p) => p.id === stockProductId);
    if (!stockProduct) {
      alert('Não foi possível localizar este produto no estoque.');
      return null;
    }

    const reservedAcrossOrders = sales.reduce((total, currentSale) => {
      if (currentSale.deliveryStatus === 'entregue' || !currentSale.items) return total;
      return total + currentSale.items.reduce((sum, currentItem) => {
        const currentStockProductId = currentItem.isCustom ? currentItem.customProductId : currentItem.productId;
        if (currentStockProductId !== stockProductId) return sum;
        return sum + (currentItem.reservedQuantity || 0);
      }, 0);
    }, 0);

    const physicalStock = stockProduct.currentStock ?? 0;
    const available = Math.max(0, physicalStock - reservedAcrossOrders);
    const alreadyReserved = item.reservedQuantity || 0;
    const missing = Math.max(0, item.quantity - alreadyReserved);
    const amountToReserve = Math.min(missing, available);

    if (amountToReserve <= 0) {
      if (missing <= 0) {
        alert('Este item já está totalmente reservado para o pedido.');
      } else {
        alert('Não há unidades disponíveis para reservar no momento.');
      }
      return alreadyReserved;
    }

    const newReserved = alreadyReserved + amountToReserve;
    setSales((prev) =>
      prev.map((currentSale) => {
        if (currentSale.id !== saleId || !currentSale.items) return currentSale;
        return {
          ...currentSale,
          items: currentSale.items.map((currentItem) =>
            currentItem.id === itemId
              ? { ...currentItem, reservedQuantity: newReserved }
              : currentItem
          ),
        };
      })
    );

    return newReserved;
  }, [sales, products]);

  const handleReleaseSaleItemReservation = useCallback((saleId: string, itemId: string): number | null => {
    const sale = sales.find((s) => s.id === saleId);
    const item = sale?.items?.find((saleItem) => saleItem.id === itemId);
    if (!sale || !item) return null;

    if (sale.deliveryStatus === 'entregue') {
      alert('Não é possível liberar uma reserva de um pedido já entregue.');
      return null;
    }

    setSales((prev) =>
      prev.map((currentSale) => {
        if (currentSale.id !== saleId || !currentSale.items) return currentSale;
        return {
          ...currentSale,
          items: currentSale.items.map((currentItem) =>
            currentItem.id === itemId
              ? { ...currentItem, reservedQuantity: 0 }
              : currentItem
          ),
        };
      })
    );

    return 0;
  }, [sales]);

  // ----------------------------------------------------
  // Sale Handlers
  // ----------------------------------------------------
  const orderNumberCounter = useRef(0);
  orderNumberCounter.current = Math.max(orderNumberCounter.current, settings.lastOrderNumber || 0, getHighestOrderNumber(sales));
  useEffect(() => {
    const highest = getHighestOrderNumber(sales);
    if (highest > (settings.lastOrderNumber || 0)) {
      setSettings(prev => ({ ...prev, lastOrderNumber: Math.max(prev.lastOrderNumber || 0, highest) }));
    }
  }, [sales, settings.lastOrderNumber]);

  const handleSaveSale = useCallback(async (sale: Sale): Promise<boolean> => {
    const existing = workspaceRef.current.sales.find(s => s.id === sale.id);
    const initialPaymentCents = !existing ? Math.round((sale.amountPaid || 0) * 100) : undefined;
    const success = await handleFinanceAction({ type: 'save_order', sale, initialPaymentCents, initialMethod: sale.paymentMethod });
    if (success) { setWorkflowFocus('overview'); setWorkflowSaleId(sale.id); }
    return success;
  }, [handleFinanceAction]);

  const openOrderDetail = useCallback((id: string, focus: OrderFocus = 'overview') => {
    orderReturnScroll.current = window.scrollY;
    setWorkflowFocus(focus);
    setWorkflowSaleId(id);
    setIsQuickMoreOpen(false);
    window.scrollTo(0, 0);
  }, []);
  const closeOrderDetail = useCallback(() => {
    setWorkflowSaleId(null);
    requestAnimationFrame(() => window.scrollTo(0, orderReturnScroll.current));
  }, []);
  const handleDeleteSale = useCallback((id: string) => { openOrderDetail(id); }, [openOrderDetail]);

  // ----------------------------------------------------
  // Project Handlers
  // ----------------------------------------------------
  const handleSaveProject = useCallback((project: ProductionProject) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = project;
        return updated;
      }
      return [project, ...prev];
    });
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== id));
  }, []);

  // ----------------------------------------------------
  // Supplier Handlers
  // ----------------------------------------------------
  const handleSaveSupplier = useCallback((sup: Supplier) => {
    setSuppliers((prev) => {
      const idx = prev.findIndex((s) => s.id === sup.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = sup;
        return updated;
      }
      return [sup, ...prev];
    });
  }, []);

  const handleDeleteSupplier = useCallback((id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleSelectSupplierMaterials = useCallback((supplierName: string) => {
    setActiveTab('materials');
    // We can also let the materials view filter
  }, []);

  // ----------------------------------------------------
  // Customer Handlers & Payment Methods
  // ----------------------------------------------------
  const handleSaveCustomer = useCallback((cust: Customer) => {
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === cust.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = cust;
        return updated;
      }
      return [cust, ...prev];
    });
  }, []);

  const handleDeleteCustomer = useCallback((id: string) => {
    if (workspaceRef.current.sales.some(s => s.customerId === id) || workspaceRef.current.finance?.entries.some(e => e.customerId === id)) { alert("Este cliente tem histórico de pedidos ou financeiro. Preserve o cadastro."); return; }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleAddPaymentMethod = useCallback((method: string) => {
    const trimmed = method.trim();
    if (!trimmed) return;
    setPaymentMethods((prev) => {
      if (prev.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const handleCreateSaleForCustomer = useCallback((customer: Customer) => {
    setCustomerForNewSale(customer);
    setSalesInitialFilter('all');
    setActiveTab('sales');
  }, []);

  // ----------------------------------------------------
  // Restore Data / Backup / Presets
  // ----------------------------------------------------
  const handleRestoreAllData = useCallback((data: any) => {
    protectCurrentWorkspace();
    setFinance(data.finance || emptyFinance()); setStockMovements(data.stockMovements || []);
    saveWorkspaceSnapshot({ ...workspaceRef.current, ...data, finance: data.finance || emptyFinance(), stockMovements: data.stockMovements || [] });
    if (data.materials) setMaterials(data.materials);
    if (data.products) setProducts(data.products);
    if (data.purchases) setPurchases(data.purchases);
    if (data.productions) setProductions(data.productions);
    if (data.sales) setSales(ensureOrderNumbers(data.sales, data.settings?.lastOrderNumber || 0));
    if (data.customers) setCustomers(data.customers);
    if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.settings) setSettings(withDefaultDiscountCodes(data.settings));
    if (data.todos) setTodos(data.todos);
    if (data.projects) setProjects(data.projects);
  }, []);

  const handleSelectPreset = useCallback((preset: AtelierPreset) => {
    setMaterials(preset.materials);
    setProducts(preset.products);
    setPurchases(preset.purchases);
    setSales(ensureOrderNumbers(preset.sales));
    setSuppliers(preset.suppliers);
    setSettings(withDefaultDiscountCodes(preset.settings));
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f0e9] text-stone-900 flex flex-col font-sans antialiased selection:bg-[#ead0c3] selection:text-stone-900">
      {/* Sync Status Banner Notification if active */}
      {syncNotification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{syncNotification.message}</span>
            </div>
            <button
              onClick={() => setSyncNotification(null)}
              className="p-1 hover:bg-emerald-700 rounded-md transition-colors text-emerald-100 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Minimal app header: atelier name is the Home shortcut */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#eadfd6] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setWorkflowSaleId(null);
              setActiveTab('home');
              setFilterLowStockInitial(false);
              setIsQuickMoreOpen(false);
            }}
            className="min-w-0 text-left cursor-pointer group"
            title="Voltar ao Início"
            aria-label="Voltar ao Início"
          >
            <span className="block text-sm sm:text-base font-bold text-[#352f2b] group-hover:text-[#a86149] transition-colors truncate max-w-[65vw] sm:max-w-none">
              {settings.atelierName || 'Liare'}
            </span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setActiveTab('finance')} className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold">Financeiro</button>
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('materials');
                  setFilterLowStockInitial(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#e8c7b7] bg-[#fbf1eb] text-[#9a5b43] text-xs font-bold cursor-pointer"
                title="Ver itens com estoque baixo"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lowStockCount}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-[#6f655f] hover:text-[#352f2b] hover:bg-[#f4ece6] transition-colors cursor-pointer"
              title="Configurações do Ateliê"
              aria-label="Configurações do Ateliê"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {localStorageLimited && <div role="alert" className="mx-auto mt-3 w-full max-w-7xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        {syncStatus === 'synced'
          ? 'Dados sincronizados na nuvem. O navegador está sem espaço para guardar uma cópia neste aparelho.'
          : 'Não foi possível salvar uma cópia neste aparelho. Mantenha esta página aberta até sincronizar com a nuvem ou baixe um backup nas Configurações antes de fechar.'}
      </div>}

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28">
        {workflowSaleId && sales.find(sale => sale.id === workflowSaleId) && <OrderDetailView
          key={workflowSaleId} sale={sales.find(sale => sale.id === workflowSaleId)!}
          finance={finance} products={products} customers={customers} settings={settings}
          onAction={handleFinanceAction} onSave={handleSaveSale} onBack={closeOrderDetail}
          focus={workflowFocus} onProduce={product => {
            setWorkflowSaleId(null);
            if (product) { setHomeNewProductionSignal(0); handleOpenProductionFromProduct(product); }
            else { setProductionInitialProduct(null); setHomeNewProductionSignal(value => value + 1); setActiveTab('productions'); }
          }}
        />}
        <div hidden={!!workflowSaleId}>
        {activeTab === 'home' && (
          <HomeView
            artisanName={settings.artisanName}
            atelierName={settings.atelierName}
            materials={materials}
            products={products}
            purchases={purchases}
            sales={displaySales}
            todos={todos}
            onUpdateTodos={setTodos}
            onNavigate={(tab, filter) => {
              setActiveTab(tab);
              setFilterLowStockInitial(tab === 'materials' && filter === 'low_stock');
              if (tab === 'sales' && (filter === 'pending_delivery' || filter === 'pending_payment' || filter === 'all')) {
                setSalesInitialFilter(filter);
              } else if (tab === 'sales') {
                setSalesInitialFilter('all');
              }
            }}
            onOpenNewProduct={() => {
              setActiveTab('products');
            }}
            onOpenNewMaterial={() => {
              setActiveTab('materials');
            }}
            onOpenNewSale={() => {
              setCustomerForNewSale(null);
              setSalesInitialFilter('all');
              setQuickNewSaleSignal(value => value + 1);
              setActiveTab('sales');
            }}
            onOpenNewPurchase={() => {
              setHomeNewPurchaseSignal(value => value + 1);
              setActiveTab('purchases');
            }}
            onOpenProduction={(product) => {
              if (product) {
                setHomeNewProductionSignal(0);
                handleOpenProductionFromProduct(product);
              } else {
                setProductionInitialProduct(null);
                setHomeNewProductionSignal(value => value + 1);
                setActiveTab('productions');
              }
            }}
            onOpenSale={(saleId, focus) => openOrderDetail(saleId, focus)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialsView
            stockMovements={stockMovements}
            materials={materials}
            defaultHourlyRate={settings.defaultHourlyRate}
            suppliers={suppliers}
            onSaveMaterial={handleSaveMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onQuickStockChange={handleQuickStockChange}
            onProduceMaterial={handleProduceMaterial}
            onOpenPurchaseHistory={() => setActiveTab('purchases')}
            filterLowStockInitial={filterLowStockInitial}
            openNewMaterialSignal={quickNewMaterialSignal}
          />
        )}

        {activeTab === 'products' && (
          <ProductsView
            products={products}
            materials={materials}
            defaultHourlyRate={settings.defaultHourlyRate}
            defaultFixedCostPercent={settings.defaultFixedCostPercent}
            defaultProfitMargin={settings.defaultProfitMargin}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onDuplicateProduct={handleDuplicateProduct}
            onQuickStockChange={handleQuickProductStockChange}
            onOpenProduction={handleOpenProductionFromProduct}
            onOpenProductionHistory={() => setActiveTab('productions')}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            products={products}
            materials={materials}
            onSaveProject={handleSaveProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'purchases' && (
          <PurchasesView
            purchases={purchases}
            materials={materials}
            suppliers={suppliers}
            onSavePurchase={handleSavePurchase}
            onDeletePurchase={handleDeletePurchase}
            onOpenSuppliers={() => setActiveTab('suppliers')}
            openNewPurchaseSignal={homeNewPurchaseSignal}
          />
        )}

        {activeTab === 'productions' && (
          <ProductionsView
            productions={productions}
            products={products}
            materials={materials}
            onSaveProduction={handleSaveProduction}
            onAdvanceProductionStage={handleAdvanceProductionStage}
            onDeleteProduction={handleDeleteProduction}
            onNavigateToProducts={() => setActiveTab('products')}
            initialSelectedProduct={productionInitialProduct}
            openNewProductionSignal={homeNewProductionSignal}
            onClearInitialProduct={() => setProductionInitialProduct(null)}
          />
        )}

        {activeTab === 'sales' && (
          <SalesView
            settings={settings}
            sales={displaySales}
            products={products}
            materials={materials}
            customers={customers}
            paymentMethods={paymentMethods}
            discountCodes={settings.discountCodes || []}
            onSaveSale={handleSaveSale}
            onOpenWorkflow={openOrderDetail}
            onReserveSaleItem={handleReserveSaleItem}
            onReleaseSaleItemReservation={handleReleaseSaleItemReservation}
            onProduceCustomItem={handleProduceCustomItem}
            onDeleteSale={handleDeleteSale}
            onSaveCustomer={handleSaveCustomer}
            onAddPaymentMethod={handleAddPaymentMethod}
            initialSaleId={homeSaleId}
            onClearInitialSale={() => setHomeSaleId(null)}
            initialFilter={salesInitialFilter}
            initialCustomerForNewOrder={customerForNewSale}
            onClearInitialCustomer={() => setCustomerForNewSale(null)}
            openNewSaleSignal={quickNewSaleSignal}
            onOpenCustomers={() => setActiveTab('customers')}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            sales={displaySales}
            products={products}
            discountCodes={settings.discountCodes || []}
            onSaveCustomer={handleSaveCustomer}
            finance={finance}
            onOpenFinance={() => setActiveTab('finance')}
            onDeleteCustomer={handleDeleteCustomer}
            onNavigateToNewOrderWithCustomer={handleCreateSaleForCustomer}
          />
        )}

        {activeTab === 'finance' && <FinanceView onSaveCustomer={handleSaveCustomer} sales={sales} customers={customers} finance={finance} creditOrigins={settings.creditOrigins} onSaveCreditOrigins={origins => setSettings(previous => ({ ...previous, creditOrigins: origins }))} onAction={handleFinanceAction} onOpenOrder={id => openOrderDetail(id, 'payment')} />}

        {activeTab === 'reports' && (
          <ReportsView
            sales={displaySales}
            purchases={purchases}
            products={products}
            materials={materials}
            finance={finance}
            onOpenFinance={() => setActiveTab('finance')}
            onOpenPurchaseHistory={() => setActiveTab('purchases')}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            materials={materials}
            purchases={purchases}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSelectSupplierMaterials={handleSelectSupplierMaterials}
          />
        )}
        </div>
      </main>

      {/* Central quick action menu */}
      {isQuickMoreOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsQuickMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-[1px]" />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-[#eadfd6] bg-white shadow-2xl p-3"
            style={{ bottom: 'calc(6.6rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCustomerForNewSale(null);
                  setSalesInitialFilter('all');
                  setActiveTab('sales');
                  setQuickNewSaleSignal((value) => value + 1);
                  setIsQuickMoreOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7f2] border border-[#eadfd6] px-3 py-3 text-left text-xs font-semibold text-[#4f4640] active:scale-[0.98]"
              >
                <span className="w-9 h-9 rounded-full bg-[#f5e8df] text-[#a86149] flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </span>
                Novo pedido
              </button>

              <button
                type="button"
                onClick={() => {
                  setProductionInitialProduct(null);
                  setActiveTab('productions');
                  setIsQuickMoreOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7f2] border border-[#eadfd6] px-3 py-3 text-left text-xs font-semibold text-[#4f4640] active:scale-[0.98]"
              >
                <span className="w-9 h-9 rounded-full bg-[#eef1e6] text-[#66704f] flex items-center justify-center shrink-0">
                  <Hammer className="w-4 h-4" />
                </span>
                Produções
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterLowStockInitial(false);
                  setActiveTab('materials');
                  setQuickNewMaterialSignal((value) => value + 1);
                  setIsQuickMoreOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7f2] border border-[#eadfd6] px-3 py-3 text-left text-xs font-semibold text-[#4f4640] active:scale-[0.98]"
              >
                <span className="w-9 h-9 rounded-full bg-[#f5eee8] text-[#9a654d] flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </span>
                Novo material
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('projects');
                  setIsQuickMoreOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7f2] border border-[#eadfd6] px-3 py-3 text-left text-xs font-semibold text-[#4f4640] active:scale-[0.98]"
              >
                <span className="w-9 h-9 rounded-full bg-[#f0ece8] text-[#6f655f] flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </span>
                Projetos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Above quick actions (40), below modal overlays (50). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[45] border-t border-[#eadfd6] bg-white/96 backdrop-blur-xl shadow-[0_-4px_18px_rgba(83,62,49,0.05)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.35rem)' }}
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid min-h-[72px] max-w-2xl grid-cols-5 items-start px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('products');
              setIsQuickMoreOpen(false);
            }}
            className={`flex min-h-14 flex-col items-center justify-start pt-1 gap-0.5 text-[10px] sm:text-xs font-semibold transition-colors ${activeTab === 'products' ? 'text-[#b96f55]' : 'text-[#8a817a]'}`}
          >
            <Tag className="w-5 h-5" />
            <span>Receitas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSalesInitialFilter('all');
              setActiveTab('sales');
              setIsQuickMoreOpen(false);
            }}
            className={`flex min-h-14 flex-col items-center justify-start pt-1 gap-0.5 text-[10px] sm:text-xs font-semibold transition-colors ${activeTab === 'sales' || activeTab === 'customers' ? 'text-[#b96f55]' : 'text-[#8a817a]'}`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Pedidos</span>
          </button>

          <div className="flex items-end justify-center">
            <button
              type="button"
              aria-label={isQuickMoreOpen ? 'Fechar atalhos rápidos' : 'Abrir atalhos rápidos'}
              onClick={() => setIsQuickMoreOpen((open) => !open)}
              className={`-mt-4 flex h-15 w-15 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#b96f55] text-white shadow-[0_4px_12px_rgba(83,62,49,0.14)] border-[3px] border-white transition-transform active:scale-95 ${isQuickMoreOpen ? 'rotate-45' : ''}`}
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('materials');
              setFilterLowStockInitial(false);
              setIsQuickMoreOpen(false);
            }}
            className={`flex min-h-14 flex-col items-center justify-start pt-1 gap-0.5 text-[10px] sm:text-xs font-semibold transition-colors ${activeTab === 'materials' || activeTab === 'purchases' || activeTab === 'suppliers' ? 'text-[#b96f55]' : 'text-[#8a817a]'}`}
          >
            <Package className="w-5 h-5" />
            <span>Materiais</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('reports');
              setIsQuickMoreOpen(false);
            }}
            className={`flex min-h-14 flex-col items-center justify-start pt-1 gap-0.5 text-[10px] sm:text-xs font-semibold transition-colors ${activeTab === 'reports' ? 'text-[#b96f55]' : 'text-[#8a817a]'}`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Relatórios</span>
          </button>
        </div>
      </nav>

      {financeBusy && <div role="status" className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/30"><p className="rounded-xl bg-white p-5 font-semibold">Registrando com segurança…</p></div>}
      {/* Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        user={user}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={setSettings}
        onRestoreAllData={handleRestoreAllData}
        onOpenExamplePresets={() => setIsExampleSelectorOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        allCurrentData={{
          materials,
          products,
          purchases,
          productions,
          sales,
          customers,
          paymentMethods,
          suppliers,
          settings,
          todos,
          projects, finance, stockMovements,
        }}
      />

      {/* Cloud Sync & Google Login Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        user={user}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onLoginGoogle={handleLoginGoogle}
        onLogout={handleLogout}
        onForceSync={handleForceSync}
        onImportFromCloud={handleImportFromCloud}
        onRestorePreviousBackup={handleRestorePreviousCloudBackup}
        itemCounts={{
          materials: materials.length,
          products: products.length,
          purchases: purchases.length,
          productions: productions.length,
          projects: projects.length,
          sales: sales.length,
          customers: customers.length,
        }}
      />

      {/* Example Presets Selector Modal */}
      <ExampleSelectorModal
        isOpen={isExampleSelectorOpen}
        onClose={() => setIsExampleSelectorOpen(false)}
        onSelectPreset={handleSelectPreset}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-5 text-center text-xs text-stone-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {settings.atelierName} • Gestor de Custos & Precificação Artesanal
          </span>
          <span className="text-stone-400">
            Fichas Técnicas • Sub-produtos • Margem de Lucro • Histórico de Compras & Relatórios
          </span>
        </div>
      </footer>
    </div>
  );
}
