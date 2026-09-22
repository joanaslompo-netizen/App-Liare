import React from 'react';
import { Scissors, Settings, TrendingUp, AlertTriangle, Menu } from 'lucide-react';
import { Material, Product, Sale } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { User } from '../lib/firebase';
import { CloudSyncStatus } from '../services/cloudSync';

interface HeaderProps {
  atelierName: string;
  artisanName: string;
  materials: Material[];
  products: Product[];
  sales: Sale[];
  user?: User | null;
  syncStatus?: CloudSyncStatus;
  onOpenSettings: () => void;
  onOpenExamplePresets?: () => void;
  onNavigateToLowStock: () => void;
  onOpenCloudSync?: () => void;
  onOpenSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  atelierName,
  artisanName,
  materials,
  sales,
  onOpenSettings,
  onNavigateToLowStock,
  onOpenSidebar,
}) => {
  // Low stock materials count
  const lowStockCount = materials.filter((m) => !m.isVirtualRecipe && !m.isPaused && m.minStock > 0 && m.currentStock <= m.minStock).length;

  // Current month revenue
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthSales = sales.filter((s) => s.date.startsWith(currentMonth));
  const monthRevenue = monthSales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const monthProfit = monthSales.reduce((acc, s) => acc + s.totalProfit, 0);
  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

  // Stock inventory total value
  const totalStockValue = materials.reduce((acc, m) => acc + (m.currentStock * m.unitCost), 0);

  return (
    <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          
          {/* Logo & Atelier Info */}
          <div className="flex items-center gap-3">
            {onOpenSidebar && (
              <button
                id="btn-header-menu-toggle"
                type="button"
                onClick={onOpenSidebar}
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer shrink-0 group active:scale-95"
                title="Abrir Menu com todas as opções do ateliê"
                aria-label="Abrir Menu"
              >
                <Menu className="w-5 h-5 text-amber-400 group-hover:rotate-6 transition-transform" />
                <span className="hidden sm:inline">Opções</span>
              </button>
            )}

            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {atelierName || 'Gestor de Custos Ateliê'}
                </h1>
                <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Ateliê Pro
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {artisanName ? `Por ${artisanName}` : 'Controle de Materiais, Precificação & Lucro'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
            {/* Stock alert button if any */}
            {lowStockCount > 0 && (
              <button
                id="btn-header-low-stock"
                onClick={onNavigateToLowStock}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-300 hover:bg-amber-900/50 transition-colors text-xs font-medium cursor-pointer"
                title="Clique para ver itens com estoque baixo"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{lowStockCount} {lowStockCount === 1 ? 'item em baixa' : 'itens em baixa'}</span>
              </button>
            )}

            {/* Total Stock Asset */}
            <div className="hidden lg:block border-l border-stone-800 pl-4">
              <span className="text-[11px] uppercase tracking-wider text-stone-400 block">
                Valor em Estoque
              </span>
              <span className="font-semibold text-stone-200">
                {formatCurrency(totalStockValue)}
              </span>
            </div>

            {/* Month Profit */}
            <div className="border-l border-stone-800 pl-4">
              <span className="text-[11px] uppercase tracking-wider text-stone-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Lucro no Mês
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-emerald-400">
                  {formatCurrency(monthProfit)}
                </span>
                {monthRevenue > 0 && (
                  <span className="text-xs text-stone-400">
                    ({formatPercent(monthMargin)})
                  </span>
                )}
              </div>
            </div>

            {/* Settings button */}
            <button
              id="btn-header-settings"
              onClick={onOpenSettings}
              className="p-2.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 border border-stone-700/60 transition-colors"
              title="Configurações do Ateliê & Backup"
              aria-label="Configurações do Ateliê"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
