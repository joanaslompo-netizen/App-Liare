import React, { useEffect } from 'react';
import { 
  Home,
  Package, 
  Tag, 
  ShoppingCart, 
  DollarSign, 
  BarChart3, 
  Truck, 
  Users,
  Cake,
  Settings, 
  Cloud, 
  X, 
  Scissors, 
  Menu,
  ChevronRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { NavTab } from '../types';
import { User } from '../lib/firebase';
import { CloudSyncStatus } from '../services/cloudSync';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  lowStockCount: number;
  productsCount: number;
  materialsCount: number;
  salesCount: number;
  purchasesCount: number;
  customersCount?: number;
  birthdayCustomersCount?: number;
  atelierName: string;
  artisanName: string;
  user: User | null;
  syncStatus: CloudSyncStatus;
  onOpenSettings: () => void;
  onOpenCloudSync: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  onOpen,
  activeTab,
  onSelectTab,
  lowStockCount,
  productsCount,
  materialsCount,
  salesCount,
  customersCount = 0,
  birthdayCustomersCount = 0,
  atelierName,
  artisanName,
  user,
  onOpenSettings,
  onOpenCloudSync,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navItems = [
    {
      id: 'home' as NavTab,
      label: 'Início & Tarefas',
      description: 'Visão geral, alertas e afazeres',
      icon: Home,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'products' as NavTab,
      label: 'Produtos & Receitas',
      description: 'Fichas técnicas e precificação',
      icon: Tag,
      badge: productsCount > 0 ? `${productsCount}` : null,
      badgeColor: 'bg-stone-100 text-stone-700',
    },
    {
      id: 'materials' as NavTab,
      label: 'Estoque de Materiais',
      description: 'Insumos, preços e saldo',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} em baixa` : `${materialsCount}`,
      badgeColor: lowStockCount > 0 ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-100 text-stone-700',
    },
    {
      id: 'purchases' as NavTab,
      label: 'Histórico de Compras',
      description: 'Notas e reposição de insumos',
      icon: ShoppingCart,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'sales' as NavTab,
      label: 'Vendas & Pedidos',
      description: 'Controle de lucro e clientes',
      icon: DollarSign,
      badge: salesCount > 0 ? `${salesCount}` : null,
      badgeColor: 'bg-emerald-100 text-emerald-800 font-semibold',
    },
    {
      id: 'customers' as NavTab,
      label: 'Clientes & Contatos',
      description: 'Aniversariantes e histórico de compras',
      icon: Users,
      badge: birthdayCustomersCount > 0 ? `${birthdayCustomersCount} 🎂` : (customersCount > 0 ? `${customersCount}` : null),
      badgeColor: birthdayCustomersCount > 0 ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-100 text-stone-700',
    },
    {
      id: 'reports' as NavTab,
      label: 'Relatórios Mensais',
      description: 'Análise de margens e lucro',
      icon: BarChart3,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'suppliers' as NavTab,
      label: 'Fornecedores',
      description: 'Contatos e lojas parceiras',
      icon: Truck,
      badge: null,
      badgeColor: '',
    },
  ];

  // Tab Title helper
  const currentTabObj = navItems.find((n) => n.id === activeTab) || navItems[0];

  return (
    <>
      {/* Fixed/Sticky Top Bar with Menu & Section Indicator */}
      <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* The Main Lateral Trigger Button */}
            <button
              id="btn-open-sidebar"
              type="button"
              onClick={onOpen}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group active:scale-95"
              title="Abrir Menu com todas as opções do ateliê"
            >
              <Menu className="w-4 h-4 text-amber-400 group-hover:rotate-6 transition-transform" />
              <span>Menu</span>
              {lowStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* Atelier brand name */}
            <span className="hidden md:inline text-sm font-bold text-stone-900 tracking-tight">
              {atelierName || 'Ateliê'}
            </span>

            {/* Divider */}
            <span className="text-stone-300">/</span>

            {/* Current Section Indicator */}
            <div className="flex items-center gap-1.5 font-semibold text-xs text-stone-800 bg-stone-100/90 border border-stone-200/60 px-2.5 py-1 rounded-lg">
              <currentTabObj.icon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{currentTabObj.label}</span>
            </div>
          </div>

          {/* Quick Right Actions: Alerts & Settings */}
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && activeTab !== 'materials' && (
              <button
                onClick={() => onSelectTab('materials')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold cursor-pointer transition-colors"
                title="Itens com estoque baixo"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline">{lowStockCount} {lowStockCount === 1 ? 'item em baixa' : 'itens em baixa'}</span>
                <span className="sm:hidden">{lowStockCount}</span>
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Configurações do Ateliê"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* Slide-over Drawer Menu */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-stone-900 text-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {atelierName || 'Ateliê'}
              </h3>
              <p className="text-xs text-stone-400 truncate">
                {artisanName ? `Por ${artisanName}` : 'Gestão de Custos'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-sidebar"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vertical Navigation Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-3 mb-2 block">
            Navegação do Ateliê
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`drawer-nav-item-${item.id}`}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer group ${
                  isActive 
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-md' 
                    : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-stone-950/20 text-stone-950' : 'bg-stone-800 text-stone-400 group-hover:text-amber-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold leading-tight">
                      {item.label}
                    </div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-stone-800' : 'text-stone-400'}`}>
                      {item.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-stone-950 text-white font-semibold' : item.badgeColor
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
                    isActive ? 'text-stone-950' : 'text-stone-600 group-hover:translate-x-0.5 group-hover:text-stone-400'
                  }`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Drawer Bottom Actions */}
        <div className="p-4 border-t border-stone-800 space-y-2 bg-stone-950/40">
          {/* Cloud Sync Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCloudSync();
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Cloud className="w-4 h-4 text-amber-400" />
              <span>Sincronização Nuvem</span>
            </div>
            {user ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Ativa
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-700 text-stone-400">
                Local
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors text-xs font-medium cursor-pointer"
          >
            <Settings className="w-4 h-4 text-stone-400" />
            <span>Configurações do Ateliê</span>
          </button>
        </div>
      </div>
    </>
  );
};
