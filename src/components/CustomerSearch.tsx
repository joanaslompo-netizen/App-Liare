import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Customer } from '../types';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function CustomerSearch({ customers, value, onChange, onCreate, label = 'Cliente', required = false, detail, emptyLabel = 'Todos os clientes' }: {
  customers: Customer[]; value: string; onChange: (id: string) => void; onCreate?: (name: string) => void; label?: string; required?: boolean; detail?: (customer: Customer) => string; emptyLabel?: string;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const selected = customers.find(customer => customer.id === value);
  useEffect(() => { if (selected) setQuery(selected.name); }, [selected?.id, selected?.name]);
  useEffect(() => { field.current?.setCustomValidity(required && !selected ? 'Selecione um cliente nos resultados da busca.' : ''); }, [required, selected, query]);
  const results = useMemo(() => customers.filter(customer => normalize(customer.name).includes(normalize(query)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).slice(0, 12), [customers, query]);
  const choose = (customer: Customer) => { onChange(customer.id); setQuery(customer.name); setOpen(false); };
  return <div className="relative space-y-1">
    <label htmlFor={id} className="text-sm font-medium text-stone-700">{label}</label>
    <input ref={field} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={open && results[index] ? `${id}-${results[index].id}` : undefined}
      required={required} autoComplete="off" placeholder="Digite o começo do nome…" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900"
      value={query} onFocus={() => { setOpen(true); setIndex(0); }} onBlur={() => setOpen(false)}
      onChange={event => { setQuery(event.target.value); onChange(''); setIndex(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setIndex(previous => Math.max(0, Math.min(results.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (results[index]) choose(results[index]); }
      }} />
    {open && <div id={`${id}-results`} role="listbox" aria-label={label} className="absolute z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
      {!required && <button type="button" role="option" aria-selected={!value} className="w-full px-3 py-2 text-left text-sm" onPointerDown={event => event.preventDefault()} onClick={() => { onChange(''); setQuery(''); setOpen(false); }}>{emptyLabel}</button>}
      {results.map((customer, position) => <button id={`${id}-${customer.id}`} key={customer.id} type="button" role="option" aria-selected={customer.id === value} onPointerDown={event => event.preventDefault()} onMouseEnter={() => setIndex(position)} onClick={() => choose(customer)} className={`w-full px-3 py-2 text-left text-sm ${position === index ? 'bg-stone-100' : ''}`}>
        <span className="block font-medium">{customer.name}</span><span className="block text-xs text-stone-500">{[customer.phone, detail?.(customer)].filter(Boolean).join(' · ')}</span>
      </button>)}
      {!results.length && <p className="p-3 text-sm text-stone-500">Nenhum cliente encontrado.</p>}
      <p className="px-3 py-2 text-xs text-stone-500">Digite para filtrar os nomes.</p>
    </div>}
    {onCreate && <button type="button" className="text-sm font-medium underline text-[#95553f]" onClick={() => { setOpen(false); onCreate(query.trim()); }}>+ Cadastro rápido de cliente</button>}
  </div>;
}
