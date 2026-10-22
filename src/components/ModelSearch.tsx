import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { ProductModel } from '../utils/productModels';
import { matchesSearchText } from '../utils/formatters';

export function ModelSearch({ id, models, value, onSelect, className }: {
  id: string;
  models: ProductModel[];
  value: string;
  onSelect: (model: ProductModel | null) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => models.filter(model => matchesSearchText(model.name, query)), [models, query]);
  const selected = models.find(model => model.id === value);
  const activeIndex = Math.min(index, Math.max(0, results.length - 1));
  const listId = `${id}-results`;
  const choose = (model: ProductModel) => {
    onSelect(model);
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open && results[activeIndex]) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex, results, id]);

  return <div ref={container} className="relative mt-1" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8a817a]" />
    <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={listId} aria-activedescendant={open && results[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
      autoComplete="off" placeholder="Digite para buscar o modelo…"
      className={`${className} pl-9 pr-10 font-normal`} value={open ? query : selected?.name || ''}
      onFocus={() => { setOpen(true); setQuery(''); setIndex(0); }}
      onClick={() => { if (!open) { setOpen(true); setQuery(''); setIndex(0); } }}
      onChange={event => {
        setQuery(event.target.value); setOpen(true); setIndex(0);
        if (value) onSelect(null);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setIndex(previous => open ? Math.max(0, Math.min(results.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1))) : 0);
        }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (results[activeIndex]) choose(results[activeIndex]); }
      }} />
    <button type="button" aria-label="Mostrar modelos" aria-expanded={open} aria-controls={listId}
      className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#8a817a] hover:bg-[#f6f1ec]"
      onPointerDown={event => event.preventDefault()}
      onClick={() => {
        if (open) setOpen(false);
        else { input.current?.focus(); setOpen(true); setQuery(''); setIndex(0); }
      }}><ChevronDown aria-hidden="true" className="h-4 w-4" /></button>
    {open && <div id={listId} role="listbox" aria-label="Modelos de produção"
      className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#e5dad1] bg-white py-1 shadow-lg">
      {results.map((model, position) => <button key={model.id} id={`${id}-option-${position}`} type="button"
        role="option" aria-selected={value === model.id} tabIndex={-1} data-model-id={model.id}
        onPointerDown={event => event.preventDefault()} onMouseEnter={() => setIndex(position)} onClick={() => choose(model)}
        className={`block min-h-11 w-full px-3 py-2.5 text-left text-sm font-normal text-[#352f2b] ${position === activeIndex ? 'bg-[#f6f1ec]' : 'hover:bg-[#fbf8f5]'}`}>
        {model.name}
      </button>)}
      {!results.length && <p className="px-3 py-3 text-sm font-normal text-[#75665c]">Nenhum modelo encontrado.</p>}
    </div>}
  </div>;
}
