import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Package, 
  Building2, 
  DollarSign, 
  ArrowUpDown,
  ExternalLink,
  Layers,
  ShoppingBag,
  ShoppingCart,
  Wand2,
  Pause,
  Play,
  Hammer
} from 'lucide-react';
import { Material, Supplier, UnitOfMeasure, MaterialType } from '../types';
import { 
  formatCurrency, 
  formatNumber, 
  UNIT_LABELS, 
  UNIT_SHORT, 
  calculateUnitCost,
  matchesSearchText
} from '../utils/formatters';
import { processImageFile } from '../utils/imageHelper';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';

interface MaterialsViewProps {
  materials: Material[];
  suppliers: Supplier[];
  onSaveMaterial: (material: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onQuickStockChange: (id: string, delta: number) => void;
  onProduceMaterial?: (materialId: string, batchCount: number) => void;
  onOpenPurchaseHistory?: () => void;
  filterLowStockInitial?: boolean;
  openNewMaterialSignal?: number;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  materials,
  suppliers,
  onSaveMaterial,
  onDeleteMaterial,
  onQuickStockChange,
  onProduceMaterial,
  onOpenPurchaseHistory,
  filterLowStockInitial = false,
  openNewMaterialSignal = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'for_sale' | 'durable'>('all');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(filterLowStockInitial);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Quick adjust inline state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials
      .filter((m) => {
        const matchesSearch = 
          matchesSearchText(m.name, searchTerm) ||
          (m.supplierName && matchesSearchText(m.supplierName, searchTerm)) ||
          matchesSearchText(m.category, searchTerm);
        
        const matchesCategory = selectedCategory === 'all' || (selectedCategory === 'paused' ? !!m.isPaused : m.category === selectedCategory);
        const matchesLowStock = !onlyLowStock || (!m.isVirtualRecipe && m.usageType !== 'durable' && !m.isPaused && m.minStock > 0 && m.currentStock <= m.minStock);
        const matchesType = 
          typeFilter === 'all' || 
          (typeFilter === 'internal' && m.usageType !== 'durable' && (!m.materialType || m.materialType === 'internal')) ||
          (typeFilter === 'for_sale' && m.usageType !== 'durable' && m.materialType === 'for_sale') ||
          (typeFilter === 'durable' && m.usageType === 'durable');

        return matchesSearch && matchesCategory && matchesLowStock && matchesType;
      })
      .sort((a, b) => {
        const aPaused = !!a.isPaused;
        const bPaused = !!b.isPaused;

        // Paused materials go to the bottom of the list
        if (aPaused !== bPaused) {
          return aPaused ? 1 : -1;
        }

        // Alphabetical sorting A to Z
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [materials, searchTerm, selectedCategory, onlyLowStock, typeFilter]);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mat: Material) => {
    setEditingMaterial(mat);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (openNewMaterialSignal > 0) {
      handleOpenAdd();
    }
  }, [openNewMaterialSignal]);

  const handleConfirmAdjust = (id: string) => {
    const newStock = parseFloat(adjustDelta);
    const material = materials.find((m) => m.id === id);

    if (!material || isNaN(newStock) || newStock < 0) {
      alert('Informe um valor de estoque válido, igual ou maior que zero.');
      return;
    }

    const delta = newStock - material.currentStock;
    if (delta !== 0) {
      onQuickStockChange(id, delta);
    }

    setAdjustingId(null);
    setAdjustDelta('');
  };

  return (
    <div className="space-y-6">
      {/* Top action and filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
            Estoque de Materiais & Insumos
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Gerencie custos por unidade de medida, fotos, fornecedores e alertas de estoque baixo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenPurchaseHistory && (
            <button
              type="button"
              onClick={onOpenPurchaseHistory}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 text-sm font-medium rounded-xl border border-stone-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingCart className="w-4 h-4 text-amber-700" />
              <span>Compras de Materiais</span>
            </button>
          )}

          <button
            id="btn-add-material"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Novo Material</span>
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              id="search-materials"
              type="text"
              placeholder="Buscar por nome do material, categoria ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-900"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('internal')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                typeFilter === 'internal'
                  ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Etiquetas, caixas, fitas e insumos internos de produção"
            >
              <Layers className="w-3 h-3 text-amber-600" />
              <span>Insumos Internos</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('for_sale')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                typeFilter === 'for_sale'
                  ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Produtos finais para revenda/venda direta"
            >
              <ShoppingBag className="w-3 h-3 text-emerald-600" />
              <span>Venda Direta</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('durable')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                typeFilter === 'durable'
                  ? 'bg-white text-purple-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Moldes, ferramentas e equipamentos reutilizáveis"
            >
              <Hammer className="w-3 h-3 text-purple-600" />
              <span>Itens Duráveis</span>
            </button>
          </div>

          {/* Low stock toggle */}
          <button
            id="filter-low-stock-toggle"
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              onlyLowStock
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${onlyLowStock ? 'text-amber-700' : 'text-stone-400'}`} />
            <span>Apenas Estoque Baixo</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
          <span className="text-xs font-medium text-stone-500 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Categorias:
          </span>
          <button
            id="cat-pill-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todas ({materials.length})
          </button>
          <button
            id="cat-pill-paused"
            onClick={() => setSelectedCategory('paused')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === 'paused'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Pausados ({materials.filter((m) => !!m.isPaused).length})
          </button>
          {categories.map((cat) => {
            const count = materials.filter((m) => m.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                id={`cat-pill-${cat}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials List / Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            Nenhum material encontrado
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            {searchTerm || onlyLowStock || selectedCategory !== 'all'
              ? 'Tente ajustar seus filtros de busca ou categoria.'
              : 'Comece adicionando os tecidos, aviamentos, papéis ou embalagens que você usa em seu ateliê.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Primeiro Material</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((mat) => {
            const isVirtual = !!mat.isVirtualRecipe;
            const isDurable = mat.usageType === 'durable';
            const isPaused = !!mat.isPaused;
            const isLowStock = !isVirtual && !isDurable && !isPaused && mat.minStock > 0 && mat.currentStock <= mat.minStock;
            const stockPct = !isVirtual && !isDurable && mat.minStock > 0 ? Math.min(100, (mat.currentStock / (mat.minStock * 2)) * 100) : 100;

            return (
              <div
                key={mat.id}
                id={`material-card-${mat.id}`}
                className={`bg-white rounded-xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isPaused
                    ? 'opacity-70 bg-stone-50/60 border-stone-200'
                    : isLowStock
                    ? 'border-amber-300 ring-1 ring-amber-300/60'
                    : 'border-stone-200'
                }`}
              >
                <div>
                  {/* Card Header with Image and Category */}
                  <div className="flex items-start gap-3.5 p-4 pb-3">
                    {/* Material Photo or Placeholder */}
                    <div className="w-16 h-16 rounded-lg bg-stone-100 border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {mat.imageUrl ? (
                        <img
                          src={mat.imageUrl}
                          alt={mat.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-stone-400 flex flex-col items-center">
                          <ImageIcon className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] mt-0.5 text-stone-400 font-medium uppercase">Foto</span>
                        </div>
                      )}
                    </div>

                    {/* Title and Category */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate">
                            {mat.category}
                          </span>
                          {mat.isMadeInAtelier && (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200 shrink-0 flex items-center gap-0.5" title={mat.isVirtualRecipe ? 'Receita virtual preparada somente na hora da produção' : 'Material produzido no ateliê'}>
                              <Wand2 className="w-2.5 h-2.5 text-purple-600" />
                              {mat.isVirtualRecipe ? 'Receita Virtual' : 'Feito no Ateliê'}
                            </span>
                          )}
                          {isDurable ? (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200 shrink-0 flex items-center gap-0.5" title="Item reutilizável: não é consumido na produção">
                              <Hammer className="w-2.5 h-2.5 text-purple-600" />
                              {mat.durableKind === 'mold' ? 'Molde' : mat.durableKind === 'equipment' ? 'Equipamento' : mat.durableKind === 'tool' ? 'Ferramenta' : 'Item Durável'}
                            </span>
                          ) : mat.materialType === 'for_sale' ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shrink-0 flex items-center gap-0.5" title="Produto final para venda direta">
                              <ShoppingBag className="w-2.5 h-2.5 text-emerald-600" />
                              Venda Direta
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200 shrink-0 flex items-center gap-0.5" title="Insumo interno / produção">
                              <Layers className="w-2.5 h-2.5 text-stone-500" />
                              Insumo Interno
                            </span>
                          )}
                        </div>
                        {isPaused ? (
                          <span className="text-[10px] font-medium text-stone-600 bg-stone-200/90 border border-stone-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0" title="Material pausado manualmente">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Pausado
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Estoque Baixo
                          </span>
                        ) : null}
                      </div>
                      <h4 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2" title={mat.name}>
                        {mat.name}
                      </h4>
                      {mat.supplierName && (
                        <p className="text-xs text-stone-500 mt-1 flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{mat.supplierName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Unit Details */}
                  <div className="px-4 py-2.5 bg-stone-50/80 border-y border-stone-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-stone-500 block">{isDurable ? 'Valor por unidade' : `Custo por ${UNIT_SHORT[mat.unit]}`}</span>
                      <span className="font-bold text-stone-900 text-sm">
                        {formatCurrency(mat.unitCost)}
                        <span className="text-stone-500 font-normal text-xs"> / {UNIT_SHORT[mat.unit]}</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-stone-500 block">{isVirtual ? 'Tipo de custo' : 'Compra de origem'}</span>
                      <span className="text-stone-700 font-medium">
                        {isVirtual
                          ? 'Estimado pela receita'
                          : `${formatCurrency(mat.packagePrice)} por ${formatNumber(mat.packageQuantity)} ${UNIT_SHORT[mat.packageUnit]}`}
                      </span>
                    </div>
                  </div>

                  {/* Stock Level Bar & Adjuster */}
                  {isVirtual ? (
                    <div className="p-4 pt-3">
                      <div className="rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                          <Wand2 className="w-3.5 h-3.5" />
                          Produção sob demanda
                        </div>
                        <p className="text-[11px] text-purple-700 mt-1">
                          Esta receita não possui estoque próprio. Os ingredientes reais são baixados quando você lança a produção da peça.
                        </p>
                      </div>
                    </div>
                  ) : isDurable ? (
                    <div className="p-4 pt-3 space-y-2">
                      <div className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-purple-900">Quantidade possuída</span>
                          <span className="text-sm font-extrabold text-stone-900">{formatNumber(mat.currentStock)} un</span>
                        </div>
                        <p className="text-[10px] text-purple-700 mt-1">Item reutilizável: não gera alerta de estoque baixo e não é consumido nas receitas.</p>
                        {mat.moldShapes && mat.moldShapes.length > 0 && (
                          <p className="text-[10px] text-stone-600 mt-1.5"><strong>Formatos:</strong> {mat.moldShapes.join(' • ')}</p>
                        )}
                      </div>
                      {adjustingId === mat.id ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input type="number" step="1" min="0" placeholder="Nova quantidade" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} className="w-24 text-xs px-2 py-1 bg-white border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-stone-900" autoFocus />
                          <button onClick={() => handleConfirmAdjust(mat.id)} className="p-1 bg-stone-900 text-white rounded hover:bg-stone-800 text-xs font-medium px-2">Ok</button>
                          <button onClick={() => setAdjustingId(null)} className="p-1 text-stone-500 hover:text-stone-700 text-xs">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-stone-400">Valor cadastrado: {formatCurrency(mat.currentStock * mat.unitCost)}</span>
                          <button onClick={() => { setAdjustingId(mat.id); setAdjustDelta(String(mat.currentStock)); }} className="text-[11px] text-purple-800 hover:text-purple-900 font-medium underline cursor-pointer">Ajustar Quantidade</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-600 font-medium">
                          Estoque Atual:
                        </span>
                        <span className={`font-semibold ${isPaused ? 'text-stone-500' : isLowStock ? 'text-amber-700' : 'text-stone-800'}`}>
                          {formatNumber(mat.currentStock)} {UNIT_SHORT[mat.unit]}
                          <span className="text-stone-400 font-normal ml-1">
                            {isPaused ? `(Pausado · Mín: ${formatNumber(mat.minStock)} ${UNIT_SHORT[mat.unit]})` : `(Mín: ${formatNumber(mat.minStock)} ${UNIT_SHORT[mat.unit]})`}
                          </span>
                        </span>
                      </div>

                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPaused ? 'bg-stone-300' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(8, stockPct))}%` }}
                        />
                      </div>

                      {adjustingId === mat.id ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="number"
                            step="any"
                            placeholder="Novo estoque"
                            value={adjustDelta}
                            onChange={(e) => setAdjustDelta(e.target.value)}
                            className="w-24 text-xs px-2 py-1 bg-white border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-900"
                            autoFocus
                          />
                          <button
                            onClick={() => handleConfirmAdjust(mat.id)}
                            className="p-1 bg-stone-900 text-white rounded hover:bg-stone-800 text-xs font-medium px-2"
                          >
                            Ok
                          </button>
                          <button
                            onClick={() => setAdjustingId(null)}
                            className="p-1 text-stone-500 hover:text-stone-700 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-stone-400">
                            Valor total em estoque: {formatCurrency(mat.currentStock * mat.unitCost)}
                          </span>
                          <button
                            onClick={() => {
                              setAdjustingId(mat.id);
                              setAdjustDelta(String(mat.currentStock));
                            }}
                            className="text-[11px] text-amber-800 hover:text-amber-900 font-medium underline cursor-pointer"
                          >
                            Ajustar Estoque
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">
                    ID: {mat.id}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      id={`btn-pause-material-${mat.id}`}
                      onClick={() => onSaveMaterial({
                        ...mat,
                        isPaused: !mat.isPaused,
                        updatedAt: new Date().toISOString().split('T')[0],
                      })}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        mat.isPaused
                          ? 'text-emerald-700 hover:bg-emerald-50'
                          : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      }`}
                      title={mat.isPaused ? 'Retomar material' : 'Pausar material'}
                    >
                      {mat.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span>{mat.isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>
                    {mat.isMadeInAtelier && !mat.isVirtualRecipe && onProduceMaterial && (
                      <button type="button" onClick={() => {
                        const raw = prompt("Quantos lotes de \"" + mat.name + "\" deseja produzir?", "1");
                        if (raw === null) return;
                        const count = parseInt(raw, 10);
                        if (!Number.isInteger(count) || count <= 0) {
                          alert("Informe uma quantidade inteira de lotes maior que zero.");
                          return;
                        }
                        onProduceMaterial(mat.id, count);
                      }} className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded-md" title="Produzir lote">
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      id={"btn-edit-material-" + mat.id}
                      onClick={() => handleOpenEdit(mat)}
                      className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-md transition-colors"
                      title="Editar material"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-material-${mat.id}`}
                      onClick={() => {
                        if (confirm(`Deseja realmente excluir o material "${mat.name}"?`)) {
                          onDeleteMaterial(mat.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Excluir material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Material Modal */}
      {isModalOpen && (
        <MaterialModal
          isOpen={isModalOpen}
          material={editingMaterial}
          existingCategories={categories}
          suppliers={suppliers}
          onClose={() => setIsModalOpen(false)}
          materials={materials}
          onSave={(saved) => {
            onSaveMaterial(saved);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

interface MaterialModalProps {
  isOpen: boolean;
  material: Material | null;
  existingCategories: string[];
  suppliers: Supplier[];
  materials: Material[];
  onClose: () => void;
  onSave: (mat: Material) => void;
}

const MaterialModal: React.FC<MaterialModalProps> = ({
  material,
  existingCategories,
  suppliers,
  materials,
  onClose,
  onSave,
}) => {
  const isEditing = !!material;

  const [isMadeInAtelier, setIsMadeInAtelier] = useState(material?.isMadeInAtelier || false);
  const [isVirtualRecipe, setIsVirtualRecipe] = useState(material ? !!material.isVirtualRecipe : true);
  const [recipeItems, setRecipeItems] = useState<import('../types').RecipeItem[]>(material?.recipeItems || []);
  const [recipeTargetId, setRecipeTargetId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState('1');
  const [recipeInputMode, setRecipeInputMode] = useState<'material' | 'category'>('material');
  const [recipeCategory, setRecipeCategory] = useState<string>('');

  const [name, setName] = useState(material?.name || '');
  const [materialType, setMaterialType] = useState<MaterialType>(material?.materialType || 'internal');
  const [usageType, setUsageType] = useState<'consumable' | 'durable'>(material?.usageType || 'consumable');
  const [durableKind, setDurableKind] = useState<'mold' | 'tool' | 'equipment' | 'other'>(material?.durableKind || 'mold');
  const [durableMaterial, setDurableMaterial] = useState(material?.durableMaterial || '');
  const [durableDimensions, setDurableDimensions] = useState(material?.durableDimensions || '');
  const [durableCavities, setDurableCavities] = useState(material?.durableCavities?.toString() || '1');
  const [moldShapesText, setMoldShapesText] = useState((material?.moldShapes || []).join('\n'));
  const [durableCapacityGrams, setDurableCapacityGrams] = useState(material?.durableCapacityGrams?.toString() || '');
  const [category, setCategory] = useState(material?.category || (existingCategories[0] || 'Tecidos & Forros'));
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Unit configuration
  const [unit, setUnit] = useState<UnitOfMeasure>(material?.unit || 'g');
  const [packageQuantity, setPackageQuantity] = useState<string>(material ? material.packageQuantity.toString() : '1');
  const [packageUnit, setPackageUnit] = useState<UnitOfMeasure>(material?.packageUnit || 'g');
  const [packagePrice, setPackagePrice] = useState<string>(material ? material.packagePrice.toString() : '0');

  // Stock
  const [currentStock, setCurrentStock] = useState<string>(material ? material.currentStock.toString() : '100');
  const [minStock, setMinStock] = useState<string>(material ? material.minStock.toString() : '20');

  // Supplier
  const [supplierId, setSupplierId] = useState<string>(material?.supplierId || '');
  
  // Image
  const [imageUrl, setImageUrl] = useState<string>(material?.imageUrl || '');
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [notes, setNotes] = useState(material?.notes || '');

  // Calculated unit cost preview
  const parsedPrice = parseFloat(packagePrice) || 0;
  const parsedPkgQty = parseFloat(packageQuantity) || 1;
  const calculatedUnitCostPreview = calculateUnitCost(parsedPrice, parsedPkgQty, packageUnit, unit);

  const materialCategoriesForRecipe = useMemo(
    () => existingCategories.filter((cat) =>
      materials.some((m) => m.id !== material?.id && !m.isVirtualRecipe && m.category === cat)
    ),
    [existingCategories, materials, material?.id]
  );

  const getRecipeItemCurrentCost = (item: import('../types').RecipeItem) => {
    if (item.selectionMode === 'category' && item.targetCategory) {
      const options = materials.filter((m) => !m.isVirtualRecipe && m.usageType !== 'durable' && m.category === item.targetCategory);
      if (options.length === 0) return { unitCost: item.unitCost || 0, unit: item.unit };
      const avg = options.reduce((sum, m) => sum + m.unitCost, 0) / options.length;
      const units = Array.from(new Set(options.map((m) => m.unit)));
      return { unitCost: avg, unit: units.length === 1 ? UNIT_SHORT[units[0]] : item.unit };
    }

    const fixed = materials.find((m) => m.id === item.targetId);
    return fixed
      ? { unitCost: fixed.usageType === 'durable' ? 0 : fixed.unitCost, unit: UNIT_SHORT[fixed.unit] }
      : { unitCost: item.unitCost || 0, unit: item.unit };
  };

  const getRecipeItemUnitOfMeasure = (item: import('../types').RecipeItem): UnitOfMeasure | null => {
    if (item.selectionMode === 'category' && item.targetCategory) {
      const options = materials.filter((m) => !m.isVirtualRecipe && m.usageType !== 'durable' && m.category === item.targetCategory);
      const units = Array.from(new Set(options.map((m) => m.unit)));
      return units.length === 1 ? units[0] : null;
    }

    const fixed = materials.find((m) => m.id === item.targetId);
    if (fixed?.usageType === 'durable') return null;
    return fixed?.unit || null;
  };

  const normalizedRecipeItems = recipeItems.map((item) => {
    const current = getRecipeItemCurrentCost(item);
    return {
      ...item,
      unit: current.unit,
      unitCost: current.unitCost,
      totalCost: current.unitCost * item.quantity,
    };
  });

  const recipeUnits = Array.from(
    new Set(
      recipeItems
        .map((item) => getRecipeItemUnitOfMeasure(item))
        .filter((value): value is UnitOfMeasure => !!value)
    )
  );
  const inferredRecipeUnit: UnitOfMeasure = recipeUnits.length === 1
    ? recipeUnits[0]
    : unit;
  const consumableRecipeItems = recipeItems.filter((item) => {
    if (item.type !== 'material') return true;
    if (item.selectionMode === 'category') return true;
    return materials.find((m) => m.id === item.targetId)?.usageType !== 'durable';
  });
  const hasMixedRecipeUnits = consumableRecipeItems.length > 0 && recipeUnits.length !== 1;
  const automaticRecipeYield = consumableRecipeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const parsedRecipeYield = Math.max(0.0001, automaticRecipeYield || 1);
  const recipeTotalCost = normalizedRecipeItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const recipeUnitCost = recipeTotalCost / parsedRecipeYield;

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageLoading(true);
      const dataUrl = await processImageFile(file);
      setImageUrl(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar a imagem.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do material.');
      return;
    }

    const finalCategory = isCustomCategory ? (newCategoryInput.trim() || 'Geral') : category;
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    if (isMadeInAtelier && recipeItems.length === 0) {
      alert('Adicione pelo menos um ingrediente à receita do material feito no ateliê.');
      return;
    }
    if (isMadeInAtelier && !isVirtualRecipe && recipeItems.some((item) => item.selectionMode === 'category')) {
      alert('Ingredientes por categoria só podem ser usados em Receita Virtual, pois a escolha acontece na produção da peça.');
      return;
    }
    if (isMadeInAtelier && hasMixedRecipeUnits) {
      alert('Todos os ingredientes da receita precisam usar a mesma unidade de medida.');
      return;
    }

    const isDurable = usageType === 'durable';
    const finalUnit: UnitOfMeasure = isDurable ? 'un' : (isMadeInAtelier ? inferredRecipeUnit : unit);
    const parsedDurableCavities = Math.max(1, parseInt(durableCavities, 10) || 1);
    const parsedCapacityGrams = parseFloat(durableCapacityGrams);
    const parsedMoldShapes = moldShapesText
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);

    const newOrUpdated: Material = {
      id: material?.id || `mat_${Date.now()}`,
      name: name.trim(),
      category: finalCategory,
      materialType: isDurable ? 'internal' : materialType,
      usageType,
      durableKind: isDurable ? durableKind : undefined,
      durableMaterial: isDurable ? (durableMaterial.trim() || undefined) : undefined,
      durableDimensions: isDurable ? (durableDimensions.trim() || undefined) : undefined,
      durableCavities: isDurable ? parsedDurableCavities : undefined,
      moldShapes: isDurable && durableKind === 'mold' ? parsedMoldShapes : undefined,
      durableCapacityGrams: isDurable && Number.isFinite(parsedCapacityGrams) ? parsedCapacityGrams : undefined,
      unit: finalUnit,
      packageQuantity: isDurable ? Math.max(1, parsedPkgQty) : (isMadeInAtelier ? parsedRecipeYield : parsedPkgQty),
      packageUnit: isDurable ? 'un' : (isMadeInAtelier ? finalUnit : packageUnit),
      packagePrice: isMadeInAtelier && !isDurable ? 0 : parsedPrice,
      unitCost: isDurable ? (parsedPrice / Math.max(1, parsedPkgQty)) : (isMadeInAtelier ? recipeUnitCost : calculatedUnitCostPreview),
      isMadeInAtelier: isDurable ? false : isMadeInAtelier,
      isVirtualRecipe: isDurable ? false : (isMadeInAtelier ? isVirtualRecipe : false),
      recipeItems: isDurable ? undefined : (isMadeInAtelier ? normalizedRecipeItems : undefined),
      batchYield: isDurable ? undefined : (isMadeInAtelier ? parsedRecipeYield : undefined),
      recipeTotalCost: isDurable ? undefined : (isMadeInAtelier ? recipeTotalCost : undefined),
      unitCostFromBatch: isDurable ? undefined : (isMadeInAtelier ? recipeUnitCost : undefined),
      currentStock: isMadeInAtelier && isVirtualRecipe && !isDurable ? 0 : (parseFloat(currentStock) || 0),
      minStock: isDurable ? 0 : (isMadeInAtelier && isVirtualRecipe ? 0 : (parseFloat(minStock) || 0)),
      isPaused: material?.isPaused ?? false,
      supplierId: isMadeInAtelier ? undefined : (supplierId || undefined),
      supplierName: isMadeInAtelier ? undefined : (selectedSupplier ? selectedSupplier.name : undefined),
      imageUrl: imageUrl || undefined,
      notes: notes.trim() || undefined,
      createdAt: material?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSave(newOrUpdated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-stone-900 text-lg">
              {isEditing ? 'Editar Material' : 'Cadastrar Novo Material'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo & Main identification */}
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)] gap-4 sm:gap-5 items-start">
            {/* Photo upload container */}
            <div className="shrink-0 w-32 sm:w-36 flex flex-col items-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-500 bg-stone-50 cursor-pointer overflow-hidden relative flex flex-col items-center justify-center group transition-all"
                title="Clique para enviar ou alterar foto"
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-medium">
                      Trocar foto
                    </div>
                  </>
                ) : (
                  <div className="text-center p-2 text-stone-400 group-hover:text-amber-600">
                    <Upload className="w-6 h-6 mx-auto mb-1 stroke-1" />
                    <span className="text-[11px] font-medium block">Adicionar Foto</span>
                    <span className="text-[9px] text-stone-400 block mt-0.5">JPG / PNG</span>
                  </div>
                )}
                {imageLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs text-stone-600">
                    Processando...
                  </div>
                )}
              </div>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-rose-600 hover:text-rose-700 mt-2 font-medium"
                >
                  Remover foto
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            {/* Name, Category, Classification and Supplier */}
            <div className="w-full">
              {/* Material options: all materials are internal by default */}
              <div className="space-y-2">

                <button
                  type="button"
                  role="switch"
                  aria-checked={usageType === 'durable'}
                  onClick={() => {
                    const makeDurable = usageType !== 'durable';
                    setUsageType(makeDurable ? 'durable' : 'consumable');
                    if (makeDurable) {
                      setMaterialType('internal');
                      setIsMadeInAtelier(false);
                      setIsVirtualRecipe(false);
                      setUnit('un');
                      setPackageUnit('un');
                      setMinStock('0');
                      if (!material) {
                        setCurrentStock('1');
                        setPackageQuantity('1');
                      }
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${
                    usageType === 'durable'
                      ? 'bg-purple-50/80 border-purple-400 ring-1 ring-purple-400/40'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                  title="Moldes, ferramentas e equipamentos reutilizáveis"
                >
                  <span className="min-w-0 text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                    <span>Item Durável / Ferramenta</span>
                  </span>
                  <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${usageType === 'durable' ? 'bg-purple-600' : 'bg-stone-300'}`}>
                    <span className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${usageType === 'durable' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isMadeInAtelier}
                  onClick={() => {
                    const willBeMadeInAtelier = !isMadeInAtelier;
                    setIsMadeInAtelier(willBeMadeInAtelier);
                    if (willBeMadeInAtelier) {
                      setMaterialType('internal');
                      setUsageType('consumable');
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${
                    isMadeInAtelier
                      ? 'bg-purple-50/80 border-purple-400 ring-1 ring-purple-400/40'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                  title={isMadeInAtelier ? 'Feito no Ateliê ativado' : 'Feito no Ateliê desativado'}
                >
                  <span className="min-w-0 text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                    <span>Feito no Ateliê</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      isMadeInAtelier ? 'bg-purple-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${
                        isMadeInAtelier ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={materialType === 'for_sale'}
                  onClick={() => {
                    const willBeForSale = materialType !== 'for_sale';
                    setMaterialType(willBeForSale ? 'for_sale' : 'internal');
                    if (willBeForSale) {
                      setIsMadeInAtelier(false);
                      setUsageType('consumable');
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                    materialType === 'for_sale'
                      ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/40'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                  title={materialType === 'for_sale' ? 'Venda direta ativada' : 'Venda direta desativada'}
                >
                  <span className="min-w-0 text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Produto Final / Venda Direta</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      materialType === 'for_sale' ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${
                        materialType === 'for_sale' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="col-span-2 space-y-3.5 w-full">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nome do Material *
                </label>
                <input
                  id="input-material-name"
                  type="text"
                  required
                  placeholder="Ex: Tecido Tricoline Estampado 100% Algodão"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900"
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Categoria
                </label>
                {!isCustomCategory ? (
                  <div className="flex gap-2">
                    <select
                      id="select-material-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900"
                    >
                      {existingCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(true)}
                      className="px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap"
                    >
                      + Nova Categoria
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome da nova categoria..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {usageType === 'durable' && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-purple-700" />
                  Dados do Item Durável
                </h4>
                <p className="text-[11px] text-purple-800 mt-1">Ele poderá ser usado nas receitas sem baixar estoque e sem somar o preço de compra ao custo de cada peça.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-stone-700">
                  Tipo
                  <select value={durableKind} onChange={(e) => setDurableKind(e.target.value as 'mold' | 'tool' | 'equipment' | 'other')} className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900">
                    <option value="mold">Molde</option>
                    <option value="tool">Ferramenta</option>
                    <option value="equipment">Equipamento</option>
                    <option value="other">Outro item durável</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold text-stone-700">
                  Material do item
                  <input value={durableMaterial} onChange={(e) => setDurableMaterial(e.target.value)} placeholder="Ex: silicone, policarbonato..." className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                </label>
                <label className="text-[11px] font-bold text-stone-700">
                  Medidas
                  <input value={durableDimensions} onChange={(e) => setDurableDimensions(e.target.value)} placeholder="Ex: 12 × 8 × 5 cm" className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                </label>
                <label className="text-[11px] font-bold text-stone-700">
                  Quantidade de cavidades
                  <input type="number" min="1" step="1" value={durableCavities} onChange={(e) => setDurableCavities(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                </label>
              </div>
              {durableKind === 'mold' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[11px] font-bold text-stone-700 sm:col-span-2">
                    Formatos disponíveis neste molde
                    <textarea value={moldShapesText} onChange={(e) => setMoldShapesText(e.target.value)} rows={3} placeholder={"Um formato por linha. Ex:\nCoelho sentado\nCoelho em pé\nCenoura"} className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900 resize-y" />
                    <span className="block text-[10px] text-purple-700 mt-1">Um único cadastro pode conter vários formatos. Na receita você escolhe qual deles está usando.</span>
                  </label>
                  <label className="text-[11px] font-bold text-stone-700">
                    Capacidade aproximada (g)
                    <input type="number" min="0" step="0.1" value={durableCapacityGrams} onChange={(e) => setDurableCapacityGrams(e.target.value)} placeholder="Opcional" className="mt-1 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                  </label>
                </div>
              )}
            </div>
          )}

          {isMadeInAtelier && usageType !== 'durable' && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-purple-700" />
                  Receita do Material Feito no Ateliê
                </h4>
                <p className="text-[11px] text-purple-800 mt-1">Monte a fórmula do material. O custo será calculado por unidade de rendimento.</p>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-purple-200 bg-white p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVirtualRecipe}
                  onChange={(e) => {
                    setIsVirtualRecipe(e.target.checked);
                    if (!e.target.checked) setRecipeInputMode('material');
                  }}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-bold text-stone-900">Receita Virtual — produzir somente na hora</span>
                </div>
              </label>

              {isVirtualRecipe && (
                <div className="flex items-center gap-2 bg-purple-100/60 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setRecipeInputMode('material')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${recipeInputMode === 'material' ? 'bg-white text-stone-900 shadow-xs' : 'text-purple-800 hover:bg-white/60'}`}
                  >
                    Material específico
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipeInputMode('category')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${recipeInputMode === 'category' ? 'bg-white text-stone-900 shadow-xs' : 'text-purple-800 hover:bg-white/60'}`}
                  >
                    Categoria variável
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  {recipeInputMode === 'category' && isVirtualRecipe ? (
                    <>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">Categoria do Ingrediente</label>
                      <select
                        value={recipeCategory}
                        onChange={(e) => setRecipeCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900"
                      >
                        <option value="">Selecione a categoria...</option>
                        {materialCategoriesForRecipe.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-purple-700 mt-1">
                        Na produção da peça você escolherá qual material desta categoria será usado.
                      </p>
                    </>
                  ) : (
                    <>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">Material / Ingrediente</label>
                      <SearchableMaterialCombobox
                        materials={materials.filter(m => m.id !== material?.id && !m.isVirtualRecipe)}
                        selectedMaterialId={recipeTargetId}
                        onSelectMaterial={(mat) => setRecipeTargetId(mat ? mat.id : '')}
                        placeholder="Digite para buscar ingrediente..."
                        id="select-material-recipe-ingredient"
                      />
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Quantidade</label>
                  <input type="number" min="0.0001" step="any" value={recipeQuantity} onChange={(e) => setRecipeQuantity(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                </div>
              </div>

              <button type="button" onClick={() => {
                const qty = parseFloat(recipeQuantity);
                if (!qty || qty <= 0) { alert('Informe uma quantidade válida.'); return; }

                if (recipeInputMode === 'category' && isVirtualRecipe) {
                  if (!recipeCategory) { alert('Selecione uma categoria.'); return; }
                  const options = materials.filter(m => !m.isVirtualRecipe && m.category === recipeCategory);
                  if (options.length === 0) { alert('Essa categoria ainda não possui materiais cadastrados.'); return; }
                  const categoryUnits = Array.from(new Set(options.map(m => m.unit)));
                  if (categoryUnits.length !== 1) {
                    alert('Os materiais dessa categoria usam unidades diferentes. Para usar a categoria na receita, cadastre todos com a mesma unidade de medida.');
                    return;
                  }
                  const avgUnitCost = options.reduce((sum, m) => sum + m.unitCost, 0) / options.length;
                  setRecipeItems(prev => [...prev, {
                    id: 'mri_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    type: 'material',
                    targetId: 'category:' + recipeCategory,
                    name: 'Categoria: ' + recipeCategory,
                    quantity: qty,
                    unit: UNIT_SHORT[categoryUnits[0]],
                    unitCost: avgUnitCost,
                    totalCost: avgUnitCost * qty,
                    selectionMode: 'category',
                    targetCategory: recipeCategory,
                  }]);
                  setRecipeCategory('');
                } else {
                  const target = materials.find(m => m.id === recipeTargetId);
                  if (!target) { alert('Selecione um ingrediente.'); return; }
                  const durable = target.usageType === 'durable';
                  setRecipeItems(prev => [...prev, {
                    id: 'mri_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    type: 'material',
                    targetId: target.id,
                    name: target.name,
                    quantity: qty,
                    unit: UNIT_SHORT[target.unit],
                    unitCost: durable ? 0 : target.unitCost,
                    totalCost: durable ? 0 : target.unitCost * qty,
                    selectionMode: 'fixed',
                  }]);
                  setRecipeTargetId('');
                }
                setRecipeQuantity('1');
              }} className="w-full py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5 text-amber-400" />Adicionar ingrediente
              </button>

              <div className="space-y-2">
                {normalizedRecipeItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 bg-white border border-purple-100 rounded-lg p-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-900 truncate flex items-center gap-1.5">
                        {item.name}
                        {item.selectionMode === 'category' && (
                          <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">escolher na produção</span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unitCost)}
                        {item.selectionMode === 'category' ? ' (custo médio estimado)' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-stone-900">{formatCurrency(item.totalCost)}</span>
                      <button type="button" onClick={() => setRecipeItems(prev => prev.filter(i => i.id !== item.id))} className="p-1 text-stone-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {recipeItems.length === 0 && <div className="text-[11px] text-stone-500 bg-white border border-dashed border-purple-200 rounded-lg p-3 text-center">Nenhum ingrediente adicionado.</div>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-stone-700 block">Rendimento automático</span>
                    <span className="text-[10px] text-stone-500">Soma dos ingredientes da receita</span>
                  </div>
                  <span className="font-extrabold text-stone-900">
                    {formatNumber(automaticRecipeYield)} {UNIT_SHORT[inferredRecipeUnit]}
                  </span>
                </div>
                <div className="bg-white border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-[11px] text-stone-600">{recipeItems.some(i => i.selectionMode === 'category') ? 'Custo estimado por unidade' : 'Custo por unidade'}</span>
                  <span className="font-extrabold text-stone-900">{formatCurrency(recipeUnitCost)} / {UNIT_SHORT[inferredRecipeUnit]}</span>
                </div>
              </div>

              {hasMixedRecipeUnits && (
                <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  Os ingredientes precisam usar a mesma unidade para calcular o rendimento automaticamente.
                </div>
              )}
            </div>
          )}

          {/* Supplier: only for purchased materials */}
          {!isMadeInAtelier && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Fornecedor
              </label>
              <select
                id="select-material-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900"
              >
                <option value="">Selecione um fornecedor (opcional)</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pricing & Unit Calculation Box: only for purchased materials */}
          {!isMadeInAtelier && (
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-700" />
              {usageType === 'durable' ? 'Preço de Compra do Item Durável' : 'Preço de Compra & Cálculo do Custo Unitário'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* How bought: quantity */}
              <div>
                <label className="block text-[11px] font-medium text-stone-700 mb-1">
                  {usageType === 'durable' ? 'Quantidade Adquirida' : 'Quantidade do Pacote / Lote'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                  placeholder="Ex: 50"
                />
              </div>

              {/* Package unit */}
              <div>
                <label className="block text-[11px] font-medium text-stone-700 mb-1">
                  Unidade da Compra
                </label>
                <select
                  value={packageUnit}
                  onChange={(e) => setPackageUnit(e.target.value as UnitOfMeasure)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                >
                  <option value="m">Metros (m)</option>
                  <option value="cm">Centímetros (cm)</option>
                  <option value="un">Unidades (un)</option>
                  <option value="folha">Folhas</option>
                  <option value="rolo">Rolos</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="g">Gramas (g)</option>
                  <option value="l">Litros (l)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="pct">Pacote / Kit</option>
                </select>
              </div>

              {/* Package price */}
              <div>
                <label className="block text-[11px] font-medium text-stone-700 mb-1">
                  {usageType === 'durable' ? 'Valor Pago no Total (R$)' : 'Valor Pago no Pacote (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 font-semibold"
                  placeholder="Ex: 38,00"
                />
              </div>
            </div>


            {/* Base unit for recipes + calculated unit cost */}
            {usageType !== 'durable' ? (
            <div className="pt-2 border-t border-amber-200/60">
              <label className="block text-[11px] font-bold text-stone-800 mb-1.5">
                Unidade que você usa nas Receitas das Peças:
              </label>

              <div className="flex items-center gap-3">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
                  className="min-w-0 flex-1 px-3 py-1.5 text-sm font-semibold bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                >
                  <option value="cm">Centímetros (cm)</option>
                  <option value="m">Metros (m)</option>
                  <option value="un">Unidades (un)</option>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="folha">Folhas</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="l">Litros (l)</option>
                </select>

                <span className="shrink-0 whitespace-nowrap text-base font-extrabold text-stone-900">
                  {formatCurrency(calculatedUnitCostPreview)}
                  <span className="text-xs font-normal text-stone-500 ml-1">
                    por {UNIT_SHORT[unit]}
                  </span>
                </span>
              </div>
            </div>
            ) : (
              <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between gap-3">
                <span className="text-[11px] text-stone-600">Valor por unidade durável</span>
                <span className="text-base font-extrabold text-stone-900">{formatCurrency(parsedPrice / Math.max(1, parsedPkgQty))}</span>
              </div>
            )}
          </div>
          )}

          {/* Stock Levels */}
          {usageType === 'durable' ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Quantidade que você possui</label>
              <input type="number" step="1" min="0" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-stone-900" />
              <p className="text-[10px] text-purple-700 mt-1.5">Itens duráveis não usam estoque mínimo e não geram alerta de reposição.</p>
            </div>
          ) : !(isMadeInAtelier && isVirtualRecipe) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Estoque Atual ({UNIT_SHORT[unit]})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Estoque Mínimo para Alerta ({UNIT_SHORT[unit]})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-800">
              <strong>Sem controle de estoque próprio.</strong> Esta receita será calculada proporcionalmente e seus ingredientes serão descontados apenas quando você produzir a peça final.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Largura de 1,50m; lavar antes de cortar; cor off-white..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-save-material"
              type="submit"
              className="px-5 py-2 text-sm font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Material'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
