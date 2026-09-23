import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Hammer, 
  Calendar, 
  Layers, 
  Package, 
  Trash2, 
  Eye, 
  X, 
  Check, 
  DollarSign, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Production, Product, Material, ProductionIngredientDeduction } from '../types';
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  UNIT_SHORT,
  matchesSearchText
} from '../utils/formatters';
import { SearchableProductCombobox } from './SearchableProductCombobox';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';

interface ProductionsViewProps {
  productions: Production[];
  products: Product[];
  materials: Material[];
  onSaveProduction: (production: Production, updateStock: boolean) => void;
  onDeleteProduction: (id: string, revertStock: boolean) => void;
  onNavigateToProducts?: () => void;
  initialProductToProduce?: Product | null;
  initialSelectedProduct?: Product | null;
  onClearInitialProduct?: () => void;
  openNewProductionSignal?: number;
}

export const ProductionsView: React.FC<ProductionsViewProps> = ({
  productions,
  products,
  materials,
  onSaveProduction,
  onDeleteProduction,
  onNavigateToProducts,
  initialProductToProduce = null,
  initialSelectedProduct = null,
  onClearInitialProduct,
  openNewProductionSignal = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'final' | 'intermediate'>('all');
  const [isModalOpen, setIsModalOpen] = useState(!!(initialProductToProduce || initialSelectedProduct));
  const [selectedProductForProduction, setSelectedProductForProduction] = useState<Product | null>(
    initialProductToProduce || initialSelectedProduct || null
  );
  const [viewingProduction, setViewingProduction] = useState<Production | null>(null);
  const [expandedProductionIds, setExpandedProductionIds] = useState<Set<string>>(new Set());

  // Listen to incoming initial product to produce
  useEffect(() => {
    const target = initialProductToProduce || initialSelectedProduct;
    if (target) {
      setSelectedProductForProduction(target);
      setIsModalOpen(true);
    }
  }, [initialProductToProduce, initialSelectedProduct]);

  useEffect(() => {
    if (openNewProductionSignal > 0) {
      setSelectedProductForProduction(null);
      setIsModalOpen(true);
    }
  }, [openNewProductionSignal]);

  // Filter productions
  const filteredProductions = useMemo(() => {
    return productions
      .filter((p) => {
        const matchesSearch =
          matchesSearchText(p.productName, searchTerm) ||
          (p.productCategory && matchesSearchText(p.productCategory, searchTerm)) ||
          (p.notes && matchesSearchText(p.notes, searchTerm)) ||
          p.deductedItems.some((it) => matchesSearchText(it.name, searchTerm));

        const matchesType =
          typeFilter === 'all' ||
          (typeFilter === 'intermediate' && p.isIntermediate) ||
          (typeFilter === 'final' && !p.isIntermediate);

        return matchesSearch && matchesType;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [productions, searchTerm, typeFilter]);

  // Totals calculations
  const totalUnitsProduced = useMemo(() => {
    return filteredProductions.reduce((acc, p) => acc + p.quantityProduced, 0);
  }, [filteredProductions]);

  const totalProductionCost = useMemo(() => {
    return filteredProductions.reduce((acc, p) => acc + p.totalCost, 0);
  }, [filteredProductions]);

  const totalDeductedCount = useMemo(() => {
    return filteredProductions.reduce((acc, p) => acc + p.deductedItems.length, 0);
  }, [filteredProductions]);

  const toggleExpand = (id: string) => {
    setExpandedProductionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenAdd = (presetProduct?: Product) => {
    setSelectedProductForProduction(presetProduct || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProductForProduction(null);
    if (onClearInitialProduct) onClearInitialProduct();
  };

  const handleDelete = (prod: Production) => {
    const confirmRevert = window.confirm(
      `Excluir o registro de produção de "${prod.productName}"?\n\n` +
      `Clique em "OK" para excluir e REVERTER o estoque (estornar os insumos e retirar os produtos prontos).\n` +
      `Clique em "Cancelar" para não excluir nada.`
    );

    if (confirmRevert) {
      onDeleteProduction(prod.id, true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
              Histórico & Lançamento de Produção
            </h2>
            <span className="text-xs bg-amber-100 text-amber-900 font-semibold px-2.5 py-0.5 rounded-full">
              Baixa Automática de Insumos
            </span>
          </div>
        </div>

        <button
          id="btn-add-production"
          onClick={() => handleOpenAdd()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Lançar Produção de Receita</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-2xs min-w-0">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Lotes Produzidos
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">
            {filteredProductions.length}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-2xs min-w-0">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Peças / Unidades Prontas
          </span>
          <span className="text-2xl font-extrabold text-amber-600 mt-0.5 block">
            {totalUnitsProduced} un
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-2xs min-w-0">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Custo Total de Produção
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">
            {formatCurrency(totalProductionCost)}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-2xs min-w-0">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Movimentações de Insumos
          </span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-0.5 block">
            {totalDeductedCount}
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por produto, insumo, lote ou notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200/80 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                typeFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Todas ({productions.length})
            </button>
            <button
              onClick={() => setTypeFilter('final')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                typeFilter === 'final'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Produtos Finais
            </button>
            <button
              onClick={() => setTypeFilter('intermediate')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                typeFilter === 'intermediate'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Componentes & Rótulos
            </button>
          </div>
        </div>
      </div>

      {/* Production List */}
      {filteredProductions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Hammer className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-800 mb-1">
            Nenhum lote de produção encontrado
          </h3>
          <p className="text-stone-500 text-sm max-w-md mx-auto mb-6">
            Quando você produzir receitas (como velas, saboaria, caixas ou rótulos), registre aqui para abater automaticamente os insumos do estoque e aumentar o saldo do produto pronto.
          </p>
          <button
            onClick={() => handleOpenAdd()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Lançar Primeira Produção</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProductions.map((prod) => {
            const isExpanded = expandedProductionIds.has(prod.id);
            const matchingProduct = products.find((p) => p.id === prod.productId);

            return (
              <div
                key={prod.id}
                id={`production-item-${prod.id}`}
                className="bg-white rounded-xl border border-stone-200 shadow-2xs hover:border-stone-300 transition-all overflow-hidden"
              >
                {/* Main Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-stone-100 border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {prod.productImageUrl || matchingProduct?.imageUrl ? (
                        <img
                          src={prod.productImageUrl || matchingProduct?.imageUrl}
                          alt={prod.productName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-stone-400" />
                      )}
                    </div>

                    {/* Information */}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                          {formatDate(prod.date)}
                        </span>

                        {prod.productCategory && (
                          <span className="text-[11px] font-medium text-stone-600 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">
                            {prod.productCategory}
                          </span>
                        )}

                        {prod.isIntermediate ? (
                          <span className="text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Componente / Sub-produto
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Produto Final
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-stone-900 leading-snug">
                        {prod.productName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-stone-500">
                        <span className="font-semibold text-stone-800">
                          {prod.quantityProduced} {prod.quantityProduced === 1 ? 'unidade produzida' : 'unidades produzidas'}
                        </span>
                        <span>•</span>
                        <span>{prod.batchCount} {prod.batchCount === 1 ? 'batelada' : 'bateladas'}</span>
                        {prod.batchYield > 1 && (
                          <span className="text-stone-400">({prod.batchYield} un/batelada)</span>
                        )}
                        <span>•</span>
                        <span className="text-amber-800 font-medium">
                          {prod.deductedItems.length} insumos baixados
                        </span>
                      </div>

                      {prod.notes && (
                        <p className="text-xs text-stone-500 italic mt-1.5 bg-stone-50 px-2.5 py-1 rounded border border-stone-100 inline-block">
                          {prod.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100 gap-2">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-stone-500 block uppercase font-medium">
                        Custo Total do Lote
                      </span>
                      <span className="text-lg font-extrabold text-stone-900 block">
                        {formatCurrency(prod.totalCost)}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {formatCurrency(prod.costPerUnit)} / un
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={() => toggleExpand(prod.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                        title="Ver insumos que foram baixados do estoque"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Ocultar Insumos</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Ver Insumos ({prod.deductedItems.length})</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setViewingProduction(prod)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Ver detalhes completos da ordem"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(prod)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir produção e estornar estoque"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Deducted Items Drawer */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-stone-50/80 border-t border-stone-200 text-xs animate-in slide-in-from-top-1 duration-150">
                    <h5 className="font-bold text-stone-800 uppercase tracking-wider text-[10px] mb-2.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      Insumos Baixados do Estoque nesta Produção:
                    </h5>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-stone-200 text-stone-500 text-[10px] uppercase font-semibold">
                            <th className="pb-1.5">Insumo / Matéria-Prima</th>
                            <th className="pb-1.5 text-right">Qtd por Batelada</th>
                            <th className="pb-1.5 text-right">Total Deduzido</th>
                            <th className="pb-1.5 text-right">Custo Unitário</th>
                            <th className="pb-1.5 text-right">Custo Insumo</th>
                            <th className="pb-1.5 text-right">Estoque Antes → Depois</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200/60 text-stone-700">
                          {prod.deductedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-stone-100/50">
                              <td className="py-2 font-medium flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'product' ? 'bg-amber-500' : 'bg-stone-500'}`} />
                                <span>{item.name}</span>
                                {item.type === 'product' && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">sub-produto</span>
                                )}
                              </td>
                              <td className="py-2 text-right text-stone-500 font-mono">
                                {formatNumber(item.quantityPerBatch)} {item.unit}
                              </td>
                              <td className="py-2 text-right font-bold text-rose-700 font-mono">
                                -{formatNumber(item.quantityTotal)} {item.unit}
                              </td>
                              <td className="py-2 text-right text-stone-500 font-mono">
                                {formatCurrency(item.unitCost)}
                              </td>
                              <td className="py-2 text-right font-semibold text-stone-900 font-mono">
                                {formatCurrency(item.totalCost)}
                              </td>
                              <td className="py-2 text-right text-stone-500 font-mono">
                                {item.stockBefore !== undefined && item.stockAfter !== undefined ? (
                                  <span>
                                    {formatNumber(item.stockBefore)} → <strong className="text-stone-800">{formatNumber(item.stockAfter)} {item.unit}</strong>
                                  </span>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Production Modal */}
      {isModalOpen && (
        <NewProductionModal
          isOpen={isModalOpen}
          products={products}
          materials={materials}
          presetProduct={selectedProductForProduction}
          onClose={handleCloseModal}
          onSave={onSaveProduction}
        />
      )}

      {/* View Production Details Modal */}
      {viewingProduction && (
        <ViewProductionModal
          production={viewingProduction}
          onClose={() => setViewingProduction(null)}
        />
      )}
    </div>
  );
};

// ==========================================
// New Production Modal
// ==========================================

export interface NewProductionModalProps {
  isOpen: boolean;
  products: Product[];
  materials: Material[];
  presetProduct: Product | null;
  onClose: () => void;
  onSave: (prod: Production, updateStock: boolean) => void;
}

export const NewProductionModal: React.FC<NewProductionModalProps> = ({
  isOpen,
  products,
  materials,
  presetProduct,
  onClose,
  onSave,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(presetProduct?.id || '');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchCount, setBatchCount] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [updateStock, setUpdateStock] = useState<boolean>(true);
  const [variableSelections, setVariableSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (presetProduct) {
      setSelectedProductId(presetProduct.id);
    }
  }, [presetProduct]);

  useEffect(() => {
    setVariableSelections({});
  }, [selectedProductId]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const parsedBatchCount = Math.max(1, parseFloat(batchCount) || 1);
  const batchYield = selectedProduct?.batchYield && selectedProduct.batchYield > 0 ? selectedProduct.batchYield : 1;
  const quantityProduced = parsedBatchCount * batchYield;

  const makeVariableKey = (productItemId: string, virtualMaterialId: string, recipeItemId: string) =>
    `${productItemId}::${virtualMaterialId}::${recipeItemId}`;

  // Finds every "choose from category" ingredient hidden inside a virtual material
  // used by the selected product. Example: Cera Aromatizada -> Categoria Essências.
  const variableRequirements = useMemo(() => {
    if (!selectedProduct) return [];

    return selectedProduct.items.flatMap((productItem) => {
      if (productItem.type !== 'material') return [];
      const virtualMaterial = materials.find((m) => m.id === productItem.targetId);
      if (!virtualMaterial?.isVirtualRecipe || !virtualMaterial.recipeItems?.length) return [];

      const virtualYield = Math.max(0.0001, virtualMaterial.batchYield || 1);
      const scalePerProductBatch = productItem.quantity / virtualYield;

      return virtualMaterial.recipeItems
        .filter(
          (recipeItem) =>
            recipeItem.type === 'material' &&
            recipeItem.selectionMode === 'category' &&
            recipeItem.targetCategory &&
            !productItem.categorySelections?.[recipeItem.id]
        )
        .map((recipeItem) => ({
          key: makeVariableKey(productItem.id, virtualMaterial.id, recipeItem.id),
          virtualMaterialId: virtualMaterial.id,
          virtualMaterialName: virtualMaterial.name,
          category: recipeItem.targetCategory as string,
          quantityPerBatch: recipeItem.quantity * scalePerProductBatch,
          unit: recipeItem.unit,
        }));
    });
  }, [selectedProduct, materials]);

  // Expand virtual materials proportionally and calculate the real stock deductions.
  const { deductions, hasStockShortage, hasMissingVariableSelection } = useMemo(() => {
    if (!selectedProduct) {
      return { deductions: [], hasStockShortage: false, hasMissingVariableSelection: false };
    }

    let shortage = false;
    let missingVariable = false;

    type PendingDeduction = Omit<ProductionIngredientDeduction, 'quantityTotal' | 'totalCost' | 'stockBefore' | 'stockAfter'>;
    const aggregated = new Map<string, PendingDeduction>();

    const addIngredient = (
      id: string,
      targetId: string,
      type: 'material' | 'product',
      name: string,
      unit: string,
      quantityPerBatch: number,
      unitCost: number
    ) => {
      const key = `${type}:${targetId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantityPerBatch += quantityPerBatch;
        return;
      }
      aggregated.set(key, {
        id,
        targetId,
        type,
        name,
        unit,
        quantityPerBatch,
        unitCost,
      });
    };

    selectedProduct.items.forEach((item) => {
      if (item.type === 'material') {
        const mat = materials.find((m) => m.id === item.targetId);

        // Moldes/ferramentas ficam vinculados à receita, mas não são consumidos.
        if (mat?.usageType === 'durable') return;

        if (mat?.isVirtualRecipe && mat.recipeItems?.length) {
          const virtualYield = Math.max(0.0001, mat.batchYield || 1);
          const scalePerProductBatch = item.quantity / virtualYield;

          mat.recipeItems.forEach((recipeItem) => {
            const expandedQuantityPerBatch = recipeItem.quantity * scalePerProductBatch;

            if (recipeItem.type === 'material' && recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
              const selectionKey = makeVariableKey(item.id, mat.id, recipeItem.id);
              const chosenId = item.categorySelections?.[recipeItem.id] || variableSelections[selectionKey];
              const chosen = materials.find(
                (m) => m.id === chosenId && !m.isVirtualRecipe && m.category === recipeItem.targetCategory
              );

              if (!chosen) {
                missingVariable = true;
                return;
              }

              if (chosen.usageType !== 'durable') {
                addIngredient(
                  `${item.id}_${recipeItem.id}`,
                  chosen.id,
                  'material',
                  chosen.name,
                  UNIT_SHORT[chosen.unit] || recipeItem.unit,
                  expandedQuantityPerBatch,
                  chosen.unitCost
                );
              }
              return;
            }

            if (recipeItem.type === 'material') {
              const childMat = materials.find((m) => m.id === recipeItem.targetId);
              if (childMat) {
                if (childMat.usageType !== 'durable') {
                  addIngredient(
                    `${item.id}_${recipeItem.id}`,
                    childMat.id,
                    'material',
                    childMat.name,
                    UNIT_SHORT[childMat.unit] || recipeItem.unit,
                    expandedQuantityPerBatch,
                    childMat.unitCost
                  );
                }
              } else {
                addIngredient(
                  `${item.id}_${recipeItem.id}`,
                  recipeItem.targetId,
                  'material',
                  recipeItem.name,
                  recipeItem.unit,
                  expandedQuantityPerBatch,
                  recipeItem.unitCost
                );
              }
              return;
            }

            const childProduct = products.find((p) => p.id === recipeItem.targetId);
            const childUnitCost = childProduct
              ? (childProduct.unitCostFromBatch > 0 ? childProduct.unitCostFromBatch : childProduct.totalCost)
              : recipeItem.unitCost;
            addIngredient(
              `${item.id}_${recipeItem.id}`,
              recipeItem.targetId,
              'product',
              childProduct?.name || recipeItem.name,
              recipeItem.unit,
              expandedQuantityPerBatch,
              childUnitCost
            );
          });

          return;
        }

        addIngredient(
          item.id,
          item.targetId,
          'material',
          mat?.name || item.name,
          mat ? (UNIT_SHORT[mat.unit] || item.unit) : item.unit,
          item.quantity,
          mat?.unitCost ?? item.unitCost
        );
        return;
      }

      const subProd = products.find((p) => p.id === item.targetId);
      const subUnitCost = subProd
        ? (subProd.unitCostFromBatch > 0 ? subProd.unitCostFromBatch : subProd.totalCost)
        : item.unitCost;
      addIngredient(
        item.id,
        item.targetId,
        'product',
        subProd?.name || item.name,
        item.unit,
        item.quantity,
        subUnitCost
      );
    });

    const list: ProductionIngredientDeduction[] = Array.from(aggregated.values()).map((item) => {
      const quantityTotal = item.quantityPerBatch * parsedBatchCount;
      let stockBefore = 0;

      if (item.type === 'material') {
        stockBefore = materials.find((m) => m.id === item.targetId)?.currentStock ?? 0;
      } else {
        stockBefore = products.find((p) => p.id === item.targetId)?.currentStock ?? 0;
      }

      const stockAfter = stockBefore - quantityTotal;
      if (stockAfter < 0) shortage = true;

      return {
        ...item,
        quantityTotal,
        totalCost: item.unitCost * quantityTotal,
        stockBefore,
        stockAfter,
      };
    });

    return {
      deductions: list,
      hasStockShortage: shortage,
      hasMissingVariableSelection: missingVariable,
    };
  }, [selectedProduct, parsedBatchCount, materials, products, variableSelections]);

  // Product overhead (labor/fixed/other costs) stays the same, while ingredient
  // cost is recalculated from the actual essence/material selected for this production.
  const ingredientCost = deductions.reduce((sum, item) => sum + item.totalCost, 0);
  const nonIngredientCostPerBatch = selectedProduct
    ? Math.max(0, selectedProduct.totalCost - selectedProduct.materialsCost)
    : 0;
  const totalCost = selectedProduct
    ? ingredientCost + nonIngredientCostPerBatch * parsedBatchCount
    : 0;
  const unitCost = quantityProduced > 0 ? totalCost / quantityProduced : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Selecione um produto ou receita para produzir.');
      return;
    }

    if (parsedBatchCount <= 0) {
      alert('Informe uma quantidade de bateladas válida maior que zero.');
      return;
    }

    if (hasMissingVariableSelection) {
      alert('Escolha o material de cada categoria variável antes de lançar a produção.');
      return;
    }

    if (hasStockShortage && updateStock) {
      const proceed = window.confirm(
        'Atenção: Alguns insumos da receita não possuem saldo suficiente no estoque atual.\n\n' +
        'Ao prosseguir, o estoque desses itens será ajustado automaticamente para zero.\n\n' +
        'Deseja lançar a produção mesmo assim?'
      );
      if (!proceed) return;
    }

    const recordedDeductions = updateStock
      ? deductions.map((deduction) => ({
          ...deduction,
          stockAfter: Math.max(0, Number(deduction.stockAfter.toFixed(4))),
        }))
      : deductions;

    const newProduction: Production = {
      id: `prod_exec_${Date.now()}`,
      date,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCategory: selectedProduct.category,
      productImageUrl: selectedProduct.imageUrl,
      isIntermediate: selectedProduct.isIntermediate,
      batchYield,
      batchCount: parsedBatchCount,
      quantityProduced,
      costPerUnit: unitCost,
      totalCost,
      deductedItems: recordedDeductions,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onSave(newProduction, updateStock);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                Lançar Produção de Receita
              </h3>
              <p className="text-xs text-stone-500">
                Baixa automática de insumos e entrada das peças finalizadas no estoque.
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* 1. Recipe Selection & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Receita / Peça a Produzir *
              </label>
              <SearchableProductCombobox
                id="combobox-recipe-to-produce"
                products={products}
                selectedProductId={selectedProductId}
                onSelectProduct={(prod) => setSelectedProductId(prod ? prod.id : '')}
                mode="production"
                filterOnlyFinalForSale={false}
                placeholder="Digite palavras-chave da receita (ex: vela lavanda, difusor, aroma)..."
                autoFocus={!presetProduct}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Data da Produção *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quando nenhuma receita selecionada ainda */}
          {!selectedProduct && (
            <div className="p-8 text-center border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50/40 my-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">
                Digite palavras-chave no campo acima
              </h4>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
                Você pode buscar digitando palavras-chave do nome da receita (ex: <strong className="text-stone-700">"Lavanda"</strong> ou <strong className="text-stone-700">"Vela Pote"</strong>), categoria ou até o nome de insumos usados.
              </p>
            </div>
          )}

          {/* 2. Batch and Yield Calculator */}
          {selectedProduct && (
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-12 h-12 rounded-lg bg-white border border-amber-200 shrink-0 overflow-hidden flex items-center justify-center">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-amber-700" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 leading-tight">
                    {selectedProduct.name}
                  </h4>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Estoque Atual: <strong className="text-stone-900 font-semibold">{selectedProduct.currentStock} un</strong> • Custo Unitário: {formatCurrency(unitCost)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-0.5">
                    Nº de Bateladas
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBatchCount(String(Math.max(1, parsedBatchCount - 1)))}
                      disabled={parsedBatchCount <= 1}
                      aria-label="Diminuir número de bateladas"
                      className="w-8 h-8 inline-flex items-center justify-center bg-white border border-amber-300 rounded-lg text-base font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={batchCount}
                      onChange={(e) => setBatchCount(e.target.value)}
                      required
                      className="w-16 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setBatchCount(String(parsedBatchCount + 1))}
                      aria-label="Aumentar número de bateladas"
                      className="w-8 h-8 inline-flex items-center justify-center bg-white border border-amber-300 rounded-lg text-base font-bold text-amber-900 hover:bg-amber-50 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-0.5">
                    Total a Produzir
                  </span>
                  <span className="text-base font-extrabold text-amber-900 block bg-white px-3 py-1 rounded-lg border border-amber-200">
                    +{quantityProduced} un
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Escolhas dos ingredientes variáveis das receitas virtuais */}
          {selectedProduct && variableRequirements.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-700" />
                  Escolhas desta produção
                </h4>
                <p className="text-[11px] text-purple-700 mt-1">
                  Esta receita usa um material virtual. Escolha agora qual ingrediente real será usado em cada categoria.
                </p>
              </div>

              <div className="space-y-3">
                {variableRequirements.map((requirement, index) => {
                  const categoryMaterials = materials.filter(
                    (m) => !m.isVirtualRecipe && m.category === requirement.category
                  );
                  return (
                    <div key={requirement.key} className="bg-white border border-purple-200 rounded-lg p-3">
                      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[11px] font-bold text-stone-800 mb-1">
                            {requirement.category} para {requirement.virtualMaterialName} *
                          </label>
                          <SearchableMaterialCombobox
                            materials={categoryMaterials}
                            selectedMaterialId={variableSelections[requirement.key] || ''}
                            onSelectMaterial={(mat) => {
                              setVariableSelections((prev) => ({
                                ...prev,
                                [requirement.key]: mat?.id || '',
                              }));
                            }}
                            placeholder={`Escolha um material da categoria ${requirement.category}...`}
                            id={`select-variable-ingredient-${index}`}
                          />
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className="block text-[10px] uppercase font-bold tracking-wider text-stone-500">
                            Proporção por batelada
                          </span>
                          <span className="text-sm font-extrabold text-purple-800">
                            {formatNumber(requirement.quantityPerBatch)} {requirement.unit}
                          </span>
                        </div>
                      </div>
                      {categoryMaterials.length === 0 && (
                        <p className="text-[10px] text-rose-700 mt-2">
                          Nenhum material cadastrado na categoria {requirement.category}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasMissingVariableSelection && (
                <div className="text-[11px] font-semibold text-purple-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escolha todas as opções acima para o app calcular a baixa e o custo real.
                </div>
              )}
            </div>
          )}

          {/* 3. Insumos Breakdown & Stock Availability Table */}
          {selectedProduct && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Insumos & Ingredientes que serão deduzidos do estoque ({deductions.length})
                </label>
                {hasStockShortage && (
                  <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Atenção: Insumos com estoque insuficiente
                  </span>
                )}
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-stone-50 sticky top-0 border-b border-stone-200 text-stone-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Insumo</th>
                        <th className="py-2.5 px-3 text-right">Por Batelada</th>
                        <th className="py-2.5 px-3 text-right">Qtd a Baixar</th>
                        <th className="py-2.5 px-3 text-right">Estoque Atual</th>
                        <th className="py-2.5 px-3 text-right">Saldo Restante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-700">
                      {deductions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-stone-400 italic">
                            Esta receita não possui insumos cadastrados na ficha técnica.
                          </td>
                        </tr>
                      ) : (
                        deductions.map((d, i) => {
                          const isNegative = (d.stockAfter || 0) < 0;
                          return (
                            <tr key={i} className={isNegative ? 'bg-rose-50/60' : 'hover:bg-stone-50'}>
                              <td className="py-2.5 px-3 font-medium text-stone-900 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${d.type === 'product' ? 'bg-amber-500' : 'bg-stone-500'}`} />
                                <span>{d.name}</span>
                                {d.type === 'product' && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-normal">sub-produto</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-stone-500 font-mono">
                                {formatNumber(d.quantityPerBatch)} {d.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 font-mono">
                                -{formatNumber(d.quantityTotal)} {d.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right text-stone-600 font-mono">
                                {formatNumber(d.stockBefore || 0)} {d.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                {isNegative ? (
                                  <span className="text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">
                                    {formatNumber(d.stockAfter || 0)} {d.unit} (Falta {formatNumber(Math.abs(d.stockAfter || 0))})
                                  </span>
                                ) : (
                                  <span className="text-emerald-700">
                                    {formatNumber(d.stockAfter || 0)} {d.unit}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Notes and Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Observações do Lote (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Lote 04/2026, produção para pronta-entrega da feira de sábado..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="pt-2 sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500"
                />
                <span className="text-xs font-medium text-stone-800">
                  Atualizar estoque automaticamente
                </span>
              </label>
              <span className="text-[10px] text-stone-500 block mt-0.5 ml-6">
                Baixa os insumos e aumenta o produto pronto
              </span>
            </div>
          </div>

          {/* 5. Cost Summary Footer Card */}
          <div className="p-4 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-500 block">Investimento no Lote:</span>
              <span className="text-xl font-extrabold text-stone-900">
                {formatCurrency(totalCost)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-stone-500 block">Novo Saldo Previsto do Produto:</span>
              <span className="text-base font-bold text-emerald-700">
                {(selectedProduct?.currentStock || 0) + (updateStock ? quantityProduced : 0)} unidades
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedProduct}
              className={`px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 font-semibold text-sm ${
                selectedProduct
                  ? 'bg-stone-900 hover:bg-stone-800 text-white cursor-pointer active:scale-98'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>Confirmar & Dar Baixa no Estoque</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// View Production Details Modal
// ==========================================

interface ViewProductionModalProps {
  production: Production;
  onClose: () => void;
}

const ViewProductionModal: React.FC<ViewProductionModalProps> = ({
  production,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                Detalhes da Ordem de Produção
              </h3>
              <p className="text-xs text-stone-500">
                Registrada em {formatDate(production.date)}
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Main Info */}
          <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
            <div className="w-16 h-16 rounded-lg bg-white border border-stone-200 shrink-0 overflow-hidden flex items-center justify-center">
              {production.productImageUrl ? (
                <img
                  src={production.productImageUrl}
                  alt={production.productName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-stone-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded">
                  {production.productCategory}
                </span>
                {production.isIntermediate && (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    Sub-produto
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-stone-900">
                {production.productName}
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Produzidas <strong className="text-stone-800 font-semibold">{production.quantityProduced} unidades</strong> em {production.batchCount} {production.batchCount === 1 ? 'batelada' : 'bateladas'}.
              </p>
            </div>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block uppercase font-medium">
                Custo por Peça
              </span>
              <span className="text-lg font-bold text-stone-900">
                {formatCurrency(production.costPerUnit)}
              </span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block uppercase font-medium">
                Custo Total da Batelada
              </span>
              <span className="text-lg font-bold text-stone-900">
                {formatCurrency(production.totalCost)}
              </span>
            </div>
          </div>

          {/* Deducted items */}
          <div>
            <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider mb-2">
              Insumos Baixados ({production.deductedItems.length}):
            </h5>
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-50 text-[10px] uppercase font-semibold text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3">Insumo</th>
                    <th className="py-2 px-3 text-right">Qtd Total</th>
                    <th className="py-2 px-3 text-right">Custo Insumo</th>
                    <th className="py-2 px-3 text-right">Estoque Antes → Depois</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {production.deductedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600 font-mono">
                        -{formatNumber(item.quantityTotal)} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(item.totalCost)}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-500 font-mono">
                        {item.stockBefore !== undefined && item.stockAfter !== undefined ? (
                          `${formatNumber(item.stockBefore)} → ${formatNumber(item.stockAfter)}`
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {production.notes && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <strong className="block text-[10px] text-stone-500 uppercase font-semibold mb-0.5">Observações:</strong>
              {production.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
