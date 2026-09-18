import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Tag, ChevronDown, Layers, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SearchableProductComboboxProps {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product | null) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  filterOnlyFinalForSale?: boolean; // When true, filters out intermediate products if desired, or highlights them
  mode?: 'sale' | 'production';
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
}) => {
  const defaultPlaceholder = mode === 'production'
    ? 'Buscar receita por palavras-chave (ex: vela lavanda, difusor, aroma)...'
    : 'Buscar produto pelo nome ou categoria...';
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Eligible products based on filter
  const eligibleProducts = useMemo(() => {
    if (!filterOnlyFinalForSale) return products;
    // By default for orders/sales, we prioritize products intended for sale (!isIntermediate)
    // If there are no final products, show all
    const finals = products.filter((p) => !p.isIntermediate);
    return finals.length > 0 ? finals : products;
  }, [products, filterOnlyFinalForSale]);

  // Currently selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filtered products based on search term (multi-keyword search)
  const filteredProducts = useMemo(() => {
    let list = eligibleProducts;
    const trimmed = query.trim().toLowerCase();
    if (trimmed) {
      const keywords = trimmed.split(/\s+/).filter(Boolean);
      list = eligibleProducts.filter((p) => {
        const itemsText = (p.items || []).map((it) => it.name).join(' ');
        const searchBlob = `${p.name} ${p.category} ${p.description || ''} ${itemsText}`.toLowerCase();
        return keywords.every((kw) => searchBlob.includes(kw));
      });
    }

    return [...list].sort((a, b) => {
      const aPaused = (a.minStock ?? 2) === 0;
      const bPaused = (b.minStock ?? 2) === 0;
      if (aPaused !== bPaused) return aPaused ? 1 : -1;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [eligibleProducts, query]);

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
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onSelectProduct(null);
    setQuery('');
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
        <div className="flex items-center justify-between p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl transition-all shadow-2xs hover:border-amber-400">
          <div className="flex items-center gap-2.5 min-w-0">
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
                <span className="text-xs font-bold text-stone-900 truncate block">
                  {selectedProduct.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-stone-200/80 text-stone-700">
                  {selectedProduct.category}
                </span>
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
                    {' '}• Estoque atual: <strong className={`font-bold ${(selectedProduct.currentStock ?? 0) <= (selectedProduct.minStock ?? 0) ? 'text-amber-800' : 'text-stone-800'}`}>{selectedProduct.currentStock ?? 0} un</strong>
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
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {mode === 'production'
                    ? (filteredProducts.length === 1 ? '1 receita encontrada' : `${filteredProducts.length} receitas encontradas`)
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
                                {prod.name}
                              </span>
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
                                  Estoque: <strong className={`font-semibold ${(prod.currentStock ?? 0) <= (prod.minStock ?? 0) ? 'text-amber-800' : 'text-stone-800'}`}>{prod.currentStock ?? 0} un</strong>
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
                                  Lucro: +{formatCurrency(prod.actualPrice - unitCost)}
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
