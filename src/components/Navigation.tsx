import React from 'react';
import { 
  Package, 
  Tag, 
  ShoppingCart, 
  DollarSign, 
  BarChart3, 
  Truck,
  Users,
  Hammer
} from 'lucide-react';
import { NavTab } from '../types';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  lowStockCount: number;
  customersCount?: number;
  productionsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  lowStockCount,
  customersCount = 0,
  productionsCount = 0,
}) => {
  const tabs = [
    {
      id: 'materials' as NavTab,
      label: 'Materiais & Estoque',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-amber-500 text-stone-950 font-bold',
    },
    {
      id: 'products' as NavTab,
      label: 'Produtos & Receitas',
      icon: Tag,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'purchases' as NavTab,
      label: 'Histórico de Compras',
      icon: ShoppingCart,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'productions' as NavTab,
      label: 'Histórico de Produção',
      icon: Hammer,
      badge: productionsCount > 0 ? `${productionsCount}` : null,
      badgeColor: 'bg-amber-100 text-amber-900 font-semibold',
    },
    {
      id: 'sales' as NavTab,
      label: 'Vendas & Pedidos',
      icon: DollarSign,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'customers' as NavTab,
      label: 'Clientes',
      icon: Users,
      badge: customersCount > 0 ? `${customersCount}` : null,
      badgeColor: 'bg-amber-100 text-amber-900 font-semibold',
    },
    {
      id: 'reports' as NavTab,
      label: 'Relatórios Mensais',
      icon: BarChart3,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'suppliers' as NavTab,
      label: 'Fornecedores',
      icon: Truck,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <nav className="bg-white border-b border-stone-200 sticky top-[73px] z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2.5 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
