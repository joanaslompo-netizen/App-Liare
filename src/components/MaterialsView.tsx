import React, { useState, useMemo, useRef } from 'react';
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
  Wand2
} from 'lucide-react';
import { Material, Supplier, UnitOfMeasure, MaterialType } from '../types';
import { 
  formatCurrency, 
  formatNumber, 
  UNIT_LABELS, 
  UNIT_SHORT, 
  calculateUnitCost 
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
  filterLowStockInitial?: boolean;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  materials,
  suppliers,
  onSaveMaterial,
  onDeleteMaterial,
  onQuickStockChange,
  onProduceMaterial,
  filterLowStockInitial = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'for_sale'>('all');
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
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.supplierName && m.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          m.category.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = selectedCategory === 'all' || (selectedCategory === 'paused' ? (!m.isVirtualRecipe && (m.minStock ?? 0) === 0) : m.category === selectedCategory);
        const matchesLowStock = !onlyLowStock || (!m.isVirtualRecipe && m.minStock > 0 && m.currentStock <= m.minStock);
        const matchesType = 
          typeFilter === 'all' || 
          (typeFilter === 'internal' && (!m.materialType || m.materialType === 'internal')) ||
          (typeFilter === 'for_sale' && m.materialType === 'for_sale');

        return matchesSearch && matchesCategory && matchesLowStock && matchesType;
      })
      .sort((a, b) => {
        const aPaused = (a.minStock ?? 0) === 0;
        const bPaused = (b.minStock ?? 0) === 0;

        // MinStock === 0 goes to the bottom of the list
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

  const handleConfirmAdjust = (id: string) => {
    const val = parseFloat(adjustDelta);
    if (!isNaN(val) && val !== 0) {
      onQuickStockChange(id, val);
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

        <button
          id="btn-add-material"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Novo Material</span>
        </button>
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
            Pausados ({materials.filter((m) => !m.isVirtualRecipe && (m.minStock ?? 0) === 0).length})
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
            const isPaused = !isVirtual && (mat.minStock ?? 0) === 0;
            const isLowStock = !isVirtual && !isPaused && mat.currentStock <= mat.minStock;
            const stockPct = !isVirtual && mat.minStock > 0 ? Math.min(100, (mat.currentStock / (mat.minStock * 2)) * 100) : 100;

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
                          {mat.materialType === 'for_sale' ? (
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
                          <span className="text-[10px] font-medium text-stone-600 bg-stone-200/90 border border-stone-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0" title="Estoque mínimo igual a 0 (Inativo/Pausado)">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Inativo/Pausado
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
                      <span className="text-[11px] text-stone-500 block">Custo por {UNIT_SHORT[mat.unit]}</span>
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
                  ) : (
                    <div className="p-4 pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-600 font-medium">
                          Estoque Atual:
                        </span>
                        <span className={`font-semibold ${isPaused ? 'text-stone-500' : isLowStock ? 'text-amber-700' : 'text-stone-800'}`}>
                          {formatNumber(mat.currentStock)} {UNIT_SHORT[mat.unit]}
                          <span className="text-stone-400 font-normal ml-1">
                            {isPaused ? '(Pausado - Mín: 0)' : `(Mín: ${formatNumber(mat.minStock)} ${UNIT_SHORT[mat.unit]})`}
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
                            placeholder="+10 ou -5"
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
                              setAdjustDelta('');
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
  const [recipeBatchYield, setRecipeBatchYield] = useState<string>(material?.batchYield?.toString() || '1');
  const [recipeTargetId, setRecipeTargetId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState('1');
  const [recipeInputMode, setRecipeInputMode] = useState<'material' | 'category'>('material');
  const [recipeCategory, setRecipeCategory] = useState<string>('');

  const [name, setName] = useState(material?.name || '');
  const [materialType, setMaterialType] = useState<MaterialType>(material?.materialType || 'internal');
  const [category, setCategory] = useState(material?.category || (existingCategories[0] || 'Tecidos & Forros'));
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Unit configuration
  const [unit, setUnit] = useState<UnitOfMeasure>(material?.unit || 'cm');
  const [packageQuantity, setPackageQuantity] = useState<string>(material ? material.packageQuantity.toString() : '1');
  const [packageUnit, setPackageUnit] = useState<UnitOfMeasure>(material?.packageUnit || 'm');
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
      const options = materials.filter((m) => !m.isVirtualRecipe && m.category === item.targetCategory);
      if (options.length === 0) return { unitCost: item.unitCost || 0, unit: item.unit };
      const avg = options.reduce((sum, m) => sum + m.unitCost, 0) / options.length;
      const units = Array.from(new Set(options.map((m) => m.unit)));
      return { unitCost: avg, unit: units.length === 1 ? UNIT_SHORT[units[0]] : item.unit };
    }

    const fixed = materials.find((m) => m.id === item.targetId);
    return fixed
      ? { unitCost: fixed.unitCost, unit: UNIT_SHORT[fixed.unit] }
      : { unitCost: item.unitCost || 0, unit: item.unit };
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

  const recipeTotalCost = normalizedRecipeItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const parsedRecipeYield = Math.max(0.0001, parseFloat(recipeBatchYield) || 1);
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

    const newOrUpdated: Material = {
      id: material?.id || `mat_${Date.now()}`,
      name: name.trim(),
      category: finalCategory,
      materialType,
      unit,
      packageQuantity: isVirtualRecipe && isMadeInAtelier ? 1 : parsedPkgQty,
      packageUnit: isVirtualRecipe && isMadeInAtelier ? unit : packageUnit,
      packagePrice: isVirtualRecipe && isMadeInAtelier ? 0 : parsedPrice,
      unitCost: isMadeInAtelier ? recipeUnitCost : calculatedUnitCostPreview,
      isMadeInAtelier,
      isVirtualRecipe: isMadeInAtelier ? isVirtualRecipe : false,
      recipeItems: isMadeInAtelier ? normalizedRecipeItems : undefined,
      batchYield: isMadeInAtelier ? parsedRecipeYield : undefined,
      recipeTotalCost: isMadeInAtelier ? recipeTotalCost : undefined,
      unitCostFromBatch: isMadeInAtelier ? recipeUnitCost : undefined,
      currentStock: isMadeInAtelier && isVirtualRecipe ? 0 : (parseFloat(currentStock) || 0),
      minStock: isMadeInAtelier && isVirtualRecipe ? 0 : (parseFloat(minStock) || 0),
      supplierId: supplierId || undefined,
      supplierName: selectedSupplier ? selectedSupplier.name : undefined,
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
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Photo upload container */}
            <div className="shrink-0 w-full sm:w-36 flex flex-col items-center">
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
            <div className="flex-1 space-y-3.5 w-full">
              {/* Classification: Insumo interno vs Produto para venda direta */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Destino / Classificação do Material:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={"flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all " + (isMadeInAtelier ? "bg-purple-50/80 border-purple-400 ring-1 ring-purple-400/40" : "bg-white border-stone-200 hover:bg-stone-50")}>
                    <input type="radio" name="materialOrigin" checked={isMadeInAtelier} onChange={() => { setIsMadeInAtelier(true); setMaterialType('internal'); }} className="mt-0.5 text-purple-600 focus:ring-purple-500" />
                    <div>
                      <span className="text-xs font-bold text-stone-900 flex items-center gap-1"><Wand2 className="w-3.5 h-3.5 text-purple-700" />Feito no Ateliê</span>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">Material produzido por uma receita própria do ateliê.</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      materialType === 'internal'
                        ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400/40'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="materialType"
                      value="internal"
                      checked={materialType === 'internal'}
                      onChange={() => { setMaterialType('internal'); setIsMadeInAtelier(false); }}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        Insumo Interno (Etiqueta, Cera, Caixa...)
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">
                        Usado na produção/embalagem de outras peças. Não é vendido diretamente ao cliente final.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      materialType === 'for_sale'
                        ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/40'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="materialType"
                      value="for_sale"
                      checked={materialType === 'for_sale'}
                      onChange={() => { setMaterialType('for_sale'); setIsMadeInAtelier(false); }}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                        Produto Final / Venda Direta
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">
                        Item comprado para revenda direta no ateliê ou produto acabado.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

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

              {isMadeInAtelier && (
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
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Não controla estoque próprio. Ao produzir uma vela, o app desmonta esta receita e baixa diretamente os ingredientes reais.
                      </p>
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
                      setRecipeItems(prev => [...prev, {
                        id: 'mri_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        type: 'material',
                        targetId: target.id,
                        name: target.name,
                        quantity: qty,
                        unit: UNIT_SHORT[target.unit],
                        unitCost: target.unitCost,
                        totalCost: target.unitCost * qty,
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
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">Rendimento por lote ({UNIT_SHORT[unit]})</label>
                      <input type="number" min="0.0001" step="any" value={recipeBatchYield} onChange={e => setRecipeBatchYield(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-900" />
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-[11px] text-stone-600">{recipeItems.some(i => i.selectionMode === 'category') ? 'Custo estimado por unidade' : 'Custo por unidade'}</span>
                      <span className="font-extrabold text-stone-900">{formatCurrency(recipeUnitCost)} / {UNIT_SHORT[unit]}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Supplier */}
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
            </div>
          </div>

          {/* Pricing & Unit Calculation Box */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-700" />
              {isMadeInAtelier && isVirtualRecipe ? 'Unidade & Custo Estimado da Receita Virtual' : 'Preço de Compra & Cálculo do Custo Unitário'}
            </h4>

            {!(isMadeInAtelier && isVirtualRecipe) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* How bought: quantity */}
              <div>
                <label className="block text-[11px] font-medium text-stone-700 mb-1">
                  Quantidade do Pacote / Lote
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
                  Valor Pago no Pacote (R$)
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
            )}

            {/* Base unit for recipes */}
            <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-0.5">
                  Unidade que você usa nas Receitas das Peças:
                </label>
                <p className="text-[11px] text-stone-500">
                  (Ex: se comprou em metros, pode precificar por cm na receita)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
                  className="px-3 py-1.5 text-sm font-semibold bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
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
              </div>
            </div>

            {/* Real-time Calculated Unit Cost Banner */}
            <div className="bg-white p-3 rounded-lg border border-amber-200 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">
                Custo unitário calculado automaticamente:
              </span>
              <span className="text-base font-extrabold text-stone-900">
                {formatCurrency(isMadeInAtelier ? recipeUnitCost : calculatedUnitCostPreview)}
                <span className="text-xs font-normal text-stone-500 ml-1">
                  por {UNIT_SHORT[unit]}{isMadeInAtelier && recipeItems.some(i => i.selectionMode === 'category') ? ' (estimado)' : ''}
                </span>
              </span>
            </div>
          </div>

          {/* Stock Levels */}
          {!(isMadeInAtelier && isVirtualRecipe) ? (
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
