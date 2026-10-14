import React, { useId, useState } from 'react';
import type { CreditMovementKind, CreditOrigin } from '../types';
import { newId } from '../utils/financeLedger';

export const CREDIT_MOVEMENTS: Record<CreditMovementKind, string> = {
  receipt: 'Entrada de dinheiro para produtos futuros', credit_opening: 'Saldo anterior (sem nova entrada)', credit_grant: 'Cortesia (sem entrada de dinheiro)', credit_refund: 'Devolução de crédito em dinheiro',
};
export const DEFAULT_CREDIT_ORIGINS: CreditOrigin[] = [
  { id: 'advance', name: 'Recebi dinheiro para produtos futuros', kind: 'receipt' },
  { id: 'opening', name: 'Crédito anterior já existente', kind: 'credit_opening' },
  { id: 'gift', name: 'Cortesia concedida', kind: 'credit_grant' },
  { id: 'refund', name: 'Devolver crédito em dinheiro', kind: 'credit_refund' },
];
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900';
const normalized = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function CreditOriginField({ origins, value, kind, onChange, onKindChange, onSave }: {
  origins: CreditOrigin[]; value: string; kind: CreditMovementKind; onChange: (value: string) => void; onKindChange: (kind: CreditMovementKind) => void; onSave: (origins: CreditOrigin[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<CreditOrigin[] | null>(null);
  const [error, setError] = useState('');
  const sorted = [...origins].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const change = (name: string) => { onChange(name); const match = origins.find(origin => normalized(origin.name) === normalized(name)); if (match) onKindChange(match.kind); };
  return <div className="space-y-2">
    <label className="block space-y-1 text-sm font-medium text-stone-700" htmlFor={id}><span>Origem / ação</span><input id={id} list={`${id}-options`} className={input} value={value} onChange={event => change(event.target.value)} placeholder="Selecione ou escreva uma origem…" autoComplete="off" /></label>
    <datalist id={`${id}-options`}>{sorted.map(origin => <option key={origin.id} value={origin.name} />)}</datalist>
    <label className="block space-y-1 text-sm font-medium text-stone-700"><span>Tipo de movimentação</span><select className={input} value={kind} onChange={event => onKindChange(event.target.value as CreditMovementKind)}>{Object.entries(CREDIT_MOVEMENTS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <button type="button" className="text-sm underline" onClick={() => { setDraft(origins.map(origin => ({ ...origin }))); setError(''); }}>Editar categorias de origem</button>
    {value.trim() && !origins.some(origin => normalized(origin.name) === normalized(value)) && <button type="button" className="ml-3 text-sm underline" onClick={() => onSave([...origins, { id: newId(), name: value.trim(), kind }])}>Salvar esta origem como categoria</button>}
    {draft && <div className="space-y-3 rounded-xl border bg-stone-50 p-3">
      <p className="text-sm">Crie, renomeie ou exclua opções. Os lançamentos anteriores mantêm a origem registrada.</p>
      {draft.map((origin, index) => <div key={origin.id} className="space-y-2 rounded-lg border bg-white p-2">
        <input aria-label={`Nome da categoria ${index + 1}`} className={input} value={origin.name} onChange={event => setDraft(draft.map(item => item.id === origin.id ? { ...item, name: event.target.value } : item))} />
        <select aria-label={`Tipo da categoria ${index + 1}`} className={input} value={origin.kind} onChange={event => setDraft(draft.map(item => item.id === origin.id ? { ...item, kind: event.target.value as CreditMovementKind } : item))}>{Object.entries(CREDIT_MOVEMENTS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
        <button type="button" className="text-sm text-red-700 underline" onClick={() => setDraft(draft.filter(item => item.id !== origin.id))}>Excluir categoria</button>
      </div>)}
      <button type="button" className="text-sm underline" onClick={() => setDraft([...draft, { id: newId(), name: '', kind: 'receipt' }])}>Nova categoria</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><button type="button" className="rounded-xl bg-stone-900 px-3 py-2 text-sm text-white" onClick={() => {
        const clean = draft.map(origin => ({ ...origin, name: origin.name.trim() }));
        if (clean.some(origin => !origin.name)) { setError('Informe o nome de cada categoria.'); return; }
        if (new Set(clean.map(origin => normalized(origin.name))).size !== clean.length) { setError('Use nomes diferentes para as categorias.'); return; }
        onSave(clean); const selected = clean.find(origin => normalized(origin.name) === normalized(value)); if (selected) onKindChange(selected.kind); setDraft(null);
      }}>Salvar categorias</button><button type="button" className="text-sm underline" onClick={() => setDraft(null)}>Cancelar edição</button></div>
    </div>}
  </div>;
}
