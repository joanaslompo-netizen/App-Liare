import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Tag, ChevronDown, ChevronLeft, Layers, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, normalizeSearchText } from '../utils/formatters';
import { getProductFinancialSplit } from '../utils/financials';

interface SearchableProductComboboxProps {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product | null) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  filterOnlyFinalForSale?: boolean; // When true, filters out intermediate products if desired, or highlights them
  mode?: 'sale' | 'production';
  embeddedSelectedCard?: boolean;
}

export const SearchableProductCombobox: React.FC<SearchableProductComboboxProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  placeholder,
  id = 'searchable-product-combobox',
  autoFocus = false,
  filterOnlyFinalForSale = true,
  mode = 'sale',
  embeddedSelectedCard = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);

  const defaultPlaceholder = mode === 'production'
    ? 'Buscar receita por palavras-chave (ex: vela lavanda, difusor, aroma)...'
    : 'Buscar produto pelo nome ou categoria...';
  const effectivePlaceholder = activeFamily
    ? `Buscar aroma de ${activeFamily}...`
    : (placeholder || defaultPlaceholder);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Eligible products based on filter
  const eligibleProducts = useMemo(() => {
    if (!filterOnlyFinalForSale) return products;
    // Em pedidos/vendas, exibe somente receitas marcadas como Produto Final.
    return products.filter((p) => !p.isCustomRecipe && !p.isIntermediate);
  }, [products, filterOnlyFinalForSale]);

  const familyGroups = useMemo(() => {
    const map = new Map<string, Product[]>();
    eligibleProducts.forEach((product) => {
      const family = product.productFamily?.trim();
      if (!family || !product.fragrance?.trim()) return;
      const current = map.get(family) || [];
      current.push(product);
      map.set(family, current);
    });

    return Array.from(map.entries())
      .map(([family, variants]) => ({
        family,
        variants: variants.sort((a, b) =>
          (a.fragrance || a.name).localeCompare(b.fragrance || b.name, 'pt-BR', { sensitivity: 'base' })
        ),
        totalStock: variants.reduce((sum, item) => sum + (item.currentStock ?? 0), 0),
      }))
      .sort((a, b) => a.family.localeCompare(b.family, 'pt-BR', { sensitivity: 'base' }));
  }, [eligibleProducts]);

  // Currently selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filtered products based on search term (multi-keyword search).
  // In sales, grouped products open in two steps: product-base -> aroma.
  const filteredProducts = useMemo(() => {
    let list = activeFamily
      ? eligibleProducts.filter((p) => p.productFamily === activeFamily)
      : eligibleProducts;

    const trimmed = normalizeSearchText(query);
    if (trimmed) {
      const keywords = trimmed.split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const itemsText = (p.items || []).map((it) => it.name).join(' ');
        const searchBlob = normalizeSearchText(`${p.name} ${p.category} ${p.productFamily || ''} ${p.fragrance || ''} ${p.description || ''} ${itemsText}`);
        return keywords.every((kw) => searchBlob.includes(kw));
      });
    } else if (mode === 'sale' && !activeFamily && familyGroups.length > 0) {
      // Grouped variants are represented by their product-base cards above the regular list.
      list = list.filter((p) => !p.productFamily || !p.fragrance);
    }

    return [...list].sort((a, b) => {
      const aPaused = !!a.isPaused;
      const bPaused = !!b.isPaused;
      if (aPaused !== bPaused) return aPaused ? 1 : -1;
      if (activeFamily) {
        return (a.fragrance || a.name).localeCompare(b.fragrance || b.name, 'pt-BR', { sensitivity: 'base' });
      }
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [eligibleProducts, query, mode, activeFamily, familyGroups]);

  // Keep active index in bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Auto focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  const handleSelect = (prod: Product) => {
    onSelectProduct(prod);
    setQuery('');
    setActiveFamily(null);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onSelectProduct(null);
    setQuery('');
    setActiveFamily(null);
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[activeIndex]) {
        handleSelect(filteredProducts[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Product Card (when a product is chosen and dropdown is closed) */}
      {selectedProduct && !isOpen ? (
        <div className={`flex justify-between transition-all ${
          embeddedSelectedCard
            ? 'items-start bg-transparent border-0 p-0 shadow-none'
            : 'items-center p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl shadow-2xs hover:border-amber-400'
        }`}>
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {selectedProduct.imageUrl ? (
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover border border-amber-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold text-stone-900 ${
                  embeddedSelectedCard ? 'whitespace-normal break-words leading-snug' : 'truncate block'
                }`}>
                  {selectedProduct.productFamily || selectedProduct.name}
                </span>
                {selectedProduct.fragrance && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                    {selectedProduct.fragrance}
                  </span>
                )}
                {!embeddedSelectedCard && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-stone-200/80 text-stone-700">
                    {selectedProduct.category}
                  </span>
                )}
                {selectedProduct.isIntermediate && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 flex items-center gap-0.5">
                    <Layers className="w-2.5 h-2.5" /> Sub-produto
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {mode === 'production' ? (
                  <span>
                    Rendimento: <strong className="text-stone-900 font-bold">{selectedProduct.batchYield || 1} un/batelada</strong>
                    {' '}• Estoque atual: <strong className={`font-bold ${!selectedProduct.isPaused && (selectedProduct.minStock ?? 0) > 0 && (selectedProduct.currentStock ?? 0) <= (selectedProduct.minStock ?? 0) ? 'text-amber-800' : 'text-stone-800'}`}>{selectedProduct.currentStock ?? 0} un</strong>
                    {' '}• Custo: {formatCurrency(selectedProduct.unitCostFromBatch > 0 ? selectedProduct.unitCostFromBatch : selectedProduct.totalCost)}
                  </span>
                ) : (
                  <span>
                    Preço de venda:{' '}
                    <strong className="text-stone-900 font-bold">
                      {formatCurrency(selectedProduct.actualPrice)}
                    </strong>{' '}
                    • Custo prod.: {formatCurrency(selectedProduct.unitCostFromBatch > 0 ? selectedProduct.unitCostFromBatch : selectedProduct.totalCost)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {!embeddedSelectedCard && (
              <button
                type="button"
                id="btn-change-selected-product"
                onClick={() => {
                  setIsOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                Trocar
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              title="Remover seleção"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Search Input Box */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={inputRef}
              id={id}
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={effectivePlaceholder}
              className="w-full pl-9 pr-16 py-2.5 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900 shadow-2xs placeholder:text-stone-400"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(!isOpen);
                  if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Floating Dropdown Results */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
              {mode === 'sale' && !query.trim() && familyGroups.length > 0 && (
                <div className="border-b border-stone-200 bg-amber-50/40">
                  {activeFamily ? (
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFamily(null);
                          setQuery('');
                          setActiveIndex(0);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Produtos
                      </button>
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {activeFamily} · escolha o aroma
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 px-0.5">
                        Produtos com variações de aroma
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {familyGroups.map((group) => (
                          <button
                            key={group.family}
                            type="button"
                            onClick={() => {
                              setActiveFamily(group.family);
                              setQuery('');
                              setActiveIndex(0);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-stone-900">{group.family}</span>
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                {group.variants.length} {group.variants.length === 1 ? 'aroma' : 'aromas'}
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-500 mt-0.5">
                              Estoque total: {group.totalStock} un
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {mode === 'production'
                    ? (filteredProducts.length === 1 ? '1 receita encontrada' : `${filteredProducts.length} receitas encontradas`)
                    : activeFamily
                      ? (filteredProducts.length === 1 ? '1 aroma disponível' : `${filteredProducts.length} aromas disponíveis`)
                      : (filteredProducts.length === 1 ? '1 produto encontrado para venda' : `${filteredProducts.length} produtos encontrados para venda`)}
                </span>
                <span className="text-[11px] text-stone-400">↑ ↓ e Enter</span>
              </div>

              <ul ref={listRef} className="overflow-y-auto divide-y divide-stone-100 flex-1 py-1">
                {filteredProducts.length === 0 ? (
                  <li className="p-4 text-center text-sm text-stone-500">
                    <p className="font-medium text-stone-700">Nenhum resultado encontrado</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Nenhuma receita para "{query}". Tente buscar por outras palavras-chave ou ingredientes.
                    </p>
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="mt-2 text-xs text-amber-700 font-semibold hover:underline"
                      >
                        Ver todas as receitas
                      </button>
                    )}
                  </li>
                ) : (
                  filteredProducts.map((prod, idx) => {
                    const isSelected = prod.id === selectedProductId;
                    const isActive = idx === activeIndex;
                    const unitCost = prod.unitCostFromBatch > 0 ? prod.unitCostFromBatch : prod.totalCost;

                    return (
                      <li
                        key={prod.id}
                        onClick={() => handleSelect(prod)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          isActive ? 'bg-amber-50/80' : 'hover:bg-stone-50'
                        } ${isSelected ? 'bg-amber-100/40' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                              <Tag className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-stone-900 truncate">
                                {activeFamily ? (prod.fragrance || prod.name) : prod.name}
                              </span>
                              {!activeFamily && prod.productFamily && prod.fragrance && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                  {prod.fragrance}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                {prod.category}
                              </span>
                              {prod.isIntermediate && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                                  <Layers className="w-2.5 h-2.5" /> Sub-produto
                                </span>
                              )}
                            </div>

                            {mode === 'production' ? (
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500 flex-wrap">
                                <span>
                                  Rende: <strong className="text-stone-800 font-semibold">{prod.batchYield || 1} un</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Estoque: <strong className={`font-semibold ${!prod.isPaused && (prod.minStock ?? 0) > 0 && (prod.currentStock ?? 0) <= (prod.minStock ?? 0) ? 'text-amber-800' : 'text-stone-800'}`}>{prod.currentStock ?? 0} un</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Custo: <span className="text-stone-700 font-medium">{formatCurrency(unitCost)}</span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                                <span>
                                  Venda: <strong className="text-stone-900 font-bold">{formatCurrency(prod.actualPrice)}</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Custo: <span className="text-stone-700">{formatCurrency(unitCost)}</span>
                                </span>
                                <span>•</span>
                                <span className="text-emerald-700 font-semibold">
                                  Para você: {(() => {
                                    const ownerEarnings = prod.actualPrice - getProductFinancialSplit(prod).businessCostPerUnit;
                                    return `${ownerEarnings >= 0 ? '+' : ''}${formatCurrency(ownerEarnings)}`;
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 text-right">
                          {isSelected && (
                            <span className="text-amber-700 bg-amber-100 p-1 rounded-full" title="Receita selecionada">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <div className="text-right">
                            {mode === 'production' ? (
                              <span className="text-xs font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md">
                                {formatCurrency(unitCost)}/un
                              </span>
                            ) : (
                              <span className="text-sm font-extrabold text-stone-900">
                                {formatCurrency(prod.actualPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
