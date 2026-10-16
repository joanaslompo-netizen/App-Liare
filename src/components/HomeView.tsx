import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown,
  CreditCard, Factory, Package, Plus, ShoppingCart, SlidersHorizontal,
  Sparkles, Trash2, Truck, type LucideIcon,
} from 'lucide-react';
import { Material, Product, Purchase, Sale, TodoItem, NavTab } from '../types';
import { isActiveOrder, orderItems } from '../utils/financeLedger';
import { localDateString } from '../utils/localDate';
import { getInvoiceTotals } from '../utils/invoice';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';
import { getSaleFinancials } from '../utils/financials';

interface HomeViewProps {
  artisanName: string;
  atelierName: string;
  materials: Material[];
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  todos: TodoItem[];
  onUpdateTodos: (todos: TodoItem[]) => void;
  onNavigate: (tab: NavTab, filter?: string) => void;
  onOpenNewProduct?: () => void;
  onOpenNewMaterial?: () => void;
  onOpenNewSale?: () => void;
  onOpenNewPurchase?: () => void;
  onOpenProduction?: (product?: Product) => void;
  onOpenSettings?: () => void;
  onOpenSale?: (saleId: string, focus?: 'payment' | 'delivery' | 'production') => void;
}

const panelClass = 'rounded-2xl border border-[#e5dad1] bg-white p-5 shadow-xs';
const rowClass = 'group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#faf5f0] focus-visible:outline-2 focus-visible:outline-[#a86149]';
const linkClass = 'inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold text-[#92553f] hover:text-[#6f3e2d] focus-visible:outline-2 focus-visible:outline-[#a86149]';
const suggestions = [
  'Repor materiais com estoque baixo no fornecedor',
  'Precificar novos produtos e atualizar margens de lucro',
  'Cobrar recebimento dos pedidos pendentes',
  'Embalar encomendas e despachar aos clientes',
];

function PanelHeading({ icon: Icon, title, count, children }: {
  icon: LucideIcon; title: string; count?: number; children?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4eee7] text-[#94634c]"><Icon className="h-4 w-4" /></span>
        <h3 className="text-base font-bold tracking-tight text-[#352f2b]">{title}</h3>
        {count != null && <span className="rounded-full bg-[#f4eee7] px-2 py-0.5 text-xs font-semibold text-[#6f5b4f]">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-2 px-2 py-4 text-sm text-[#687153]"><CheckCircle2 className="h-4 w-4 shrink-0" />{children}</p>;
}

function MoreRows({ expanded, count, onClick }: { expanded: boolean; count: number; onClick: () => void }) {
  if (count <= 4) return null;
  return <button type="button" onClick={onClick} aria-expanded={expanded} className={`${linkClass} mt-2`}>
    {expanded ? 'Mostrar menos' : `Ver mais ${count - 4}`}<ChevronDown className={`h-3.5 w-3.5 ${expanded ? 'rotate-180' : ''}`} />
  </button>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  artisanName, materials, products, sales, todos, onUpdateTodos,
  onNavigate, onOpenNewSale, onOpenNewPurchase, onOpenProduction, onOpenSale,
}) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [todoFilter, setTodoFilter] = useState<'pending' | 'completed'>('pending');
  const [showProduction, setShowProduction] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const today = localDateString();

  const lowStockMaterials = useMemo(() => materials.filter(m =>
    !m.isVirtualRecipe && m.usageType !== 'durable' && !m.isPaused && m.minStock > 0 && m.currentStock <= m.minStock
  ), [materials]);
  const restockProducts = useMemo(() => products.filter(p =>
    !p.isPaused && (p.minStock ?? 0) > 0 && (p.currentStock ?? 0) <= (p.minStock ?? 0)
  ).map(product => ({ product, quantity: Math.max(0, (product.standardStock || product.minStock || 0) - (product.currentStock || 0)) }))
    .filter(item => item.quantity > 0), [products]);

  const pendingDeliveries = useMemo(() => sales.filter(s => isActiveOrder(s) && s.deliveryStatus !== 'entregue')
    .sort((a, b) => (a.deliveryScheduledDate || '9999-12-31').localeCompare(b.deliveryScheduledDate || '9999-12-31')), [sales]);
  const pendingPayments = useMemo(() => sales.filter(s => isActiveOrder(s) && s.paymentStatus === 'pendente_pagamento' && getInvoiceTotals(s).balance > 0)
    .sort((a, b) => (a.paymentScheduledDate || '9999-12-31').localeCompare(b.paymentScheduledDate || '9999-12-31')), [sales]);
  const totalPendingPaymentAmount = pendingPayments.reduce((sum, sale) => sum + getInvoiceTotals(sale).balance, 0);
  const overdueDeliveries = pendingDeliveries.filter(s => s.deliveryScheduledDate && s.deliveryScheduledDate < today).length;
  const currentMonth = today.slice(0, 7);
  const monthSales = sales.filter(s => isActiveOrder(s) && s.date.startsWith(currentMonth));
  const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
  const monthProfit = monthSales.reduce((sum, sale) => sum + getSaleFinancials(sale, products).ownerEarnings, 0);
  const monthMargin = monthRevenue > 0 ? monthProfit / monthRevenue * 100 : 0;
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  // Keep each need linked to its order, so clicking a row opens the correct record.
  const productionNeeds = useMemo(() => {
    const needs: { key: string; name: string; quantity: number; sale: Sale }[] = [];
    for (const sale of sales.filter(isActiveOrder)) {
      const byProduct = new Map<string, { key: string; name: string; quantity: number; sale: Sale }>();
      for (const item of orderItems(sale)) {
        const delivered = (item.deliveredQuantity ?? item.stockConsumedQuantity ?? (sale.deliveryStatus === 'entregue' ? item.quantity : 0)) - (item.returnedQuantity || 0);
        const missing = Math.max(0, item.quantity - delivered - (item.reservedQuantity || 0));
        if (!missing) continue;
        const key = item.isCustom ? item.customProductId || item.id || sale.id : item.productId;
        const previous = byProduct.get(key);
        byProduct.set(key, { key: `${sale.id}:${key}`, name: item.productName, quantity: (previous?.quantity || 0) + missing, sale });
      }
      needs.push(...byProduct.values());
    }
    return needs.sort((a, b) => (a.sale.deliveryScheduledDate || '9999-12-31').localeCompare(b.sale.deliveryScheduledDate || '9999-12-31'));
  }, [sales]);

  const completedTodosCount = todos.filter(t => t.completed).length;
  const filteredTodos = todos.filter(t => todoFilter === 'completed' ? t.completed : !t.completed);
  const openSale = (sale: Sale, filter: 'pending_delivery' | 'pending_payment' | 'production' = 'pending_delivery') =>
    onOpenSale ? onOpenSale(sale.id, filter === 'pending_payment' ? 'payment' : filter === 'production' ? 'production' : 'delivery') : onNavigate('sales', filter === 'production' ? 'all' : filter);
  const openProduction = (product?: Product) => onOpenProduction ? onOpenProduction(product) : onNavigate('productions');

  const addTodo = (text: string, priority: 'high' | 'normal' | 'low' = 'normal') => {
    if (!text.trim()) return;
    onUpdateTodos([{ id: `todo_${crypto.randomUUID()}`, text: text.trim(), priority, completed: false, createdAt: today }, ...todos]);
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="mb-1 text-xs font-medium capitalize text-[#74675f]">{dateLabel}</p>
          <h2 className="text-3xl font-bold tracking-tight text-[#302a25]">Olá, {artisanName || 'Artesã'}</h2>
          <p className="mt-1.5 text-sm text-[#74675f]">Tudo o que precisa de atenção no ateliê.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button id="btn-home-quick-sale" type="button" onClick={() => onOpenNewSale ? onOpenNewSale() : onNavigate('sales')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b96f55] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a15e47]"><Plus className="h-4 w-4" />Novo pedido</button>
          <button id="btn-home-quick-production" type="button" onClick={() => openProduction()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dce1d1] bg-[#eef1e6] px-3.5 py-2.5 text-sm font-semibold text-[#52603e] hover:bg-[#e4e9d8]"><Factory className="h-4 w-4" />Registrar produção</button>
          <button id="btn-home-quick-purchase" type="button" onClick={() => onOpenNewPurchase ? onOpenNewPurchase() : onNavigate('purchases')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5dad1] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#57493f] hover:bg-[#faf5f0]"><ShoppingCart className="h-4 w-4" />Registrar compra</button>
          <button id="btn-home-quick-stock" type="button" onClick={() => onNavigate('materials')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5dad1] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#57493f] hover:bg-[#faf5f0]"><SlidersHorizontal className="h-4 w-4" />Ajustar estoque</button>
        </div>
      </section>

      <section aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => onNavigate('reports')} className="rounded-2xl border border-[#e5dad1] bg-white px-5 py-4 text-left transition-colors hover:border-[#c98a72]">
          <span className="block text-xs font-semibold text-[#74675f]">Pedidos de {monthLabel}</span>
          <strong className="mt-1 block text-2xl font-bold tracking-tight text-[#352f2b]">{formatCurrency(monthRevenue)}</strong>
          <span className="mt-1 block text-xs text-[#74675f]">Valor contratado no mês</span>
        </button>
        <button type="button" onClick={() => onNavigate('reports')} className="rounded-2xl border border-[#dfc5b8] bg-[#f3e4da] px-5 py-4 text-left transition-colors hover:border-[#b96f55]">
          <span className="block text-xs font-semibold text-[#80503c]">Quanto fica para você · estimado</span>
          <strong className={`mt-1 block text-2xl font-bold tracking-tight ${monthProfit < 0 ? 'text-[#a44132]' : 'text-[#75452f]'}`}>{formatCurrency(monthProfit)}</strong>
          <span className="mt-1 block text-xs text-[#80503c]">Inclui sua remuneração · margem {formatPercent(monthMargin)}</span>
        </button>
        <button type="button" onClick={() => onNavigate('sales', 'pending_payment')} className="rounded-2xl border border-[#dce1d1] bg-[#f1f3ec] px-5 py-4 text-left transition-colors hover:border-[#94a17e]">
          <span className="block text-xs font-semibold text-[#5d684b]">Total a receber</span>
          <strong className="mt-1 block text-2xl font-bold tracking-tight text-[#52603e]">{formatCurrency(totalPendingPaymentAmount)}</strong>
          <span className="mt-1 block text-xs text-[#5d684b]">{pendingPayments.length} {pendingPayments.length === 1 ? 'pedido com saldo' : 'pedidos com saldo'} · todos os meses</span>
        </button>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className={panelClass}>
            <PanelHeading icon={Truck} title="Próximas entregas" count={pendingDeliveries.length}>
              <button type="button" onClick={() => onNavigate('sales', 'pending_delivery')} className={linkClass}>Ver todos<ArrowRight className="h-3.5 w-3.5" /></button>
            </PanelHeading>
            {overdueDeliveries > 0 && <p className="mb-1 px-2 text-xs font-semibold text-[#a44132]">{overdueDeliveries} {overdueDeliveries === 1 ? 'entrega atrasada' : 'entregas atrasadas'}</p>}
            {pendingDeliveries.length ? <div className="divide-y divide-[#f0e7e0]">{pendingDeliveries.slice(0, 4).map(sale => {
              const date = sale.deliveryScheduledDate;
              const late = !!date && date < today;
              const firstItem = orderItems(sale)[0];
              const name = firstItem?.productName || sale.productName || 'Pedido';
              const remaining = orderItems(sale).reduce((sum, item) => sum + Math.max(0, item.quantity - ((item.deliveredQuantity ?? item.stockConsumedQuantity ?? 0) - (item.returnedQuantity || 0))), 0);
              return <button type="button" key={sale.id} onClick={() => openSale(sale)} className={rowClass}>
                <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${late ? 'bg-[#fbeae4] text-[#a44132]' : 'bg-[#f4eee7] text-[#80503c]'}`}>
                  <strong className="text-lg leading-none">{date ? date.slice(8, 10) : '—'}</strong>
                  <span className="mt-1 text-[10px]">{date ? new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '') : 'sem data'}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#352f2b]">{sale.customerName || 'Cliente sem nome'}<span className="ml-2 font-normal text-[#74675f]">{sale.orderNumber ? `#${sale.orderNumber}` : ''}</span></span>
                  <span className="mt-0.5 block truncate text-xs text-[#675a51]" title={name}>{name}{sale.items && sale.items.length > 1 ? ` + ${sale.items.length - 1} item(ns)` : ''}</span>
                  <span className={`mt-1 block text-xs ${late ? 'font-semibold text-[#a44132]' : 'text-[#74675f]'}`}>{late ? 'Atrasada · ' : date === today ? 'Hoje · ' : ''}{date ? formatDate(date) : 'Prazo não definido'} · {remaining} un a entregar</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#a86149]" />
              </button>;
            })}</div> : <EmptyState>Nenhuma entrega pendente.</EmptyState>}
          </section>

          <section className={panelClass}>
            <PanelHeading icon={Factory} title="Produzir · encomendas" count={productionNeeds.length} />
            <p className="mb-1 px-2 text-xs text-[#74675f]">Peças que faltam separar para os pedidos. Abra para organizar a produção.</p>
            {productionNeeds.length ? <div className="divide-y divide-[#f0e7e0]">{(showProduction ? productionNeeds : productionNeeds.slice(0, 4)).map(need => <button type="button" key={need.key} onClick={() => openSale(need.sale, 'production')} className={rowClass}>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#352f2b]">{need.name}</span><span className="mt-1 block text-xs text-[#74675f]">{need.sale.customerName || 'Cliente sem nome'}{need.sale.deliveryScheduledDate ? ` · ${formatDate(need.sale.deliveryScheduledDate)}` : ''}</span></span>
              <strong className="shrink-0 rounded-lg bg-[#eef1e6] px-2 py-1 text-sm text-[#52603e]">{need.quantity} un</strong><ArrowRight className="h-4 w-4 shrink-0 text-[#a86149]" />
            </button>)}</div> : <EmptyState>Pedidos sem falta de peças.</EmptyState>}
            <MoreRows count={productionNeeds.length} expanded={showProduction} onClick={() => setShowProduction(!showProduction)} />
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className={panelClass}>
            <PanelHeading icon={CreditCard} title="Contas a receber" count={pendingPayments.length}>
              <button type="button" onClick={() => onNavigate('sales', 'pending_payment')} className={linkClass}>Ver todos<ArrowRight className="h-3.5 w-3.5" /></button>
            </PanelHeading>
            {pendingPayments.length ? <div className="divide-y divide-[#f0e7e0]">{pendingPayments.slice(0, 3).map(sale => <button type="button" key={sale.id} onClick={() => openSale(sale, 'pending_payment')} className={rowClass}>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#352f2b]">{sale.customerName || 'Cliente sem nome'}</span><span className="mt-1 block text-xs text-[#74675f]">Pedido {sale.orderNumber || 'sem número'}{sale.paymentScheduledDate ? ` · ${formatDate(sale.paymentScheduledDate)}` : ''}</span></span>
              <strong className="shrink-0 text-sm text-[#52603e]">{formatCurrency(getInvoiceTotals(sale).balance)}</strong>
            </button>)}</div> : <EmptyState>Nenhum saldo pendente.</EmptyState>}
          </section>

          <section className={panelClass}>
            <PanelHeading icon={Package} title="Repor pronta-entrega" count={restockProducts.length} />
            {restockProducts.length ? <div className="divide-y divide-[#f0e7e0]">{(showRestock ? restockProducts : restockProducts.slice(0, 4)).map(({ product, quantity }) => <button type="button" key={product.id} onClick={() => openProduction(product)} className={rowClass}>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[#352f2b]">{product.name}</span><span className="mt-1 block text-xs text-[#74675f]">Em estoque: {product.currentStock || 0} un · registrar produção</span></span>
              <strong className="shrink-0 rounded-lg bg-[#f4eee7] px-2 py-1 text-sm text-[#80503c]">{quantity} un</strong>
            </button>)}</div> : <EmptyState>Nenhuma reposição pendente.</EmptyState>}
            <MoreRows count={restockProducts.length} expanded={showRestock} onClick={() => setShowRestock(!showRestock)} />
          </section>

          <section className={panelClass}>
            <PanelHeading icon={AlertTriangle} title="Insumos em baixa" count={lowStockMaterials.length}>
              <button type="button" onClick={() => onNavigate('materials', 'low_stock')} className={linkClass}>Ver estoque<ArrowRight className="h-3.5 w-3.5" /></button>
            </PanelHeading>
            {lowStockMaterials.length ? <div className="divide-y divide-[#f0e7e0]">{(showMaterials ? lowStockMaterials : lowStockMaterials.slice(0, 4)).map(material => <div key={material.id} className="flex items-center justify-between gap-3 px-2 py-2.5">
              <span className="min-w-0 text-sm text-[#352f2b]">{material.name}</span><strong className="shrink-0 text-xs text-[#94634c]">{material.currentStock.toLocaleString('pt-BR')} {material.unit}</strong>
            </div>)}</div> : <EmptyState>Insumos dentro dos mínimos.</EmptyState>}
            <MoreRows count={lowStockMaterials.length} expanded={showMaterials} onClick={() => setShowMaterials(!showMaterials)} />
          </section>
        </div>
      </div>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading icon={CheckCircle2} title="Minhas tarefas" count={todos.length - completedTodosCount} />
          <div className="mb-2 flex gap-1 rounded-xl bg-[#f4eee7] p-1 text-xs">
            {(['pending', 'completed'] as const).map(filter => <button key={filter} type="button" aria-pressed={todoFilter === filter} onClick={() => setTodoFilter(filter)} className={`rounded-lg px-3 py-1.5 font-semibold ${todoFilter === filter ? 'bg-white text-[#352f2b] shadow-xs' : 'text-[#74675f]'}`}>{filter === 'pending' ? `Pendentes (${todos.length - completedTodosCount})` : `Concluídas (${completedTodosCount})`}</button>)}
          </div>
        </div>
        <form onSubmit={event => { event.preventDefault(); addTodo(newTodoText, newTodoPriority); setNewTodoText(''); setTodoFilter('pending'); }} className="mb-3 flex flex-wrap gap-2">
          <input aria-label="Nova tarefa" placeholder="Adicionar nova tarefa..." value={newTodoText} onChange={event => setNewTodoText(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#e5dad1] bg-[#fbf8f5] px-3 py-2.5 text-sm outline-none focus:border-[#b96f55]" />
          <select aria-label="Prioridade da tarefa" value={newTodoPriority} onChange={event => setNewTodoPriority(event.target.value as typeof newTodoPriority)} className="rounded-xl border border-[#e5dad1] bg-[#fbf8f5] px-2 py-2 text-sm text-[#57493f]"><option value="normal">Normal</option><option value="high">Urgente</option><option value="low">Baixa</option></select>
          <button type="submit" disabled={!newTodoText.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#b96f55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a15e47] disabled:opacity-50"><Plus className="h-4 w-4" />Adicionar</button>
        </form>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {filteredTodos.length ? filteredTodos.map(todo => <div key={todo.id} className="flex items-center gap-3 rounded-xl border border-[#e5dad1] px-3 py-2.5">
            <button type="button" role="checkbox" aria-checked={todo.completed} aria-label={`${todo.completed ? 'Reabrir' : 'Concluir'} tarefa: ${todo.text}`} onClick={() => onUpdateTodos(todos.map(item => item.id === todo.id ? { ...item, completed: !item.completed } : item))} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${todo.completed ? 'border-[#788063] bg-[#788063] text-white' : 'border-[#b9aaa0] text-transparent hover:border-[#b96f55]'}`}><Check className="h-3.5 w-3.5" /></button>
            <span className="min-w-0 flex-1"><span className={`block text-sm ${todo.completed ? 'text-[#74675f] line-through' : 'text-[#352f2b]'}`}>{todo.text}</span>{todo.dueDate && <span className="mt-0.5 block text-xs text-[#74675f]">Até {formatDate(todo.dueDate)}</span>}</span>
            {todo.priority === 'high' && !todo.completed && <span className="rounded-md bg-[#fbeae4] px-2 py-1 text-xs font-semibold text-[#a44132]">Urgente</span>}
            <button type="button" title="Excluir tarefa" aria-label={`Excluir tarefa: ${todo.text}`} onClick={() => onUpdateTodos(todos.filter(item => item.id !== todo.id))} className="rounded-lg p-2 text-[#8a7a70] hover:bg-[#fbeae4] hover:text-[#a44132]"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>) : <EmptyState>{todoFilter === 'pending' ? 'Nenhuma tarefa pendente.' : 'Nenhuma tarefa concluída.'}</EmptyState>}
        </div>
        <details className="mt-3 border-t border-[#f0e7e0] pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-[#74675f]">Sugestões de tarefas</summary>
          <div className="mt-3 flex flex-wrap gap-2">{suggestions.map(text => <button type="button" key={text} onClick={() => { if (!todos.some(todo => todo.text.toLowerCase() === text.toLowerCase())) addTodo(text); }} className="inline-flex items-center gap-1 rounded-lg bg-[#f4eee7] px-2.5 py-2 text-xs text-[#675a51] hover:bg-[#f3e4da]"><Sparkles className="h-3 w-3" />{text}</button>)}</div>
        </details>
      </section>
      {monthProfit < 0 && <p className="rounded-xl border border-[#e9c8bd] bg-[#fbefeb] px-4 py-3 text-sm text-[#87493b]">A estimativa dos pedidos do mês está negativa. Abra os relatórios para conferir os custos.</p>}
    </div>
  );
};
