import React from 'react';
import { ArrowRight, BarChart3, LayoutDashboard, Store, Tag, Wallet } from 'lucide-react';
import type { NavTab } from '../types';

const sections = [
  { id: 'reports' as const, label: 'Relatórios', description: 'Acompanhe vendas, custos e resultados.', icon: BarChart3 },
  { id: 'finance' as const, label: 'Financeiro', description: 'Cuide do caixa, contas, cartões e créditos.', icon: Wallet },
  { id: 'consignments' as const, label: 'Consignações', description: 'Confira estoques nos parceiros, comissões e repasses.', icon: Store },
  { id: 'discount-codes' as const, label: 'Códigos de desconto', description: 'Cadastre os códigos que você usa nos pedidos.', icon: Tag },
];
export type ManagementSection = (typeof sections)[number]['id'];
export const isManagementTab = (tab: NavTab): tab is ManagementSection | 'management' =>
  tab === 'management' || sections.some(section => section.id === tab);

export function ManagementView({ section, onSelect, children }: {
  section: ManagementSection | null; onSelect: (section: ManagementSection | null) => void; children?: React.ReactNode;
}) {
  return <section aria-label="Gestão do ateliê" className="liare-management min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-bold"><LayoutDashboard className="h-6 w-6 text-[#a86149]" />Gestão</h2>
      {section && <button type="button" onClick={() => onSelect(null)} className="rounded-xl border border-[#e5dad1] bg-white px-3 py-2 text-sm font-semibold text-[#75665c]">Visão geral</button>}
    </header>
    {section ? <>
      <div role="tablist" aria-label="Áreas da gestão" className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e5dad1] bg-white p-2 sm:grid-cols-4">
        {sections.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" role="tab" id={`management-tab-${id}`} aria-controls="management-panel" aria-selected={section === id} tabIndex={section === id ? 0 : -1}
          onClick={() => { if (section !== id) onSelect(id); }} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null;
            if (next == null) return; event.preventDefault();
            (event.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus();
            if (section !== sections[next].id) onSelect(sections[next].id);
          }} className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm ${section === id ? 'bg-[#f3e4da] text-[#80503c]' : 'text-stone-500 hover:bg-[#faf7f2]'}`}>
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{label}</span>
        </button>)}
      </div>
      <div id="management-panel" role="tabpanel" aria-labelledby={`management-tab-${section}`} className="min-w-0">{children}</div>
    </> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {sections.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" aria-label={label} onClick={() => onSelect(id)} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-[#e5dad1] bg-white p-5 text-left transition-colors hover:border-[#b96f55] md:flex-col md:items-start md:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4eee7] text-[#a86149]"><Icon aria-hidden="true" className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-[#352f2b]">{label}</span><span className="mt-1 block text-sm text-stone-500">{description}</span></span>
        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a86149]" />
      </button>)}
    </div>}
  </section>;
}
