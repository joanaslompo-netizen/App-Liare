import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  loadStoredData, 
  saveMaterials, 
  saveProducts, 
  savePurchases, 
  saveProductions,
  saveSales, 
  saveCustomers,
  savePaymentMethods,
  saveSuppliers, 
  saveSettings,
  saveTodos,
  cascadeRecalculateAllProducts,
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
  NavTab
} from './types';
import { isBirthdayInMonth } from './utils/formatters';
import { AtelierPreset } from './utils/presets';
import { SidebarDrawer } from './components/SidebarDrawer';
import { HomeView } from './components/HomeView';
import { MaterialsView } from './components/MaterialsView';
import { ProductsView } from './components/ProductsView';
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
  CloudSyncStatus,
  CloudSyncConflictError
} from './services/cloudSync';
import { CheckCircle2, X } from 'lucide-react';

const withDefaultDiscountCodes = (incoming: AtelierSettings): AtelierSettings => ({
  ...incoming,
  discountCodes:
    Array.isArray(incoming?.discountCodes)
      ? incoming.discountCodes
      : (DEFAULT_SETTINGS.discountCodes || []),
});

export default function App() {
  // Load initial data from localStorage (or sample seeds)
  const [initialData] = useState(() => loadStoredData());

  const [materials, setMaterials] = useState<Material[]>(initialData.materials);
  const [products, setProducts] = useState<Product[]>(initialData.products);
  const [purchases, setPurchases] = useState<Purchase[]>(initialData.purchases);
  const [productions, setProductions] = useState<Production[]>(initialData.productions || []);
  const [productionInitialProduct, setProductionInitialProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<Sale[]>(initialData.sales);
  const [customers, setCustomers] = useState<Customer[]>(initialData.customers || []);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialData.paymentMethods || ['offline', 'site']);
  const [customerForNewSale, setCustomerForNewSale] = useState<Customer | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialData.suppliers);
  const [settings, setSettings] = useState<AtelierSettings>(() =>
    withDefaultDiscountCodes(initialData.settings)
  );
  const [todos, setTodos] = useState<TodoItem[]>(initialData.todos || DEFAULT_TODOS);

  // Lateral Sidebar Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Cloud Sync & Auth State
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  const isIncomingCloudSyncRef = useRef(false);
  const syncTimeoutRef = useRef<any>(null);
  const cloudRevisionRef = useRef<number | undefined>(undefined);
  const hasLoadedCloudRef = useRef(false);
  const hasLocalChangesRef = useRef(false);

  // Active navigation tab - default to 'home' (initial dashboard screen)
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [filterLowStockInitial, setFilterLowStockInitial] = useState(false);
  const [salesInitialFilter, setSalesInitialFilter] = useState<'all' | 'pending_delivery' | 'pending_payment'>('all');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExampleSelectorOpen, setIsExampleSelectorOpen] = useState(false);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (!syncNotification) return;
    const timer = setTimeout(() => {
      setSyncNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [syncNotification]);

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
            // Existing cloud backup is authoritative on login. Never overwrite it blindly.
            cloudRevisionRef.current = cloudData.revision || 0;
            hasLoadedCloudRef.current = true;
            hasLocalChangesRef.current = false;
            // Cloud data already exists, update local state
            isIncomingCloudSyncRef.current = true;
            if (cloudData.materials) setMaterials(cloudData.materials);
            if (cloudData.products) setProducts(cloudData.products);
            if (cloudData.purchases) setPurchases(cloudData.purchases);
            if (cloudData.productions) setProductions(cloudData.productions);
            if (cloudData.sales) setSales(cloudData.sales);
            if (cloudData.customers) setCustomers(cloudData.customers);
            if (cloudData.paymentMethods) setPaymentMethods(cloudData.paymentMethods);
            if (cloudData.suppliers) setSuppliers(cloudData.suppliers);
            if (cloudData.settings) setSettings(withDefaultDiscountCodes(cloudData.settings));
            if (cloudData.todos) setTodos(cloudData.todos);

            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            setSyncNotification({
              message: `Conectado como ${currentUser.email}! Dados sincronizados com seu Notebook, Celular e Tablet.`,
              type: 'success',
            });
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
            });
            cloudRevisionRef.current = createdCloud.revision || 1;
            hasLoadedCloudRef.current = true;
            hasLocalChangesRef.current = false;
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
              const incomingRevision = updatedData.revision || 0;
              // If this device has unsent edits and cloud advanced elsewhere, do not destroy either side.
              if (hasLocalChangesRef.current && hasLoadedCloudRef.current && incomingRevision !== cloudRevisionRef.current) {
                setSyncStatus('error');
                setSyncNotification({
                  message: 'Conflito detectado: a nuvem mudou enquanto este aparelho tinha alterações locais. Nada foi sobrescrito. Clique em Sincronizar para carregar a versão mais recente da nuvem.',
                  type: 'error',
                });
                return;
              }
              cloudRevisionRef.current = incomingRevision;
              hasLoadedCloudRef.current = true;
              hasLocalChangesRef.current = false;
              isIncomingCloudSyncRef.current = true;
              if (updatedData.materials) setMaterials(updatedData.materials);
              if (updatedData.products) setProducts(updatedData.products);
              if (updatedData.purchases) setPurchases(updatedData.purchases);
              if (updatedData.productions) setProductions(updatedData.productions);
              if (updatedData.sales) setSales(updatedData.sales);
              if (updatedData.customers) setCustomers(updatedData.customers);
              if (updatedData.paymentMethods) setPaymentMethods(updatedData.paymentMethods);
              if (updatedData.suppliers) setSuppliers(updatedData.suppliers);
              if (updatedData.settings) setSettings(withDefaultDiscountCodes(updatedData.settings));
              if (updatedData.todos) setTodos(updatedData.todos);
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
        setSyncStatus('offline');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Debounced auto-upload to cloud when user is logged in
  useEffect(() => {
    if (!user || !hasLoadedCloudRef.current) return;
    
    // Skip re-upload if this state change was just triggered by an incoming cloud update
    if (isIncomingCloudSyncRef.current) {
      isIncomingCloudSyncRef.current = false;
      return;
    }

    hasLocalChangesRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setSyncStatus('syncing');

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const uploaded = await uploadWorkspaceToCloud(user.uid, {
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
        }, 'Web', cloudRevisionRef.current);
        cloudRevisionRef.current = uploaded.revision;
        hasLocalChangesRef.current = false;
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (err) {
        console.warn('Erro ao enviar dados para a nuvem:', err);
        setSyncStatus('error');
        if (err instanceof CloudSyncConflictError) {
          setSyncNotification({ message: 'Sincronização bloqueada: existe uma versão mais nova na nuvem. Seus dados locais não sobrescreveram o backup.', type: 'error' });
        }
      }
    }, 800);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [materials, products, purchases, productions, sales, customers, paymentMethods, suppliers, settings, todos, user]);

  // Auto-persist changes to local storage cache as well (offline fallback)
  useEffect(() => {
    saveMaterials(materials);
  }, [materials]);

  useEffect(() => {
    saveProducts(products);
  }, [products]);

  useEffect(() => {
    savePurchases(purchases);
  }, [purchases]);

  useEffect(() => {
    saveProductions(productions);
  }, [productions]);

  useEffect(() => {
    saveSales(sales);
  }, [sales]);

  useEffect(() => {
    saveCustomers(customers);
  }, [customers]);

  useEffect(() => {
    savePaymentMethods(paymentMethods);
  }, [paymentMethods]);

  useEffect(() => {
    saveSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

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
    try {
      setSyncStatus('syncing');
      // Manual sync always reads cloud first. If cloud advanced, download it instead of overwriting it.
      const cloud = await fetchWorkspaceFromCloud(user.uid);
      const cloudRevision = cloud?.revision || 0;

      if (cloud && cloudRevision !== (cloudRevisionRef.current ?? cloudRevision)) {
        isIncomingCloudSyncRef.current = true;
        cloudRevisionRef.current = cloudRevision;
        hasLoadedCloudRef.current = true;
        hasLocalChangesRef.current = false;
        setMaterials(cloud.materials || []);
        setProducts(cloud.products || []);
        setProductions(cloud.productions || []);
        setPurchases(cloud.purchases || []);
        setSales(cloud.sales || []);
        setCustomers(cloud.customers || []);
        setPaymentMethods(cloud.paymentMethods || []);
        setSuppliers(cloud.suppliers || []);
        if (cloud.settings) setSettings(withDefaultDiscountCodes(cloud.settings));
        setTodos(cloud.todos || []);
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        setSyncNotification({ message: 'A nuvem tinha uma versão mais recente. Ela foi baixada para este dispositivo sem sobrescrever o backup.', type: 'info' });
        return;
      }

      if (!hasLocalChangesRef.current && cloud) {
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        setSyncNotification({ message: 'Este dispositivo já está com a versão mais recente da nuvem.', type: 'success' });
        return;
      }

      const uploaded = await uploadWorkspaceToCloud(user.uid, {
        materials, products, productions, purchases, sales, customers,
        paymentMethods, suppliers, settings, todos,
      }, 'Web', cloud ? cloudRevision : undefined);
      cloudRevisionRef.current = uploaded.revision;
      hasLoadedCloudRef.current = true;
      hasLocalChangesRef.current = false;
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncNotification({ message: 'Dados mais recentes enviados com segurança. A versão anterior foi preservada como backup.', type: 'success' });
    } catch (err: any) {
      setSyncStatus('error');
      if (err instanceof CloudSyncConflictError) {
        setSyncNotification({ message: 'Conflito detectado. Nada foi sobrescrito. Clique novamente em Sincronizar para carregar a versão mais recente da nuvem.', type: 'error' });
      } else {
        alert('Erro ao sincronizar: ' + err?.message);
      }
    }
  };

  // Low stock counter
  const lowStockCount = materials.filter((m) => !m.isVirtualRecipe && m.minStock > 0 && m.currentStock <= m.minStock).length;

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

  const handleQuickStockChange = useCallback((id: string, delta: number) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const newStock = Math.max(0, m.currentStock + delta);
          return {
            ...m,
            currentStock: newStock,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return m;
      })
    );
  }, []);

  // Produz um lote de um material feito no ateliê: consome os ingredientes
  // da receita e adiciona o rendimento ao estoque do próprio material.
  const handleProduceMaterial = useCallback((materialId: string, batchCount: number) => {
    setMaterials((prev) => {
      const target = prev.find((m) => m.id === materialId);
      if (!target?.isMadeInAtelier || !target.recipeItems?.length || !target.batchYield) {
        alert('Este material não possui uma receita válida de produção no ateliê.');
        return prev;
      }

      if (target.isVirtualRecipe) {
        alert('Esta é uma receita virtual: ela é preparada automaticamente durante a produção da peça e não possui estoque próprio.');
        return prev;
      }

      const ingredientRequirements = target.recipeItems.map((item) => ({
        ...item,
        required: item.quantity * batchCount,
      }));

      const insufficient = ingredientRequirements.find((req) => {
        const ingredient = prev.find((m) => m.id === req.targetId);
        return !ingredient || ingredient.currentStock < req.required;
      });

      if (insufficient) {
        const ingredient = prev.find((m) => m.id === insufficient.targetId);
        alert('Estoque insuficiente de "' + (ingredient?.name || insufficient.name) + '". Necessário: ' +
          insufficient.required + ' ' + insufficient.unit + '. Disponível: ' +
          (ingredient?.currentStock ?? 0) + ' ' + (ingredient?.unit || insufficient.unit) + '.');
        return prev;
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

      return updated;
    });
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

      // Cascade recalculate other products that might use this product as a sub-product (component)!
      return cascadeRecalculateAllProducts(materials, updated);
    });
  }, [materials]);

  const handleDeleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDuplicateProduct = useCallback((prod: Product) => {
    const copy: Product = {
      ...prod,
      id: `prod_${Date.now()}`,
      name: `${prod.name} (Cópia)`,
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
  const handleSavePurchase = useCallback((purchase: Purchase, updateStock: boolean) => {
    setPurchases((prev) => [purchase, ...prev]);

    if (updateStock) {
      setMaterials((prevMaterials) => {
        return prevMaterials.map((mat) => {
          const purchasedItems = purchase.items.filter((it) => it.materialId === mat.id);
          if (purchasedItems.length === 0) return mat;

          // A quantidade lançada na compra representa pacotes/lotes comprados.
          // Cada pacote/lote acrescenta ao estoque a quantidade interna cadastrada no material.
          const stockToAdd = purchasedItems.reduce(
            (sum, itemBought) => sum + (itemBought.quantity * (mat.packageQuantity || 1)),
            0
          );

          return {
            ...mat,
            currentStock: Number((mat.currentStock + stockToAdd).toFixed(4)),
            updatedAt: new Date().toISOString().split('T')[0],
          };
        });
      });
    }
  }, []);

  const handleDeletePurchase = useCallback((id: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ----------------------------------------------------
  // Production Handlers (Baixa de Insumos & Entrada no Estoque)
  // ----------------------------------------------------
  const handleSaveProduction = useCallback((production: Production, updateStock: boolean) => {
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
            if (deduction) {
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

  const handleDeleteProduction = useCallback((id: string, revertStock: boolean) => {
    setProductions((prev) => {
      const prodToRevert = prev.find((p) => p.id === id);
      if (revertStock && prodToRevert) {
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
              if (deduction) {
                return {
                  ...mat,
                  currentStock: Number((mat.currentStock + deduction.quantityTotal).toFixed(4)),
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
                return {
                  ...p,
                  currentStock: Number((current + deduction.quantityTotal).toFixed(4)),
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

              addDeduction(
                `${customItem.id}_${recipeItem.id}`,
                chosen.id,
                'material',
                chosen.name,
                chosen.unit,
                required,
                chosen.unitCost
              );
              continue;
            }

            if (recipeItem.type === 'material') {
              const child = materials.find((m) => m.id === recipeItem.targetId);
              if (!child) {
                alert(`O ingrediente "${recipeItem.name}" da receita virtual não foi encontrado.`);
                return null;
              }
              addDeduction(
                `${customItem.id}_${recipeItem.id}`,
                child.id,
                'material',
                child.name,
                child.unit,
                required,
                child.unitCost
              );
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
    const materialsCost = deductedItems.reduce((sum, d) => sum + d.totalCost, 0);
    const unitCost = materialsCost;

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
      calculatedMarginPercent: item.unitPrice > 0 ? ((item.unitPrice - unitCost) / item.unitPrice) * 100 : 0,
      netProfit: item.unitPrice - unitCost,
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
                totalCost: unitCost * saleItem.quantity,
              }
            : saleItem
        );
        const saleRevenue = updatedItems.reduce(
          (sum, saleItem) => sum + (saleItem.subtotal ?? saleItem.quantity * saleItem.unitPrice),
          0
        );
        const saleCost = updatedItems.reduce((sum, saleItem) => sum + saleItem.totalCost, 0);
        const saleProfit = saleRevenue - saleCost;

        return {
          ...sale,
          items: updatedItems,
          totalCost: saleCost,
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
  const handleSaveSale = useCallback((sale: Sale) => {
    const previousSale = sales.find((s) => s.id === sale.id);
    const stockAdjustments = new Map<string, number>();
    let blockedMessage = '';

    const normalizedItems = sale.items?.map((item) => {
      const previousItem = previousSale?.items?.find((prevItem) => prevItem.id === item.id);
      const stockProductId = item.isCustom ? item.customProductId : item.productId;

      const legacyConsumed = previousItem?.customStockConsumed ? (previousItem.quantity || 0) : 0;
      const previousConsumed = previousItem?.stockConsumedQuantity ?? legacyConsumed;
      const targetConsumed = sale.deliveryStatus === 'entregue' ? item.quantity : 0;
      const deltaToConsume = targetConsumed - previousConsumed;

      if (!stockProductId) {
        if (targetConsumed > 0 && item.isCustom) {
          blockedMessage = `Produza "${item.productName}" antes de marcar o pedido como entregue.`;
        }
        return {
          ...item,
          stockConsumedQuantity: targetConsumed > 0 ? previousConsumed : 0,
          customStockConsumed: targetConsumed > 0 ? previousConsumed > 0 : false,
        };
      }

      if (deltaToConsume > 0) {
        const stockProduct = products.find((p) => p.id === stockProductId);
        const physicalStock = stockProduct?.currentStock ?? 0;

        const reservedByOtherOrders = sales.reduce((total, currentSale) => {
          if (currentSale.id === sale.id || currentSale.deliveryStatus === 'entregue' || !currentSale.items) return total;
          return total + currentSale.items.reduce((sum, currentItem) => {
            const currentStockProductId = currentItem.isCustom ? currentItem.customProductId : currentItem.productId;
            return currentStockProductId === stockProductId
              ? sum + (currentItem.reservedQuantity || 0)
              : sum;
          }, 0);
        }, 0);

        const usableForThisSale = Math.max(0, physicalStock - reservedByOtherOrders);
        if (!stockProduct || usableForThisSale < deltaToConsume) {
          blockedMessage = `Estoque insuficiente de "${item.productName}" para concluir a entrega. Disponível para este pedido: ${usableForThisSale} un.`;
          return item;
        }

        stockAdjustments.set(
          stockProductId,
          (stockAdjustments.get(stockProductId) || 0) - deltaToConsume
        );
      } else if (deltaToConsume < 0) {
        stockAdjustments.set(
          stockProductId,
          (stockAdjustments.get(stockProductId) || 0) + Math.abs(deltaToConsume)
        );
      }

      const restoredReservation = sale.deliveryStatus === 'pendente_entrega' && previousConsumed > 0
        ? Math.min(item.quantity, previousConsumed)
        : (item.reservedQuantity || 0);

      return {
        ...item,
        reservedQuantity: sale.deliveryStatus === 'entregue' ? 0 : restoredReservation,
        stockConsumedQuantity: targetConsumed,
        customStockConsumed: item.isCustom ? targetConsumed > 0 : item.customStockConsumed,
      };
    });

    if (blockedMessage) {
      alert(blockedMessage);
      return;
    }

    if (stockAdjustments.size > 0) {
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          const delta = stockAdjustments.get(product.id);
          if (!delta) return product;
          return {
            ...product,
            currentStock: Math.max(0, Number(((product.currentStock ?? 0) + delta).toFixed(4))),
            updatedAt: new Date().toISOString().split('T')[0],
          };
        })
      );
    }

    const normalizedSale: Sale = {
      ...sale,
      items: normalizedItems || sale.items,
    };

    setSales((prev) => {
      const idx = prev.findIndex((s) => s.id === sale.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = normalizedSale;
        return updated;
      }
      return [normalizedSale, ...prev];
    });
  }, [sales, products]);

  const handleDeleteSale = useCallback((id: string) => {
    setSales((prev) => prev.filter((s) => s.id !== id));
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
    if (data.materials) setMaterials(data.materials);
    if (data.products) setProducts(data.products);
    if (data.purchases) setPurchases(data.purchases);
    if (data.productions) setProductions(data.productions);
    if (data.sales) setSales(data.sales);
    if (data.customers) setCustomers(data.customers);
    if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.settings) setSettings(withDefaultDiscountCodes(data.settings));
    if (data.todos) setTodos(data.todos);
  }, []);

  const handleSelectPreset = useCallback((preset: AtelierPreset) => {
    setMaterials(preset.materials);
    setProducts(preset.products);
    setPurchases(preset.purchases);
    setSales(preset.sales);
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

      {/* Lateral Menu Drawer & Sticky Top Bar */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'materials') setFilterLowStockInitial(false);
        }}
        lowStockCount={lowStockCount}
        productsCount={products.length}
        materialsCount={materials.length}
        salesCount={sales.length}
        purchasesCount={purchases.length}
        productionsCount={productions.length}
        customersCount={customers.length}
        birthdayCustomersCount={birthdayCustomersCount}
        atelierName={settings.atelierName}
        artisanName={settings.artisanName}
        user={user}
        syncStatus={syncStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'home' && (
          <HomeView
            artisanName={settings.artisanName}
            atelierName={settings.atelierName}
            materials={materials}
            products={products}
            purchases={purchases}
            sales={sales}
            todos={todos}
            onUpdateTodos={setTodos}
            onNavigate={(tab, filter) => {
              setActiveTab(tab);
              if (tab !== 'materials') setFilterLowStockInitial(false);
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
              setActiveTab('sales');
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialsView
            materials={materials}
            suppliers={suppliers}
            onSaveMaterial={handleSaveMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onQuickStockChange={handleQuickStockChange}
            onProduceMaterial={handleProduceMaterial}
            onOpenPurchaseHistory={() => setActiveTab('purchases')}
            filterLowStockInitial={filterLowStockInitial}
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

        {activeTab === 'purchases' && (
          <PurchasesView
            purchases={purchases}
            materials={materials}
            suppliers={suppliers}
            onSavePurchase={handleSavePurchase}
            onDeletePurchase={handleDeletePurchase}
            onOpenSuppliers={() => setActiveTab('suppliers')}
          />
        )}

        {activeTab === 'productions' && (
          <ProductionsView
            productions={productions}
            products={products}
            materials={materials}
            onSaveProduction={handleSaveProduction}
            onDeleteProduction={handleDeleteProduction}
            onNavigateToProducts={() => setActiveTab('products')}
            initialSelectedProduct={productionInitialProduct}
            onClearInitialProduct={() => setProductionInitialProduct(null)}
          />
        )}

        {activeTab === 'sales' && (
          <SalesView
            sales={sales}
            products={products}
            materials={materials}
            customers={customers}
            paymentMethods={paymentMethods}
            discountCodes={settings.discountCodes || []}
            onSaveSale={handleSaveSale}
            onReserveSaleItem={handleReserveSaleItem}
            onReleaseSaleItemReservation={handleReleaseSaleItemReservation}
            onProduceCustomItem={handleProduceCustomItem}
            onDeleteSale={handleDeleteSale}
            onSaveCustomer={handleSaveCustomer}
            onAddPaymentMethod={handleAddPaymentMethod}
            initialFilter={salesInitialFilter}
            initialCustomerForNewOrder={customerForNewSale}
            onClearInitialCustomer={() => setCustomerForNewSale(null)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            sales={sales}
            products={products}
            discountCodes={settings.discountCodes || []}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onNavigateToNewOrderWithCustomer={handleCreateSaleForCustomer}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            sales={sales}
            purchases={purchases}
            products={products}
            materials={materials}
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
      </main>

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
        itemCounts={{
          materials: materials.length,
          products: products.length,
          purchases: purchases.length,
          productions: productions.length,
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
