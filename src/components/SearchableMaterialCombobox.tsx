import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Package, AlertCircle, ChevronDown } from 'lucide-react';
import { Material } from '../types';
import { formatCurrency, formatNumber, UNIT_SHORT } from '../utils/formatters';

interface SearchableMaterialComboboxProps {
  materials: Material[];
  selectedMaterialId: string;
  onSelectMaterial: (material: Material | null) => void;
  placeholder?: string;
  id?: string;
}

// Remove accents for natural Brazilian Portuguese search (e.g., "rotulo" -> "Rótulo", "ambar" -> "Âmbar")
const normalizeText = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const SearchableMaterialCombobox: React.FC<SearchableMaterialComboboxProps> = ({
  materials,
  selectedMaterialId,
  onSelectMaterial,
  placeholder = 'Comece a digitar o nome do material (ex: cera, rótulo, pavio, essência)...',
  id = 'combobox-material-search',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Currently selected material object
  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterialId) || null;
  }, [materials, selectedMaterialId]);

  // Filtered materials matching query
  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (query.trim()) {
      const cleanQuery = normalizeText(query);
      const tokens = cleanQuery.split(/\s+/).filter(Boolean);

      list = materials.filter((mat) => {
        const searchBlob = normalizeText(
          `${mat.name} ${mat.category} ${mat.supplierName || ''} ${mat.notes || ''}`
        );
        // All typed tokens must match
        return tokens.every((token) => searchBlob.includes(token));
      });
    }

    return [...list].sort((a, b) => {
      const aPaused = !!a.isPaused;
      const bPaused = !!b.isPaused;
      if (aPaused !== bPaused) return aPaused ? 1 : -1;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [materials, query]);

  // Keep active index in bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

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

  const handleSelect = (mat: Material) => {
    onSelectMaterial(mat);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onSelectMaterial(null);
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
      setActiveIndex((prev) => (prev < filteredMaterials.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMaterials[activeIndex]) {
        handleSelect(filteredMaterials[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Material Card (when a material is chosen and dropdown is closed) */}
      {selectedMaterial && !isOpen ? (
        <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-300/80 rounded-xl transition-all shadow-2xs hover:border-amber-400">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedMaterial.imageUrl ? (
              <img
                src={selectedMaterial.imageUrl}
                alt={selectedMaterial.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover border border-amber-200/80 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-900 truncate block">
                  {selectedMaterial.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-stone-200/80 text-stone-700">
                  {selectedMaterial.category}
                </span>
                {selectedMaterial.usageType === 'durable' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
                    Durável
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {selectedMaterial.usageType === 'durable'
                  ? <>Valor cadastrado: <span className="font-semibold text-stone-800">{formatCurrency(selectedMaterial.packagePrice)}</span> • Quantidade possuída: {formatNumber(selectedMaterial.currentStock)} un</>
                  : <>Ref. pacote: <span className="font-semibold text-stone-800">{formatCurrency(selectedMaterial.packagePrice)}</span> por {formatNumber(selectedMaterial.packageQuantity)} {UNIT_SHORT[selectedMaterial.packageUnit] || selectedMaterial.packageUnit} • Estoque atual: {formatNumber(selectedMaterial.currentStock)} {UNIT_SHORT[selectedMaterial.unit]}</>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              id="btn-change-material"
              onClick={() => {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-300/80 rounded-lg transition-colors cursor-pointer"
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
              placeholder={placeholder}
              className="w-full pl-9 pr-16 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900 shadow-2xs placeholder:text-stone-400"
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
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200/80 flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700">
                  {filteredMaterials.length === 1
                    ? '1 material encontrado'
                    : `${filteredMaterials.length} materiais encontrados`}
                </span>
                <span className="text-[11px]">Use as setas ↑ ↓ e Enter para selecionar</span>
              </div>

              <ul ref={listRef} className="overflow-y-auto divide-y divide-stone-100 flex-1 py-1">
                {filteredMaterials.length === 0 ? (
                  <li className="p-4 text-center text-sm text-stone-500">
                    <p className="font-medium text-stone-700">Nenhum material encontrado</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Nenhum resultado para "{query}". Tente buscar por cera, pavio, essência, pote ou rótulo.
                    </p>
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="mt-2 text-xs text-amber-700 font-semibold hover:underline"
                      >
                        Ver todos os {materials.length} materiais
                      </button>
                    )}
                  </li>
                ) : (
                  filteredMaterials.map((mat, idx) => {
                    const isSelected = mat.id === selectedMaterialId;
                    const isActive = idx === activeIndex;
                    const isLowStock = mat.usageType !== 'durable' && !mat.isPaused && mat.minStock > 0 && mat.currentStock <= mat.minStock;

                    return (
                      <li
                        key={mat.id}
                        onClick={() => handleSelect(mat)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          isActive ? 'bg-amber-50/80' : 'hover:bg-stone-50'
                        } ${isSelected ? 'bg-amber-100/40' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {mat.imageUrl ? (
                            <img
                              src={mat.imageUrl}
                              alt={mat.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-stone-500" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-stone-900 truncate">
                                {mat.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                {mat.category}
                              </span>
                              {mat.usageType === 'durable' && (
                                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                                  Durável
                                </span>
                              )}
                              {mat.supplierName && (
                                <span className="text-[10px] text-stone-400 truncate hidden sm:inline">
                                  • {mat.supplierName}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                              <span>
                                Preço ref.: <strong className="text-stone-800">{formatCurrency(mat.packagePrice)}</strong> ({formatNumber(mat.packageQuantity)} {UNIT_SHORT[mat.packageUnit] || mat.packageUnit})
                              </span>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-0.5 ${isLowStock ? 'text-amber-700 font-semibold' : 'text-stone-600'}`}>
                                {isLowStock && <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />}
                                {mat.usageType === 'durable' ? 'Quantidade: ' : 'Estoque: '}{formatNumber(mat.currentStock)} {mat.usageType === 'durable' ? 'un' : UNIT_SHORT[mat.unit]}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 text-right">
                          {isSelected && (
                            <span className="text-amber-700 bg-amber-100 p-1 rounded-full" title="Material atualmente selecionado">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className="text-xs font-bold text-stone-800 hidden sm:block">
                            {formatCurrency(mat.packagePrice)}
                          </span>
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
