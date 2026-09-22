import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Tag, 
  Layers, 
  Clock, 
  DollarSign, 
  Edit2, 
  Trash2, 
  Copy, 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  X, 
  Check, 
  Info, 
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Percent,
  Hammer,
  Package,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { Product, Material, RecipeItem, RecipeItemType } from '../types';
import { 
  formatCurrency, 
  formatPercent, 
  formatNumber, 
  UNIT_SHORT,
  matchesSearchText
} from '../utils/formatters';
import { processImageFile } from '../utils/imageHelper';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';
import { SearchableProductCombobox } from './SearchableProductCombobox';

interface ProductsViewProps {
  products: Product[];
  materials: Material[];
  defaultHourlyRate: number;
  defaultFixedCostPercent: number;
  defaultProfitMargin: number;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onDuplicateProduct: (product: Product) => void;
  onQuickStockChange?: (id: string, delta: number) => void;
  onOpenProduction?: (product: Product) => void;
  filterLowStockInitial?: boolean;
  onOpenProductionHistory?: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  materials,
  defaultHourlyRate,
  defaultFixedCostPercent,
  defaultProfitMargin,
  onSaveProduct,
  onDeleteProduct,
  onDuplicateProduct,
  onQuickStockChange,
  onOpenProduction,
  filterLowStockInitial = false,
  onOpenProductionHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recipeScope, setRecipeScope] = useState<'catalog' | 'custom'>('catalog');
  const [typeFilter, setTypeFilter] = useState<'all' | 'final' | 'intermediate'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [selectedFragrance, setSelectedFragrance] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    filterLowStockInitial ? 'low_stock' : 'all'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingFichaProduct, setViewingFichaProduct] = useState<Product | null>(null);

  // Quick adjust inline state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('');

  const scopedProducts = useMemo(
    () => products.filter((p) => recipeScope === 'custom' ? !!p.isCustomRecipe : !p.isCustomRecipe),
    [products, recipeScope]
  );

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const minStock = p.minStock ?? 2;
      const currentStock = p.currentStock ?? 0;
      return !p.isCustomRecipe && minStock > 0 && currentStock <= minStock;
    }).length;
  }, [products]);

  // Categories (all registered for modals)
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.filter((p) => !p.isCustomRecipe).forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Dynamic categories based on current typeFilter ('all', 'final', 'intermediate')
  const visibleCategories = useMemo(() => {
    const set = new Set<string>();
    scopedProducts.forEach((p) => {
      const matchesType = 
        typeFilter === 'all' || 
        (typeFilter === 'intermediate' && p.isIntermediate) ||
        (typeFilter === 'final' && !p.isIntermediate);

      if (matchesType && p.category?.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [scopedProducts, typeFilter]);

  // Product families and fragrances let the same catalog be explored in two directions:
  // by base product (ex: Castiçal Lapidado) or by aroma (ex: Chá Branco).
  const productFamilies = useMemo(() => {
    const set = new Set<string>();
    scopedProducts.forEach((p) => {
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'intermediate' && p.isIntermediate) ||
        (typeFilter === 'final' && !p.isIntermediate);
      if (matchesType && p.productFamily?.trim()) set.add(p.productFamily.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [scopedProducts, typeFilter]);

  const fragranceOptions = useMemo(() => {
    const set = new Set<string>();
    scopedProducts.forEach((p) => {
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'intermediate' && p.isIntermediate) ||
        (typeFilter === 'final' && !p.isIntermediate);
      const matchesFamily = selectedFamily === 'all' || p.productFamily === selectedFamily;
      if (matchesType && matchesFamily && p.fragrance?.trim()) set.add(p.fragrance.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [scopedProducts, typeFilter, selectedFamily]);

  useEffect(() => {
    if (selectedFamily !== 'all' && !productFamilies.includes(selectedFamily)) {
      setSelectedFamily('all');
    }
  }, [selectedFamily, productFamilies]);

  useEffect(() => {
    if (selectedFragrance !== 'all' && !fragranceOptions.includes(selectedFragrance)) {
      setSelectedFragrance('all');
    }
  }, [selectedFragrance, fragranceOptions]);

  const selectedFamilyVariants = useMemo(() => {
    if (selectedFamily === 'all') return [];
    return scopedProducts
      .filter((p) => p.productFamily === selectedFamily)
      .sort((a, b) =>
        (a.fragrance || a.name).localeCompare(b.fragrance || b.name, 'pt-BR', { sensitivity: 'base' })
      );
  }, [scopedProducts, selectedFamily]);

  // Automatically reset category filter to 'all' if selected category is not in the current view
  useEffect(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'paused' && !visibleCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, visibleCategories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return scopedProducts
      .filter((p) => {
        const matchesSearch =
          matchesSearchText(p.name, searchTerm) ||
          matchesSearchText(p.category, searchTerm) ||
          (p.productFamily && matchesSearchText(p.productFamily, searchTerm)) ||
          (p.fragrance && matchesSearchText(p.fragrance, searchTerm)) ||
          (p.description && matchesSearchText(p.description, searchTerm));

        const matchesType = 
          typeFilter === 'all' || 
          (typeFilter === 'intermediate' && p.isIntermediate) ||
          (typeFilter === 'final' && !p.isIntermediate);

        const isCategoryValid = selectedCategory === 'all' || selectedCategory === 'paused' || visibleCategories.includes(selectedCategory);
        const matchesCategory = !isCategoryValid || selectedCategory === 'all' || (selectedCategory === 'paused' ? (p.minStock ?? 2) === 0 : p.category === selectedCategory);

        const matchesFamily = selectedFamily === 'all' || p.productFamily === selectedFamily;
        const matchesFragrance = selectedFragrance === 'all' || p.fragrance === selectedFragrance;

        const currentStock = p.currentStock ?? 0;
        const minStock = p.minStock !== undefined ? p.minStock : 2;
        const matchesStock =
          stockFilter === 'all' ||
          (stockFilter === 'in_stock' && currentStock > minStock) ||
          (stockFilter === 'low_stock' && minStock > 0 && currentStock <= minStock) ||
          (stockFilter === 'out_of_stock' && currentStock <= 0);

        return matchesSearch && matchesType && matchesCategory && matchesFamily && matchesFragrance && matchesStock;
      })
      .sort((a, b) => {
        const aPaused = (a.minStock ?? 2) === 0;
        const bPaused = (b.minStock ?? 2) === 0;

        // MinStock === 0 goes to the bottom of the list
        if (aPaused !== bPaused) {
          return aPaused ? 1 : -1;
        }

        // Alphabetical A to Z
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [scopedProducts, searchTerm, typeFilter, selectedCategory, selectedFamily, selectedFragrance, stockFilter, visibleCategories]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleConfirmAdjust = (id: string) => {
    const newStock = parseFloat(adjustDelta);
    const product = products.find((p) => p.id === id);

    if (!product || isNaN(newStock) || newStock < 0) {
      alert('Informe um valor de estoque válido, igual ou maior que zero.');
      return;
    }

    const currentStock = product.currentStock ?? 0;
    const delta = newStock - currentStock;
    if (delta !== 0 && onQuickStockChange) {
      onQuickStockChange(id, delta);
    }

    setAdjustingId(null);
    setAdjustDelta('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[21px] font-bold text-stone-900 tracking-tight">
            Produtos, Receitas & Precificação
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenProductionHistory}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 text-sm font-medium rounded-xl border border-stone-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Hammer className="w-4 h-4 text-amber-600" />
            <span>Histórico de Produção</span>
          </button>
        {recipeScope === 'catalog' && (
          <button
            id="btn-add-product"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Nova Peça ou Receita</span>
          </button>
        )}
        </div>
      </div>

      <div className="inline-flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 w-fit">
        <button
          type="button"
          onClick={() => {
            setRecipeScope('catalog');
            setSelectedCategory('all');
            setStockFilter('all');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            recipeScope === 'catalog'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Receitas do Catálogo
        </button>
        <button
          type="button"
          onClick={() => {
            setRecipeScope('custom');
            setTypeFilter('all');
            setSelectedCategory('all');
            setStockFilter('all');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            recipeScope === 'custom'
              ? 'bg-white text-purple-800 shadow-xs'
              : 'text-stone-500 hover:text-purple-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Personalizadas ({products.filter((p) => p.isCustomRecipe).length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              id="search-products"
              type="text"
              placeholder="Buscar por nome da peça, receita ou categoria..."
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
          <div className="flex items-center p-1 bg-stone-100 rounded-lg shrink-0 text-xs font-medium text-stone-600">
            <button
              id="filter-type-all"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                typeFilter === 'all' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'hover:text-stone-900'
              }`}
            >
              Todos ({scopedProducts.length})
            </button>
            <button
              id="filter-type-final"
              onClick={() => setTypeFilter('final')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                typeFilter === 'final' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'hover:text-stone-900'
              }`}
            >
              Produtos Finais
            </button>
            <button
              id="filter-type-intermediate"
              onClick={() => setTypeFilter('intermediate')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                typeFilter === 'intermediate' ? 'bg-white text-amber-900 shadow-xs font-semibold' : 'hover:text-stone-900'
              }`}
              title="Receitas que não aparecem em pedidos. Todas as receitas podem ser usadas como sub-produto em outras receitas."
            >
              <Layers className="w-3 h-3 text-amber-600" />
              <span>Receitas Internas</span>
            </button>
          </div>
        </div>

        {/* Stock Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-stone-500 font-medium flex items-center gap-1 shrink-0">
              <Package className="w-3.5 h-3.5 text-stone-400" />
              {recipeScope === 'custom' ? 'Estoque Personalizados:' : 'Estoque Pronta-Entrega:'}
            </span>
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                stockFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                stockFilter === 'in_stock'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Em Estoque
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                stockFilter === 'low_stock'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-amber-800 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Estoque Baixo</span>
              {lowStockCount > 0 && (
                <span className="bg-amber-200 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {lowStockCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                stockFilter === 'out_of_stock'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-rose-700 hover:bg-rose-50'
              }`}
            >
              Esgotados
            </button>
          </div>
        </div>

        {/* Category Pills */}
        {visibleCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-stone-100 no-scrollbar">
            <span className="text-xs font-medium text-stone-500 shrink-0">Categorias:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Todas ({scopedProducts.filter((p) => typeFilter === 'all' || (typeFilter === 'intermediate' && p.isIntermediate) || (typeFilter === 'final' && !p.isIntermediate)).length})
            </button>
            <button
              onClick={() => setSelectedCategory('paused')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'paused'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Pausados ({scopedProducts.filter((p) => !p.isCustomRecipe && (typeFilter === 'all' || (typeFilter === 'intermediate' && p.isIntermediate) || (typeFilter === 'final' && !p.isIntermediate)) && (p.minStock ?? 2) === 0).length})
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat} ({scopedProducts.filter((p) => (typeFilter === 'all' || (typeFilter === 'intermediate' && p.isIntermediate) || (typeFilter === 'final' && !p.isIntermediate)) && p.category === cat).length})
              </button>
            ))}
          </div>
        )}
        {recipeScope === 'catalog' && (productFamilies.length > 0 || fragranceOptions.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Produto-base
              </label>
              <select
                value={selectedFamily}
                onChange={(e) => {
                  setSelectedFamily(e.target.value);
                  setSelectedFragrance('all');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="all">Todos os produtos-base</option>
                {productFamilies.map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Aroma
              </label>
              <select
                value={selectedFragrance}
                onChange={(e) => setSelectedFragrance(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="all">Todos os aromas</option>
                {fragranceOptions.map((fragrance) => (
                  <option key={fragrance} value={fragrance}>{fragrance}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {selectedFamily !== 'all' && selectedFamilyVariants.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Estoque por aroma
              </p>
              <h3 className="text-sm font-bold text-stone-900">{selectedFamily}</h3>
            </div>
            <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">
              Total: {selectedFamilyVariants.reduce((sum, item) => sum + (item.currentStock ?? 0), 0)} un
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedFamilyVariants.map((variant) => {
              const stock = variant.currentStock ?? 0;
              const min = variant.minStock ?? 2;
              const isLow = min > 0 && stock <= min;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedFragrance(variant.fragrance || 'all')}
                  className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                    selectedFragrance === variant.fragrance
                      ? 'border-amber-400 bg-amber-50'
                      : isLow
                        ? 'border-rose-200 bg-rose-50/60'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                  }`}
                >
                  <span className="block text-xs font-semibold text-stone-800">
                    {variant.fragrance || variant.name}
                  </span>
                  <span className={`text-[11px] font-bold ${isLow ? 'text-rose-700' : 'text-stone-600'}`}>
                    {stock} un
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <Tag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            {recipeScope === 'custom' ? 'Nenhuma receita personalizada ainda' : 'Nenhum produto cadastrado'}
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            {recipeScope === 'custom'
              ? 'As receitas aparecem aqui automaticamente quando você usa “Produzir +1” em um item personalizado de pedido.'
              : 'Crie fichas técnicas com seus materiais e componentes. O sistema calcula os custos e ajuda no controle de produção.'}
          </p>
          {recipeScope === 'catalog' && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Criar Primeira Receita</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredProducts.map((p) => {
            const materialItemsCount = p.items.filter((it) => it.type === 'material').length;
            const subProductItemsCount = p.items.filter((it) => it.type === 'product').length;
            const hasSubProducts = subProductItemsCount > 0;

            const isPaused = !p.isCustomRecipe && (p.minStock ?? 2) === 0;

            return (
              <div
                key={p.id}
                id={`product-card-${p.id}`}
                className={`rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${
                  isPaused
                    ? 'opacity-75 bg-stone-50/70 border-stone-200'
                    : 'bg-white border-stone-200'
                }`}
              >
                <div>
                  {/* Top Product Header */}
                  <div className="p-5 pb-4 flex items-start gap-4">
                    {/* Photo or Icon */}
                    <div className="w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-stone-400 flex flex-col items-center">
                          <ImageIcon className="w-7 h-7 stroke-1" />
                          <span className="text-[10px] mt-0.5 text-stone-400 font-medium">Sem foto</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                          {p.category}
                        </span>

                        {p.productFamily && (
                          <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {p.productFamily}
                          </span>
                        )}

                        {p.fragrance && (
                          <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {p.fragrance}
                          </span>
                        )}

                        {p.isCustomRecipe && (
                          <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Personalizada
                          </span>
                        )}

                        {isPaused && (
                          <span className="text-[11px] font-medium text-stone-600 bg-stone-200/90 border border-stone-300 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0" title="Estoque mínimo igual a 0 (Inativo/Pausado)">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Inativo/Pausado
                          </span>
                        )}

                        {p.isIntermediate ? (
                          <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1" title="Disponível como sub-produto, mas não aparece em pedidos">
                            <Layers className="w-3 h-3 text-amber-700" />
                            Receita Interna
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Produto Final
                          </span>
                        )}

                        {p.batchYield > 1 && (
                          <span className="text-[11px] text-stone-500 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                            Rende {p.batchYield} un
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-stone-900 leading-snug">
                        {p.name}
                      </h3>
                      {p.isCustomRecipe && p.sourceCustomerName && (
                        <p className="text-[11px] text-purple-700 mt-0.5">
                          Criada para {p.sourceCustomerName}
                        </p>
                      )}

                      {p.description && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                          {p.description}
                        </p>
                      )}

                      {p.notes && (
                        <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200/80 rounded-md px-2 py-1 mt-1.5 line-clamp-2 italic" title={p.notes}>
                          <span className="font-semibold not-italic text-stone-700">Obs: </span>
                          {p.notes}
                        </p>
                      )}

                      {/* Composition summary badge */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-stone-400" />
                          {materialItemsCount} {materialItemsCount === 1 ? 'material' : 'materiais'}
                        </span>
                        {hasSubProducts && (
                          <span className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            {subProductItemsCount} {subProductItemsCount === 1 ? 'sub-produto' : 'sub-produtos'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          {p.productionTimeMinutes} min
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className="px-5 py-3.5 bg-stone-50 border-y border-stone-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      {/* Total Cost */}
                      <div className="text-left sm:text-center border-r border-stone-200/60 sm:border-r">
                        <span className="text-[11px] uppercase tracking-wider text-stone-500 block">
                          Custo Total
                        </span>
                        <span className="text-sm font-bold text-stone-900">
                          {formatCurrency(p.unitCostFromBatch > 0 ? p.unitCostFromBatch : p.totalCost)}
                        </span>
                        <span className="text-[10px] text-stone-400 block">por peça</span>
                      </div>

                      {/* Suggested Price */}
                      <div className="text-left sm:text-center border-r border-stone-200/60 sm:border-r">
                        <span className="text-[11px] uppercase tracking-wider text-stone-500 block">
                          Sugerido
                        </span>
                        <span className="text-sm font-semibold text-stone-700">
                          {formatCurrency(p.suggestedPrice)}
                        </span>
                        <span className="text-[10px] text-stone-400 block">
                          margem {formatPercent(p.profitMarginPercent)}
                        </span>
                      </div>

                      {/* Actual Selling Price */}
                      <div className="text-left sm:text-center border-r border-stone-200/60 sm:border-r">
                        <span className="text-[11px] uppercase tracking-wider text-amber-800 block font-semibold">
                          Preço Venda
                        </span>
                        <span className="text-base font-extrabold text-stone-900">
                          {formatCurrency(p.actualPrice)}
                        </span>
                        <span className="text-[10px] text-stone-500 block">preço praticado</span>
                      </div>

                      {/* Net Profit & Margin */}
                      <div className="text-left sm:text-center">
                        <span className="text-[11px] uppercase tracking-wider text-emerald-800 block font-semibold">
                          Lucro Líquido
                        </span>
                        <span className="text-sm font-bold text-emerald-600">
                          +{formatCurrency(p.netProfit)}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 block">
                          {formatPercent(p.calculatedMarginPercent)} margem
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Product Inventory Control & Stock Level */}
                  {(() => {
                    const currentStock = p.currentStock ?? 0;
                    const minStock = p.minStock !== undefined ? p.minStock : 2;
                    const standardStock = p.standardStock !== undefined && p.standardStock > 0 ? p.standardStock : Math.max(minStock * 2, 10);
                    const isPaused = minStock === 0;
                    const isOutOfStock = currentStock <= 0;
                    const isBelowMin = currentStock < minStock;
                    const isBetweenMinAndStandard = currentStock >= minStock && currentStock < standardStock;
                    const isStandardOrAbove = currentStock >= standardStock;
                    const stockPct = standardStock > 0 ? Math.min(100, (currentStock / standardStock) * 100) : 100;

                    return (
                      <div className="px-5 py-3.5 bg-stone-50/70 border-t border-stone-200/70 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-stone-500" />
                            <span className="text-xs font-bold text-stone-800">
                              Estoque Pronta-Entrega:
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isPaused ? (
                              <span className="text-[11px] font-medium text-stone-600 bg-stone-200/90 border border-stone-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                Inativo/Pausado (Alerta: 0 un)
                              </span>
                            ) : isOutOfStock ? (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Esgotado (0 un)
                              </span>
                            ) : isBelowMin ? (
                              <span className="text-[11px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                {currentStock} un (Abaixo do Mínimo)
                              </span>
                            ) : isStandardOrAbove ? (
                              <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                                {currentStock} un (Meta Atingida)
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {currentStock} un em estoque
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Alert */}
                        <div className="space-y-1">
                          <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isPaused
                                  ? 'bg-stone-300'
                                  : isBelowMin
                                  ? 'bg-rose-500'
                                  : isStandardOrAbove
                                  ? 'bg-blue-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${isPaused ? 25 : isOutOfStock ? 0 : Math.min(100, Math.max(6, stockPct))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-stone-400">
                            <span>
                              {isPaused
                                ? 'Alerta de estoque pausado (Mín: 0 un)'
                                : `Mínimo: ${minStock} un | Meta: ${standardStock} un`}
                            </span>
                            <span>
                              Total em estoque: {formatCurrency(currentStock * p.actualPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Quick stock adjust & Produce button */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          {adjustingId === p.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="Novo estoque"
                                value={adjustDelta}
                                onChange={(e) => setAdjustDelta(e.target.value)}
                                className="w-24 text-xs px-2 py-1 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-900"
                                autoFocus
                              />
                              <button
                                onClick={() => handleConfirmAdjust(p.id)}
                                className="px-2 py-1 bg-stone-900 text-white rounded text-xs font-semibold hover:bg-stone-800"
                              >
                                Ok
                              </button>
                              <button
                                onClick={() => setAdjustingId(null)}
                                className="text-xs text-stone-500 hover:text-stone-700"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onQuickStockChange && onQuickStockChange(p.id, -1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-stone-200/70 hover:bg-stone-300 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                                title="Diminuir 1 unidade do estoque"
                              >
                                -1
                              </button>
                              <button
                                onClick={() => onQuickStockChange && onQuickStockChange(p.id, 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-stone-200/70 hover:bg-stone-300 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                                title="Aumentar 1 unidade no estoque"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => {
                                  setAdjustingId(p.id);
                                  setAdjustDelta(String(currentStock));
                                }}
                                className="text-[11px] text-stone-500 hover:text-amber-800 underline cursor-pointer ml-1"
                              >
                                Ajustar
                              </button>
                            </div>
                          )}

                          {/* Shortcut to produce this recipe */}
                          {onOpenProduction && (
                            <button
                              onClick={() => onOpenProduction(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300/80 transition-all cursor-pointer shadow-2xs"
                              title="Lançar produção para esta receita (baixa insumos e abastece estoque)"
                            >
                              <Hammer className="w-3.5 h-3.5 text-amber-700" />
                              <span>Produzir Lote</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 bg-white border-t border-stone-100 flex items-center justify-between">
                  <button
                    id={`btn-ficha-${p.id}`}
                    onClick={() => setViewingFichaProduct(p)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-800 hover:text-amber-800 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-stone-400" />
                    <span>Ver Ficha Técnica</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      id={`btn-duplicate-product-${p.id}`}
                      onClick={() => onDuplicateProduct(p)}
                      className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Duplicar receita"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      id={`btn-edit-product-${p.id}`}
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Editar produto e receita"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      id={`btn-delete-product-${p.id}`}
                      onClick={() => {
                        // Check if any other product uses this one as ingredient!
                        const dependents = products.filter((other) =>
                          other.id !== p.id && other.items.some((it) => it.type === 'product' && it.targetId === p.id)
                        );
                        if (dependents.length > 0) {
                          alert(`Não é possível excluir este produto pois ele é usado como insumo em: ${dependents.map((d) => d.name).join(', ')}.`);
                          return;
                        }
                        if (confirm(`Excluir a receita de "${p.name}"?`)) {
                          onDeleteProduct(p.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <ProductRecipeModal
          isOpen={isModalOpen}
          product={editingProduct}
          allProducts={products}
          allMaterials={materials}
          existingCategories={categories}
          defaultHourlyRate={defaultHourlyRate}
          defaultFixedCostPercent={defaultFixedCostPercent}
          defaultProfitMargin={defaultProfitMargin}
          onClose={() => setIsModalOpen(false)}
          onSave={(saved) => {
            onSaveProduct(saved);
            setIsModalOpen(false);
          }}
        />
      )}

      {/* Ficha Técnica Modal */}
      {viewingFichaProduct && (
        <FichaTecnicaModal
          product={viewingFichaProduct}
          onClose={() => setViewingFichaProduct(null)}
          onEdit={() => {
            setEditingProduct(viewingFichaProduct);
            setViewingFichaProduct(null);
            setIsModalOpen(true);
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// Product Recipe Builder Modal
// ==========================================

interface ProductRecipeModalProps {
  isOpen: boolean;
  product: Product | null;
  allProducts: Product[];
  allMaterials: Material[];
  existingCategories?: string[];
  defaultHourlyRate: number;
  defaultFixedCostPercent: number;
  defaultProfitMargin: number;
  onClose: () => void;
  onSave: (p: Product) => void;
}

const ProductRecipeModal: React.FC<ProductRecipeModalProps> = ({
  product,
  allProducts,
  allMaterials,
  existingCategories = [],
  defaultHourlyRate,
  defaultFixedCostPercent,
  defaultProfitMargin,
  onClose,
  onSave,
}) => {
  const isEditing = !!product;

  const [name, setName] = useState(product?.name || '');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Category options list from existing products or passed categories
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    existingCategories.forEach((c) => {
      if (c?.trim()) set.add(c.trim());
    });
    allProducts.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    if (product?.category?.trim()) {
      set.add(product.category.trim());
    }
    if (set.size === 0) {
      ['Acessórios & Bolsas', 'Decoração & Casa', 'Bebê & Infantil', 'Papelaria & Cartonagem'].forEach((c) => set.add(c));
    }
    return Array.from(set).sort();
  }, [existingCategories, allProducts, product]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(categoryOptions);
    localCategories.forEach((c) => {
      if (c?.trim()) set.add(c.trim());
    });
    return Array.from(set).sort();
  }, [categoryOptions, localCategories]);

  const [category, setCategory] = useState<string>(() => {
    if (product?.category) return product.category;
    if (existingCategories.length > 0) return existingCategories[0];
    return 'Acessórios & Bolsas';
  });

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      setIsCustomCategory(false);
      return;
    }
    const existing = availableCategories.find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setCategory(existing);
    } else {
      setLocalCategories((prev) => [...prev, trimmed]);
      setCategory(trimmed);
    }
    setIsCustomCategory(false);
    setNewCategoryInput('');
  };

  const [productFamily, setProductFamily] = useState(product?.productFamily || '');
  const [fragrance, setFragrance] = useState(product?.fragrance || '');

  const familySuggestions = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => {
      if (p.productFamily?.trim()) set.add(p.productFamily.trim());
    });
    if (product?.productFamily?.trim()) set.add(product.productFamily.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [allProducts, product]);

  const fragranceSuggestions = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => {
      if (p.fragrance?.trim()) set.add(p.fragrance.trim());
    });
    allMaterials.forEach((m) => {
      const categoryName = (m.category || '').toLowerCase();
      if (
        categoryName.includes('essên') ||
        categoryName.includes('essen') ||
        categoryName.includes('aroma')
      ) {
        if (m.name?.trim()) set.add(m.name.trim());
      }
    });
    if (product?.fragrance?.trim()) set.add(product.fragrance.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [allProducts, allMaterials, product]);

  const [description, setDescription] = useState(product?.description || '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [isFinalProduct, setIsFinalProduct] = useState(product ? !product.isIntermediate : false);
  const [batchYield, setBatchYield] = useState<string>(product?.batchYield ? product.batchYield.toString() : '1');
  const [currentStock, setCurrentStock] = useState<string>(
    product?.currentStock != null ? product.currentStock.toString() : '0'
  );
  const [minStock, setMinStock] = useState<string>(
    product?.minStock != null ? product.minStock.toString() : '2'
  );
  const [standardStock, setStandardStock] = useState<string>(
    product?.standardStock != null ? product.standardStock.toString() : '10'
  );
  const [notes, setNotes] = useState(product?.notes || '');

  // Recipe items (BOM)
  const [items, setItems] = useState<RecipeItem[]>(
    Array.isArray(product?.items) ? product.items.filter(Boolean) : []
  );

  // Adding item form state
  const [itemTypeToAdd, setItemTypeToAdd] = useState<RecipeItemType>('material');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [recipeVariableSelections, setRecipeVariableSelections] = useState<Record<string, string>>({});

  const selectedMaterialToAdd = useMemo(
    () => itemTypeToAdd === 'material'
      ? allMaterials.find((m) => m.id === selectedTargetId) || null
      : null,
    [itemTypeToAdd, selectedTargetId, allMaterials]
  );

  const selectedVirtualRequirements = useMemo(() => {
    if (!selectedMaterialToAdd?.isVirtualRecipe || !selectedMaterialToAdd.recipeItems?.length) return [];
    return selectedMaterialToAdd.recipeItems
      .filter((item) => item.type === 'material' && item.selectionMode === 'category' && item.targetCategory)
      .map((item) => ({
        recipeItemId: item.id,
        category: item.targetCategory as string,
      }));
  }, [selectedMaterialToAdd]);

  // Labor & Overhead
  const [productionTimeMinutes, setProductionTimeMinutes] = useState<string>(
    product?.productionTimeMinutes != null ? product.productionTimeMinutes.toString() : '30'
  );
  const [hourlyRate, setHourlyRate] = useState<string>(
    product?.hourlyRate != null ? product.hourlyRate.toString() : defaultHourlyRate.toString()
  );
  const [fixedCostPercent, setFixedCostPercent] = useState<string>(
    product?.fixedCostPercent != null ? product.fixedCostPercent.toString() : defaultFixedCostPercent.toString()
  );
  const [otherCosts, setOtherCosts] = useState<string>(
    product?.otherCosts != null ? product.otherCosts.toString() : '0'
  );

  // Pricing
  const [profitMarginPercent, setProfitMarginPercent] = useState<string>(
    product?.profitMarginPercent != null ? product.profitMarginPercent.toString() : defaultProfitMargin.toString()
  );
  const [actualPrice, setActualPrice] = useState<string>(
    product?.actualPrice != null ? product.actualPrice.toString() : ''
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate live totals
  const parsedMinutes = parseFloat(productionTimeMinutes) || 0;
  const parsedHourlyRate = parseFloat(hourlyRate) || 0;
  const parsedFixedPct = parseFloat(fixedCostPercent) || 0;
  const parsedOtherCosts = parseFloat(otherCosts) || 0;
  const parsedMargin = parseFloat(profitMarginPercent) || 0;
  const parsedYield = Math.max(1, parseFloat(batchYield) || 1);

  // Materials cost sum
  const materialsCost = items.reduce((acc, it) => acc + (it.totalCost || 0), 0);
  const laborCost = (parsedMinutes / 60) * parsedHourlyRate;
  const baseCost = materialsCost + laborCost;
  const fixedCost = baseCost * (parsedFixedPct / 100);
  const totalCost = baseCost + fixedCost + parsedOtherCosts;
  const unitCostFromBatch = totalCost / parsedYield;

  // Suggested price formula: Price = UnitCost / (1 - Margin%)
  const marginFraction = Math.min(Math.max(parsedMargin, 0), 95) / 100;
  const suggestedPrice = marginFraction < 1 ? unitCostFromBatch / (1 - marginFraction) : unitCostFromBatch * 2;

  // Actual price chosen or suggested
  const currentActualPrice = parseFloat(actualPrice) || suggestedPrice;
  const netProfit = currentActualPrice - unitCostFromBatch;
  const calculatedMarginPercent = currentActualPrice > 0 ? (netProfit / currentActualPrice) * 100 : 0;

  // Filter products available to be added as ingredients:
  // Exclude current product and products that already use this product (to avoid cyclic loops)
  const availableSubProducts = useMemo(() => {
    return allProducts.filter((p) => {
      if (product && p.id === product.id) return false;
      // If editing, make sure 'p' does not contain 'product.id' in its own recipe
      if (product && (p.items || []).some((it) => it.type === 'product' && it.targetId === product.id)) {
        return false;
      }
      return true;
    });
  }, [allProducts, product]);

  const handleAddItem = () => {
    if (!selectedTargetId) {
      alert('Selecione um material ou componente da lista.');
      return;
    }
    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }

    if (itemTypeToAdd === 'material') {
      const mat = allMaterials.find((m) => m.id === selectedTargetId);
      if (!mat) return;

      let effectiveUnitCost = mat.unitCost;
      let categorySelections: Record<string, string> | undefined;

      if (mat.isVirtualRecipe && mat.recipeItems?.length) {
        const selections: Record<string, string> = {};

        for (const recipeItem of mat.recipeItems) {
          if (recipeItem.type === 'material' && recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
            const chosenId = recipeVariableSelections[recipeItem.id];
            const chosen = allMaterials.find(
              (m) => m.id === chosenId && !m.isVirtualRecipe && m.category === recipeItem.targetCategory
            );

            if (!chosen) {
              alert(`Escolha um material da categoria ${recipeItem.targetCategory} para esta receita.`);
              return;
            }

            selections[recipeItem.id] = chosen.id;
          }
        }

        const recipeTotalCost = mat.recipeItems.reduce((sum, recipeItem) => {
          if (recipeItem.type !== 'material') {
            return sum + (recipeItem.unitCost || 0) * recipeItem.quantity;
          }

          if (recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
            const chosen = allMaterials.find((m) => m.id === selections[recipeItem.id]);
            return sum + (chosen?.unitCost || recipeItem.unitCost || 0) * recipeItem.quantity;
          }

          const fixedMaterial = allMaterials.find((m) => m.id === recipeItem.targetId);
          return sum + (fixedMaterial?.unitCost || recipeItem.unitCost || 0) * recipeItem.quantity;
        }, 0);

        effectiveUnitCost = recipeTotalCost / Math.max(0.0001, mat.batchYield || 1);
        categorySelections = selections;
      }

      const total = effectiveUnitCost * qty;
      const newItem: RecipeItem = {
        id: `ri_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'material',
        targetId: mat.id,
        name: mat.name,
        quantity: qty,
        unit: UNIT_SHORT[mat.unit],
        unitCost: effectiveUnitCost,
        totalCost: total,
        categorySelections,
      };
      setItems([...items, newItem]);
    } else {
      // Sub-product
      const sub = allProducts.find((p) => p.id === selectedTargetId);
      if (!sub) return;
      const unitCost = sub.unitCostFromBatch > 0 ? sub.unitCostFromBatch : sub.totalCost;
      const total = unitCost * qty;
      const newItem: RecipeItem = {
        id: `ri_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'product',
        targetId: sub.id,
        name: sub.name,
        quantity: qty,
        unit: 'un',
        unitCost: unitCost,
        totalCost: total,
      };
      setItems([...items, newItem]);
    }

    // Reset picker
    setSelectedTargetId('');
    setItemQuantity('1');
    setRecipeVariableSelections({});
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((it) => it.id !== itemId));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file);
      setImageUrl(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar a imagem.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome da peça ou produto.');
      return;
    }
    if (items.length === 0) {
      if (!confirm('Esta receita não contém nenhum material ou componente adicionado. Deseja continuar mesmo assim?')) {
        return;
      }
    }

    const finalActualPrice = parseFloat(actualPrice) > 0 ? parseFloat(actualPrice) : suggestedPrice;
    const parsedCurrentStock = parseFloat(currentStock) || 0;
    const parsedMinStock = parseFloat(minStock) || 0;
    const parsedStandardStock = parseFloat(standardStock) > 0 ? parseFloat(standardStock) : Math.max(parsedMinStock * 2, 10);

    let finalCategory = category;
    if (isCustomCategory && newCategoryInput.trim()) {
      const trimmed = newCategoryInput.trim();
      const existingMatch = availableCategories.find(
        (c) => c.toLowerCase() === trimmed.toLowerCase()
      );
      finalCategory = existingMatch || trimmed;
    } else if (!finalCategory && availableCategories.length > 0) {
      finalCategory = availableCategories[0];
    }

    const savedProduct: Product = {
      id: product?.id || `prod_${Date.now()}`,
      name: name.trim(),
      category: (finalCategory || 'Acessórios & Bolsas').trim(),
      productFamily: productFamily.trim() || undefined,
      fragrance: fragrance.trim() || undefined,
      description: description.trim() || undefined,
      imageUrl: imageUrl || undefined,
      isIntermediate: !isFinalProduct,
      items,
      materialsCost,
      productionTimeMinutes: parsedMinutes,
      hourlyRate: parsedHourlyRate,
      laborCost,
      fixedCostPercent: parsedFixedPct,
      fixedCost,
      otherCosts: parsedOtherCosts,
      totalCost,
      batchYield: parsedYield,
      unitCostFromBatch,
      profitMarginPercent: parsedMargin,
      suggestedPrice,
      actualPrice: finalActualPrice,
      netProfit: finalActualPrice - unitCostFromBatch,
      calculatedMarginPercent: finalActualPrice > 0 ? ((finalActualPrice - unitCostFromBatch) / finalActualPrice) * 100 : 0,
      currentStock: parsedCurrentStock,
      minStock: parsedMinStock,
      standardStock: parsedStandardStock,
      notes: notes.trim() || undefined,
      createdAt: product?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSave(savedProduct);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                {isEditing ? `Editar Receita: ${product?.name}` : 'Cadastrar Peça & Montar Receita'}
              </h3>
              <p className="text-xs text-stone-500">
                Adicione materiais do estoque ou sub-produtos (etiquetas, tags) e defina sua margem.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* 1. Identification & Photo */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Photo Box */}
            <div className="shrink-0 w-full sm:w-36 flex flex-col items-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-500 bg-stone-50 cursor-pointer overflow-hidden relative flex flex-col items-center justify-center group transition-all"
                title="Clique para adicionar foto do produto"
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                      Trocar foto
                    </div>
                  </>
                ) : (
                  <div className="text-center p-2 text-stone-400 group-hover:text-amber-600">
                    <Upload className="w-6 h-6 mx-auto mb-1 stroke-1" />
                    <span className="text-[11px] font-medium block">Foto da Peça</span>
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
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Product Meta */}
            <div className="flex-1 space-y-3.5 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Nome da Peça / Produto *
                  </label>
                  <input
                    id="input-product-name"
                    type="text"
                    required
                    placeholder="Ex: Necessaire Floral com Zíper Metálico"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  {!isCustomCategory ? (
                    <div className="flex gap-2">
                      <select
                        id="select-product-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900 cursor-pointer"
                      >
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        id="btn-new-product-category"
                        onClick={() => {
                          setIsCustomCategory(true);
                          setNewCategoryInput('');
                        }}
                        className="px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
                      >
                        + Nova Categoria
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="input-new-product-category"
                        placeholder="Nome da nova categoria..."
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomCategory();
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-900"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        className="px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(false);
                          setNewCategoryInput('');
                        }}
                        className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rendimento da Receita (Unidades)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={batchYield}
                    onChange={(e) => setBatchYield(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    title="Se esta receita produz 1 peça única, deixe 1. Se você corta e produz um lote de 50 etiquetas por receita, coloque 50."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Produto-base / Família
                  </label>
                  <input
                    type="text"
                    list="product-family-suggestions"
                    value={productFamily}
                    onChange={(e) => setProductFamily(e.target.value)}
                    placeholder="Ex: Castiçal Lapidado"
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                  />
                  <datalist id="product-family-suggestions">
                    {familySuggestions.map((family) => <option key={family} value={family} />)}
                  </datalist>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Agrupa receitas que são o mesmo produto com aromas diferentes.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Aroma / Variação
                  </label>
                  <input
                    type="text"
                    list="product-fragrance-suggestions"
                    value={fragrance}
                    onChange={(e) => setFragrance(e.target.value)}
                    placeholder="Ex: Chá Branco"
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                  />
                  <datalist id="product-fragrance-suggestions">
                    {fragranceSuggestions.map((item) => <option key={item} value={item} />)}
                  </datalist>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Cada aroma continua com receita e estoque próprios.
                  </p>
                </div>
              </div>

              {/* Todas as receitas podem ser usadas como sub-produto; este toggle controla apenas a venda */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
                <input
                  id="chk-is-final-product"
                  type="checkbox"
                  checked={isFinalProduct}
                  onChange={(e) => setIsFinalProduct(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer"
                />
                <div>
                  <label htmlFor="chk-is-final-product" className="text-xs font-bold text-emerald-950 cursor-pointer flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                    Produto Final
                  </label>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Marque apenas quando esta receita também for um produto vendido ao cliente. Todas as receitas ficam disponíveis automaticamente para uso como sub-produto em outras receitas.
                  </p>
                </div>
              </div>

              {/* Stock Management Fields */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-stone-500" />
                  <span>Controle de Estoque & Pronta-Entrega</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Estoque Atual (Unidades)
                    </label>
                    <input
                      id="input-product-stock"
                      type="number"
                      step="1"
                      min="0"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Peças disponíveis para entrega.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Estoque Mínimo Recomendado
                    </label>
                    <input
                      id="input-product-min-stock"
                      type="number"
                      step="1"
                      min="0"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                      placeholder="2"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Alerta de reposição / estoque baixo.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Estoque Padrão
                    </label>
                    <input
                      id="input-product-standard-stock"
                      type="number"
                      step="1"
                      min="1"
                      value={standardStock}
                      onChange={(e) => setStandardStock(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                      placeholder="10"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Meta ideal de pronta-entrega (100%).
                    </span>
                  </div>
                </div>

                {/* Notas / Observações */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Observações / Notas da Receita (opcional)
                  </label>
                  <textarea
                    id="input-product-notes"
                    rows={2}
                    placeholder="Ex: Instruções de confecção, ordem de montagem dos componentes, temperatura ou cuidados especiais..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. RECEITA / COMPOSIÇÃO (BOM - BILL OF MATERIALS) */}
          <div className="bg-stone-50/90 border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-600" />
                  Composição da Receita (Insumos & Componentes)
                </h4>
                <p className="text-xs text-stone-500">
                  Adicione tecidos e aviamentos do estoque OU componentes pré-cadastrados (como etiquetas e tags).
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-stone-500 block">Total em Materiais:</span>
                <span className="text-base font-bold text-stone-900">
                  {formatCurrency(materialsCost)}
                </span>
              </div>
            </div>

            {/* Add Item Bar */}
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-stone-700">Tipo de Insumo:</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    checked={itemTypeToAdd === 'material'}
                    onChange={() => {
                      setItemTypeToAdd('material');
                      setSelectedTargetId('');
                    }}
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  <span>Material do Estoque (Tecido, Linha, Zíper...)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs text-amber-900 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    checked={itemTypeToAdd === 'product'}
                    onChange={() => {
                      setItemTypeToAdd('product');
                      setSelectedTargetId('');
                      setRecipeVariableSelections({});
                    }}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-600" />
                    Sub-produto Cadastrado (Etiqueta, Tag...)
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      {itemTypeToAdd === 'material' ? 'Material do Estoque' : 'Sub-produto / Componente'}
                    </label>
                    {itemTypeToAdd === 'material' ? (
                      <SearchableMaterialCombobox
                        materials={allMaterials}
                        selectedMaterialId={selectedTargetId}
                        onSelectMaterial={(mat) => {
                          setSelectedTargetId(mat ? mat.id : '');
                          setRecipeVariableSelections({});
                        }}
                        placeholder="Digite para buscar material (ex: cera coco, essência, pavio)..."
                        id="select-recipe-material-search"
                      />
                    ) : (
                      <SearchableProductCombobox
                        products={availableSubProducts}
                        selectedProductId={selectedTargetId}
                        onSelectProduct={(prod) => setSelectedTargetId(prod ? prod.id : '')}
                        placeholder="Digite para buscar sub-produto (ex: etiqueta, tag)..."
                        id="select-recipe-subproduct-search"
                        filterOnlyFinalForSale={false}
                      />
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      Quantidade Usada
                    </label>
                    <input
                      id="input-recipe-qty"
                      type="number"
                      step="any"
                      min="0.0001"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="Ex: 35 ou 1"
                      className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      id="btn-add-recipe-item"
                      onClick={handleAddItem}
                      className="w-full py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inserir</span>
                    </button>
                  </div>
                </div>

                {selectedMaterialToAdd?.isVirtualRecipe && selectedVirtualRequirements.length > 0 && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-purple-950">
                        Defina o aroma desta receita
                      </span>
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        Esta escolha ficará salva na receita da peça e será usada automaticamente quando você produzir este produto.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedVirtualRequirements.map((requirement, index) => {
                        const categoryMaterials = allMaterials.filter(
                          (m) => !m.isVirtualRecipe && m.category === requirement.category
                        );

                        return (
                          <div key={requirement.recipeItemId}>
                            <label className="block text-[10px] font-bold text-stone-700 mb-1">
                              {requirement.category} *
                            </label>
                            <SearchableMaterialCombobox
                              materials={categoryMaterials}
                              selectedMaterialId={recipeVariableSelections[requirement.recipeItemId] || ''}
                              onSelectMaterial={(mat) => {
                                setRecipeVariableSelections((prev) => ({
                                  ...prev,
                                  [requirement.recipeItemId]: mat?.id || '',
                                }));
                              }}
                              placeholder={`Escolha um material de ${requirement.category}...`}
                              id={`recipe-virtual-category-${index}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="p-4 rounded-lg bg-white border border-stone-200 text-center text-xs text-stone-500">
                Nenhum ingrediente adicionado à receita ainda. Selecione um material ou sub-produto acima.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[720px] text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Item / Descrição</th>
                      <th className="py-2.5 px-3 text-right">Qtd Consumida</th>
                      <th className="py-2.5 px-3 text-right">Custo Unitário</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-stone-50/60">
                        <td className="py-2.5 px-3">
                          {it.type === 'product' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                              <Layers className="w-3 h-3 text-amber-700" />
                              Sub-produto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">
                              Material
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          <div>{it.name}</div>
                          {it.categorySelections && Object.keys(it.categorySelections).length > 0 && (
                            <div className="text-[10px] text-purple-700 mt-0.5 space-x-2">
                              {Object.entries(it.categorySelections).map(([recipeItemId, materialId]) => {
                                const virtualMaterial = allMaterials.find((m) => m.id === it.targetId);
                                const variableItem = virtualMaterial?.recipeItems?.find((ri) => ri.id === recipeItemId);
                                const chosenMaterial = allMaterials.find((m) => m.id === materialId);
                                return (
                                  <span key={recipeItemId}>
                                    {variableItem?.targetCategory || 'Escolha'}: <strong>{chosenMaterial?.name || 'não encontrado'}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-stone-700 font-semibold">
                          {formatNumber(it.quantity)} {it.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-stone-500">
                          {formatCurrency(it.unitCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                          {formatCurrency(it.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                            title="Remover este item da receita"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-stone-50 border-t border-stone-200 font-bold">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-stone-700 text-right">
                        Custo Total de Insumos da Receita:
                      </td>
                      <td className="py-2.5 px-3 text-right text-stone-900 text-sm">
                        {formatCurrency(materialsCost)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* 3. MÃO DE OBRA & CUSTOS INDIRETOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Labor */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Mão de Obra do Artesão (Pro-labore)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-1">
                    Tempo de Produção (Minutos)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productionTimeMinutes}
                    onChange={(e) => setProductionTimeMinutes(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    placeholder="Ex: 45"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-1">
                    Valor da Sua Hora (R$/h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    placeholder="Ex: 35.00"
                  />
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center justify-between text-xs">
                <span className="text-stone-600">Custo da Mão de Obra:</span>
                <span className="font-bold text-stone-900">
                  {formatCurrency(laborCost)}
                </span>
              </div>
            </div>

            {/* Fixed costs & extras */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                Custos Fixos & Despesas Extras
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-1">
                    Custos Fixos Ateliê (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fixedCostPercent}
                    onChange={(e) => setFixedCostPercent(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    placeholder="Ex: 10"
                    title="Energia, internet, manutenção de máquinas..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-1">
                    Embalagem / Envio (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={otherCosts}
                    onChange={(e) => setOtherCosts(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                    placeholder="Ex: 2.50"
                  />
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center justify-between text-xs">
                <span className="text-stone-600">Fixos + Embalagem:</span>
                <span className="font-bold text-stone-900">
                  {formatCurrency(fixedCost + parsedOtherCosts)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. PRECIFICAÇÃO, MARGEM DE LUCRO & PREÇO SUGERIDO */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-700" />
              Precificação Inteligente & Margem de Lucro
            </h4>

            {/* Sliders & Margins */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-800">
                    Margem de Lucro Desejada:
                  </label>
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                    {parsedMargin}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={parsedMargin}
                  onChange={(e) => setProfitMarginPercent(e.target.value)}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                  <span>10% (Baixa)</span>
                  <span>45% (Equilibrada)</span>
                  <span>70% (Premium)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Preço de Venda Praticado (R$)
                </label>
                <input
                  id="input-product-actual-price"
                  type="number"
                  step="0.5"
                  placeholder={suggestedPrice.toFixed(2)}
                  value={actualPrice}
                  onChange={(e) => setActualPrice(e.target.value)}
                  className="w-full px-3 py-2 text-base font-bold bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Deixe vazio para usar o preço sugerido automaticamente.
                </span>
              </div>
            </div>

            {/* Financial Summary Highlight Banner */}
            <div className="bg-white rounded-xl p-4 border border-amber-300 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="border-r border-stone-100">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 block">
                  Custo Unitário da Peça
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {formatCurrency(unitCostFromBatch)}
                </span>
              </div>

              <div className="border-r border-stone-100">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 block">
                  Preço Sugerido
                </span>
                <span className="text-sm font-bold text-amber-700">
                  {formatCurrency(suggestedPrice)}
                </span>
              </div>

              <div className="border-r border-stone-100">
                <span className="text-[10px] uppercase tracking-wider text-emerald-800 block font-semibold">
                  Lucro Líquido por Peça
                </span>
                <span className="text-base font-extrabold text-emerald-600">
                  +{formatCurrency(netProfit)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-800 block font-semibold">
                  Margem Real Praticada
                </span>
                <span className="text-base font-extrabold text-stone-900">
                  {formatPercent(calculatedMarginPercent)}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            id="btn-save-product"
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 text-amber-400" />
            <span>{isEditing ? 'Salvar Alterações' : 'Concluir & Salvar Receita'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Ficha Técnica Printable Modal
// ==========================================

interface FichaTecnicaModalProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}

const FichaTecnicaModal: React.FC<FichaTecnicaModalProps> = ({
  product,
  onClose,
  onEdit,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Ficha Técnica & Precificação</h3>
              <p className="text-xs text-stone-400">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable content */}
        <div className="p-6 space-y-5 text-stone-800 text-xs">
          {/* Top Banner */}
          <div className="flex gap-4 items-start pb-4 border-b border-stone-200">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover border border-stone-200 shrink-0"
              />
            )}
            <div>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {product.category}
              </span>
              <h2 className="text-lg font-bold text-stone-900 mt-1">{product.name}</h2>
              {product.description && (
                <p className="text-stone-500 mt-1 text-xs">{product.description}</p>
              )}
            </div>
          </div>

          {/* BOM List */}
          <div>
            <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] mb-2">
              Composição de Materiais & Insumos
            </h4>
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 font-semibold border-b border-stone-200 text-stone-600">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-right">Custo Unitário</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {product.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 flex items-center gap-1.5">
                        {it.type === 'product' && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold">
                            Sub-produto
                          </span>
                        )}
                        <span>{it.name}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {formatNumber(it.quantity)} {it.unit}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-500">
                        {formatCurrency(it.unitCost)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-900">
                        {formatCurrency(it.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-stone-50 font-bold border-t border-stone-200">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right">Subtotal Insumos:</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(product.materialsCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Visual Cost Structure Bar */}
          {(() => {
            const total = (product.unitCostFromBatch > 0 ? product.unitCostFromBatch : product.totalCost) || 1;
            const matPct = (product.materialsCost / total) * 100;
            const laborPct = (product.laborCost / total) * 100;
            const fixPct = ((product.fixedCost + product.otherCosts) / total) * 100;

            return (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-stone-600">
                  <span className="font-bold uppercase tracking-wider text-stone-700">Estrutura do Custo:</span>
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Materiais ({formatPercent(matPct)})
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Mão de Obra ({formatPercent(laborPct)})
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-400" /> Fixos & Outros ({formatPercent(fixPct)})
                    </span>
                  </span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-2.5 flex overflow-hidden">
                  <div style={{ width: `${matPct}%` }} className="bg-blue-500 h-full transition-all" title={`Materiais: ${formatCurrency(product.materialsCost)}`} />
                  <div style={{ width: `${laborPct}%` }} className="bg-amber-500 h-full transition-all" title={`Mão de obra: ${formatCurrency(product.laborCost)}`} />
                  <div style={{ width: `${fixPct}%` }} className="bg-stone-400 h-full transition-all" title={`Custos fixos e outros: ${formatCurrency(product.fixedCost + product.otherCosts)}`} />
                </div>
              </div>
            );
          })()}

          {/* Detailed Cost Breakdown Table */}
          <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-600">Tempo de Confecção:</span>
                <span className="font-semibold">{product.productionTimeMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Taxa da Hora Artesanal:</span>
                <span className="font-semibold">{formatCurrency(product.hourlyRate)}/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Custo Mão de Obra:</span>
                <span className="font-bold text-stone-900">{formatCurrency(product.laborCost)}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-l border-stone-200 pl-4">
              <div className="flex justify-between">
                <span className="text-stone-600">Custos Fixos ({product.fixedCostPercent}%):</span>
                <span className="font-semibold">{formatCurrency(product.fixedCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Embalagem & Outros:</span>
                <span className="font-semibold">{formatCurrency(product.otherCosts)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200">
                <span className="font-bold text-stone-900">Custo Unitário Total:</span>
                <span className="font-extrabold text-stone-900">
                  {formatCurrency(product.unitCostFromBatch > 0 ? product.unitCostFromBatch : product.totalCost)}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Outcome */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-900 font-semibold block uppercase">
                Preço de Venda Praticado
              </span>
              <span className="text-2xl font-extrabold text-stone-900">
                {formatCurrency(product.actualPrice)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-emerald-800 font-semibold block uppercase">
                Lucro Líquido Real ({formatPercent(product.calculatedMarginPercent)})
              </span>
              <span className="text-xl font-bold text-emerald-600">
                +{formatCurrency(product.netProfit)}
              </span>
            </div>
          </div>

          {/* Observações / Notas da Receita */}
          {product.notes && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5">
              <h5 className="font-bold text-stone-800 text-[11px] uppercase tracking-wider mb-1">
                Observações / Notas de Confecção
              </h5>
              <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">
                {product.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 flex justify-between items-center">
          <button
            onClick={() => window.print()}
            className="text-xs text-stone-600 hover:text-stone-900 font-medium underline"
          >
            Imprimir Ficha
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-lg"
            >
              Fechar
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
            >
              Editar Receita
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
