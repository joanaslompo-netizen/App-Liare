import React, { useRef, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import type { DiscountCode, DiscountType } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { localDateString } from '../utils/localDate';

const field = 'mt-1 block w-full min-w-0 rounded-xl border border-[#e5dad1] bg-white px-3 py-2 text-base text-[#352f2b]';
const secondary = 'rounded-xl border border-[#e5dad1] px-3 py-2 text-sm font-semibold hover:bg-[#faf7f2]';
const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export function DiscountCodesView({ codes, onChange }: {
  codes: DiscountCode[];
  onChange: (codes: DiscountCode[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [amount, setAmount] = useState('10');
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEditingId(null);
    setName('');
    setType('percentage');
    setAmount('10');
    setError('');
  };

  const edit = (code: DiscountCode) => {
    setEditingId(code.id);
    setName(code.code);
    setType(code.type);
    setAmount(String(code.value));
    setError('');
    nameInput.current?.focus();
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeCode(name);
    const value = Number(amount);
    if (!code || !Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 100)) {
      setError('Informe o código e um valor de desconto válido.');
      return;
    }
    if (codes.some(item => item.id !== editingId && normalizeCode(item.code) === code)) {
      setError('Já existe um código de desconto com esse nome.');
      return;
    }

    if (editingId) {
      onChange(codes.map(item => item.id === editingId ? { ...item, code, type, value } : item));
    } else {
      onChange([...codes, {
        id: `discount_${crypto.randomUUID()}`,
        code,
        type,
        value,
        active: true,
        createdAt: localDateString(),
      }]);
    }
    reset();
  };

  return (
    <section aria-labelledby="discount-codes-heading" className="space-y-4">
      <h3 id="discount-codes-heading" className="text-xl font-semibold">Códigos de desconto</h3>
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-[#e5dad1] bg-white p-4 sm:p-5">
        <h4 className="font-semibold">{editingId ? 'Editar código' : 'Novo código'}</h4>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="text-sm">
            Código
            <input ref={nameInput} className={`${field} uppercase`} value={name} required placeholder="Ex.: PRESENTE30" onChange={event => setName(event.target.value)} />
          </label>
          <label className="text-sm">
            Tipo de desconto
            <select className={field} value={type} onChange={event => setType(event.target.value as DiscountType)}>
              <option value="percentage">Porcentagem</option>
              <option value="fixed">Valor em R$</option>
            </select>
          </label>
          <label className="text-sm">
            {type === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
            <input className={field} type="number" required min="0.01" step="0.01" max={type === 'percentage' ? 100 : undefined} value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded-xl bg-[#a86149] px-4 py-2 text-sm font-semibold text-white hover:bg-[#92533c]">
            {editingId ? 'Salvar alteração' : 'Adicionar código'}
          </button>
          {editingId && <button type="button" className={secondary} onClick={reset}>Cancelar edição</button>}
        </div>
      </form>
      {codes.length === 0 ? (
        <p className="text-sm text-[#75665c]">Nenhum código cadastrado.</p>
      ) : (
        <ul aria-label="Códigos cadastrados" className="space-y-2">
          {codes.map(code => (
            <li key={code.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dad1] bg-white p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="[overflow-wrap:anywhere]">{code.code}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${code.active === false ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {code.active === false ? 'Pausado' : 'Ativo'}
                  </span>
                </div>
                <p className="text-sm text-[#75665c]">
                  {code.type === 'percentage' ? `${formatNumber(code.value)}%` : formatCurrency(code.value)} de desconto
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => edit(code)} aria-label={`Editar código ${code.code}`} className={secondary}>
                  <Edit2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={secondary} onClick={() => onChange(codes.map(item =>
                  item.id === code.id ? { ...item, active: item.active === false } : item
                ))}>
                  {code.active === false ? 'Ativar' : 'Pausar'}
                </button>
                <button type="button" aria-label={`Excluir código ${code.code}`} className={`${secondary} text-rose-700`} onClick={() => {
                  onChange(codes.filter(item => item.id !== code.id));
                  if (editingId === code.id) reset();
                }}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
