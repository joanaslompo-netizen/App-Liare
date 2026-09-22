import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Factory,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { Material, Product, Purchase, Sale, TodoItem, NavTab } from '../types';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';

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
  onOpenSettings?: () => void;
}

// Redeploy marker: summary banner
export const HomeView: React.FC<HomeViewProps> = ({
  artisanName,
  atelierName,
  materials,
  products,
  sales,
  todos,
  onUpdateTodos,
  onNavigate,
  onOpenNewProduct,
  onOpenNewMaterial,
  onOpenNewSale,
}) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => !m.isVirtualRecipe && m.usageType !== 'durable' && !m.isPaused && m.minStock > 0 && m.currentStock <= m.minStock),
    [materials]
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => !p.isPaused && (p.minStock ?? 0) > 0 && (p.currentStock ?? 0) <= (p.minStock ?? 0)),
    [products]
  );

  const pendingDeliveries = useMemo(
    () => sales.filter((s) => s.deliveryStatus === 'pendente_entrega'),
    [sales]
  );

  const pendingPayments = useMemo(
    () => sales.filter((s) => s.paymentStatus === 'pendente_pagamento'),
    [sales]
  );

  const totalPendingPaymentAmount = useMemo(
    () => pendingPayments.reduce((acc, s) => acc + s.totalRevenue, 0),
    [pendingPayments]
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter((s) => s.date.startsWith(currentMonth));
  const monthRevenue = monthSales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const monthProfit = monthSales.reduce((acc, s) => acc + s.totalProfit, 0);
  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;
  const isMonthLoss = monthProfit < 0;

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  const completedTodosCount = todos.filter((t) => t.completed).length;
  const totalTodosCount = todos.length;
  const completionPercentage = totalTodosCount > 0
    ? Math.round((completedTodosCount / totalTodosCount) * 100)
    : 0;

  const filteredTodos = todos.filter((t) => {
    if (todoFilter === 'pending') return !t.completed;
    if (todoFilter === 'completed') return t.completed;
    return true;
  });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTodo: TodoItem = {
      id: `todo_${Date.now()}`,
      text: newTodoText.trim(),
      completed: false,
      priority: newTodoPriority,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onUpdateTodos([newTodo, ...todos]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id: string) => {
    onUpdateTodos(
      todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTodo = (id: string) => {
    onUpdateTodos(todos.filter((t) => t.id !== id));
  };

  const handleAddSuggestion = (text: string) => {
    if (todos.some((t) => t.text.toLowerCase() === text.toLowerCase())) return;
    const newTodo: TodoItem = {
      id: `todo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      completed: false,
      priority: 'normal',
      createdAt: new Date().toISOString().split('T')[0],
    };
    onUpdateTodos([newTodo, ...todos]);
  };

  const recentSales = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const totalLowStock = lowStockMaterials.length + lowStockProducts.length;

  const upcomingDeliveries = useMemo(
    () =>
      [...pendingDeliveries]
        .sort((a, b) => {
          const aDate = a.deliveryScheduledDate || '9999-12-31';
          const bDate = b.deliveryScheduledDate || '9999-12-31';
          return aDate.localeCompare(bDate);
        })
        .slice(0, 3),
    [pendingDeliveries]
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <section className="px-1 sm:px-0">
        <div className="grid grid-cols-[1fr_auto] items-start gap-4 sm:gap-8">
          <div className="min-w-0 pt-1">
            <div className="text-[11px] sm:text-xs font-medium text-[#8b817a] mb-1">
              {capitalizedDate}
            </div>
            <h2 className="text-[28px] sm:text-3xl leading-none font-bold text-[#2f2925] tracking-tight">
              Olá, {artisanName || 'Artesã'}
            </h2>
            <p className="text-[13px] sm:text-sm text-[#766b64] mt-2 leading-snug max-w-md">
              Um ateliê organizado acende grandes planos. ✦
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end sm:max-w-md pt-0.5">
            <button
              id="btn-home-quick-sale"
              onClick={onOpenNewSale ? onOpenNewSale : () => onNavigate('sales')}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#b96f55] hover:bg-[#a86149] text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Pedido</span>
            </button>
            <button
              id="btn-home-quick-production"
              onClick={() => onNavigate('productions')}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#eef1e6] hover:bg-[#e4e9d8] text-[#66704f] text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Factory className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Produção</span>
            </button>
            <button
              id="btn-home-quick-product"
              onClick={onOpenNewProduct ? onOpenNewProduct : () => onNavigate('products')}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/80 hover:bg-white text-[#5e5149] text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 border border-[#eadfd6] transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Receita</span>
            </button>
            <button
              id="btn-home-quick-material"
              onClick={onOpenNewMaterial ? onOpenNewMaterial : () => onNavigate('materials')}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/80 hover:bg-white text-[#5e5149] text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 border border-[#eadfd6] transition-colors cursor-pointer"
            >
              <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Material</span>
            </button>
          </div>
        </div>
      </section>
      <section
        onClick={() => onNavigate('reports')}
        className="rounded-[28px] sm:rounded-3xl bg-[#b96f55] text-white px-4.5 pt-4.5 pb-3.5 sm:p-6 shadow-sm cursor-pointer transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2 mb-3.5 sm:mb-5">
          <span className="text-[13px] sm:text-[15px] font-semibold text-white/90">
            Resumo do mês
          </span>
          <span className="text-[13px] sm:text-[15px] text-white/65">·</span>
          <span className="text-[13px] sm:text-[15px] font-semibold text-white/90">
            {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())}
          </span>
        </div>

        <div className="grid grid-cols-3">
          <div className="min-w-0 pr-2 sm:pr-5">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
              <div className="w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <span className="text-[12px] sm:text-[13px] text-white/75 whitespace-nowrap">
                Faturamento
              </span>
            </div>
            <strong className="block text-[21px] sm:text-[28px] leading-none font-semibold tracking-tight whitespace-nowrap">
              {formatCurrency(monthRevenue)}
            </strong>
          </div>

          <div className="min-w-0 px-2 sm:px-5 border-l border-white/20">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
              <div className="w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-full bg-[#e9efdc] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-[#65734f]" />
              </div>
              <span className="text-[12px] sm:text-[13px] text-white/75 whitespace-nowrap">
                Lucro
              </span>
            </div>
            <strong className="block text-[21px] sm:text-[28px] leading-none font-semibold tracking-tight whitespace-nowrap">
              {monthProfit > 0 ? '+' : ''}{formatCurrency(monthProfit)}
            </strong>
          </div>

          <div className="min-w-0 pl-2 sm:pl-5 border-l border-white/20">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
              <div className="w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <span className="text-[12px] sm:text-[13px] text-white/75 whitespace-nowrap">
                A receber
              </span>
            </div>
            <strong className="block text-[21px] sm:text-[28px] leading-none font-semibold tracking-tight whitespace-nowrap">
              {formatCurrency(totalPendingPaymentAmount)}
            </strong>
          </div>
        </div>

        <div className="mt-3.5 sm:mt-5 flex items-center gap-3 sm:gap-4">
          <div className="flex-1 h-2 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/90 transition-all"
              style={{ width: `${Math.max(4, Math.min(100, Math.abs(monthMargin)))}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-[12px] sm:text-[13px] text-white/85 whitespace-nowrap">
            <span>Margem {formatPercent(monthMargin)}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>
      <section className="bg-white rounded-3xl border border-[#eadfd6] p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#eef1e6] text-[#66704f] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#2f2925] tracking-tight">
                Próximas entregas a despachar
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('sales', 'pending_delivery')}
            className="text-[11px] sm:text-xs font-semibold text-[#a86149] hover:text-[#8b503c] flex items-center gap-1 cursor-pointer shrink-0"
          >
            Ver todos
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {upcomingDeliveries.length > 0 ? (
          <div className="divide-y divide-[#f0e7e0]">
            {upcomingDeliveries.map((sale) => {
              const scheduled = sale.deliveryScheduledDate
                ? new Date(`${sale.deliveryScheduledDate}T12:00:00`)
                : null;
              const day = scheduled
                ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(scheduled)
                : '--';
              const month = scheduled
                ? new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(scheduled).replace('.', '')
                : 'sem data';
              const imageUrl = sale.productImageUrl || sale.items?.[0]?.productImageUrl;
              const itemName = sale.productName || sale.items?.[0]?.productName || 'Pedido';
              const primaryItem = sale.items?.[0];
              const stockProductId = primaryItem
                ? (primaryItem.isCustom ? primaryItem.customProductId : primaryItem.productId)
                : sale.productId;
              const stockProduct = stockProductId
                ? products.find((product) => product.id === stockProductId)
                : undefined;
              const physicalStock = stockProduct?.currentStock ?? 0;
              const reservedQuantity = primaryItem?.reservedQuantity ?? 0;
              const requestedQuantity = primaryItem?.quantity ?? sale.quantity;
              const missingQuantity = Math.max(0, requestedQuantity - reservedQuantity);

              return (
                <button
                  type="button"
                  key={sale.id}
                  onClick={() => onNavigate('sales', 'pending_delivery')}
                  className="w-full py-2.5 sm:py-3 flex items-center gap-3 text-left cursor-pointer group"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#f7f2ed] flex flex-col items-center justify-center shrink-0">
                    <strong className="text-base sm:text-lg leading-none text-[#8b503c]">{day}</strong>
                    <span className="text-[10px] sm:text-[11px] text-[#766b64] mt-0.5 lowercase">{month}</span>
                  </div>

                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#f4eee9] overflow-hidden shrink-0 flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-[#a56d4f]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-semibold text-[#352f2b] block truncate">
                      {itemName}
                    </span>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <span className="text-[11px] sm:text-xs text-[#857970] truncate">
                        {sale.customerName || 'Cliente sem nome'}
                      </span>
                      <div
                        className="flex items-center gap-2.5 text-[11px] sm:text-xs font-bold shrink-0"
                        aria-label={`Estoque ${physicalStock}, reservado ${reservedQuantity}, faltam ${missingQuantity}`}
                      >
                        <span className="text-emerald-600" title="Estoque">{physicalStock}</span>
                        <span className="text-sky-600" title="Reservado">{reservedQuantity}</span>
                        <span className="text-rose-600" title="Faltam">{missingQuantity}</span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#7e746d] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#fbf8f5] border border-[#f0e7e0] py-6 px-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-[#788063] mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-[#5e5149]">Nenhuma entrega pendente.</p>
          </div>
        )}
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-3xl border border-[#eadfd6] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f0e7e0]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#352f2b] tracking-tight">Minhas tarefas</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5e8df] text-[#8b503c] font-semibold border border-[#ead4c8]">
                  {completedTodosCount}/{totalTodosCount} feitas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#f7f2ed] p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTodoFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${todoFilter === 'all' ? 'bg-white text-[#352f2b] font-semibold shadow-2xs' : 'text-[#766b64]'}`}
              >
                Todas ({todos.length})
              </button>
              <button
                type="button"
                onClick={() => setTodoFilter('pending')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${todoFilter === 'pending' ? 'bg-white text-[#352f2b] font-semibold shadow-2xs' : 'text-[#766b64]'}`}
              >
                Pendentes ({todos.filter((t) => !t.completed).length})
              </button>
              <button
                type="button"
                onClick={() => setTodoFilter('completed')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${todoFilter === 'completed' ? 'bg-white text-[#352f2b] font-semibold shadow-2xs' : 'text-[#766b64]'}`}
              >
                Concluídas ({completedTodosCount})
              </button>
            </div>
          </div>

          {totalTodosCount > 0 && (
            <div className="py-3">
              <div className="flex items-center justify-between text-xs text-[#857970] mb-1">
                <span>Progresso das tarefas</span>
                <span className="font-semibold text-[#5e5149]">{completionPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-[#f4eee9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#b96f55] transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          )}

          <form onSubmit={handleAddTodo} className="my-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="Adicionar nova tarefa..."
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              className="flex-1 bg-[#fbf8f5] border border-[#e5d8cf] focus:border-[#b96f55] focus:bg-white px-3.5 py-2.5 rounded-xl text-xs text-[#4d433d] placeholder-[#9d9189] outline-none transition-all shadow-2xs"
            />
            <select
              value={newTodoPriority}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTodoPriority(e.target.value as 'high' | 'normal' | 'low')}
              className="bg-[#fbf8f5] border border-[#e5d8cf] text-[#5e5149] text-xs px-2.5 py-2.5 rounded-xl outline-none"
              title="Prioridade da tarefa"
            >
              <option value="normal">Normal</option>
              <option value="high">Urgente 🔥</option>
              <option value="low">Baixa</option>
            </select>
            <button
              type="submit"
              disabled={!newTodoText.trim()}
              className="px-4 py-2.5 bg-[#b96f55] hover:bg-[#a86149] disabled:opacity-50 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </form>

          <div className="space-y-2 mt-4 max-h-[390px] overflow-y-auto pr-1">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-8 text-[#9d9189] border border-dashed border-[#e8ddd5] rounded-xl bg-[#fbf8f5]">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1.5 text-[#c9bbb1]" />
                <p className="text-xs font-medium">Nenhuma tarefa encontrada neste filtro.</p>
              </div>
            ) : (
              filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${todo.completed ? 'bg-[#faf7f4] border-[#ece3dc] opacity-65' : 'bg-white border-[#eadfd6] hover:border-[#c98a72] shadow-2xs'}`}
                >
                  <div
                    onClick={() => handleToggleTodo(todo.id)}
                    className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                  >
                    <button
                      type="button"
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${todo.completed ? 'bg-[#788063] text-white' : 'border-2 border-[#d5c8bf] hover:border-[#b96f55] text-transparent'}`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>

                    <div className="flex flex-col">
                      <span className={`text-xs ${todo.completed ? 'line-through text-[#a3978f]' : 'text-[#4d433d] font-medium'}`}>
                        {todo.text}
                      </span>
                      {todo.dueDate && (
                        <span className="text-[10px] text-[#9d9189] flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> Até {new Date(todo.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {todo.priority === 'high' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f7e2dc] text-[#934b3c]">Urgente</span>
                    )}
                    {todo.priority === 'low' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#f1eee9] text-[#766b64]">Baixa</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-[#aa9d94] hover:text-[#a24e40] p-1 transition-colors cursor-pointer"
                      title="Excluir tarefa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-[#f0e7e0]">
            <span className="text-[11px] font-semibold text-[#857970] uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#b96f55]" />
              Sugestões rápidas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Repor materiais com estoque baixo no fornecedor',
                'Precificar novos produtos e atualizar margens de lucro',
                'Cobrar recebimento dos pedidos pendentes',
                'Embalar encomendas e despachar aos clientes',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAddSuggestion(suggestion)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#f7f2ed] hover:bg-[#f1e4da] hover:text-[#8b503c] text-[#766b64] transition-colors cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#352f2b] tracking-tight">Lembretes do ateliê</h3>
            <p className="text-xs text-[#857970] mt-0.5">
              Seus três alertas já existentes, reunidos no mesmo lugar.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('sales', 'pending_payment')}
            className="w-full text-left bg-white rounded-2xl border border-[#eadfd6] p-5 shadow-xs hover:border-[#c98a72] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#eef1e6] text-[#6d7658] flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#352f2b]">Valores a receber</h4>
                  <p className="text-xs text-[#857970] mt-0.5">
                    {pendingPayments.length} {pendingPayments.length === 1 ? 'cliente pendente' : 'clientes pendentes'}
                  </p>
                </div>
              </div>
              <strong className="text-lg font-bold text-[#6d7658]">{formatCurrency(totalPendingPaymentAmount)}</strong>
            </div>
            {pendingPayments[0] && (
              <div className="mt-3 pt-3 border-t border-[#f0e7e0] flex items-center justify-between gap-3 text-xs">
                <span className="text-[#5e5149] truncate">
                  {pendingPayments[0].customerName || 'Cliente sem nome'}
                  {pendingPayments[0].paymentScheduledDate ? ` · cobrar em ${formatDate(pendingPayments[0].paymentScheduledDate)}` : ''}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#a86149] shrink-0" />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales', 'pending_delivery')}
            className="w-full text-left bg-white rounded-2xl border border-[#eadfd6] p-5 shadow-xs hover:border-[#c98a72] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f5e8df] text-[#a86149] flex items-center justify-center shrink-0">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#352f2b]">Pedidos a despachar</h4>
                  <p className="text-xs text-[#857970] mt-0.5">
                    {pendingDeliveries.length} {pendingDeliveries.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'}
                  </p>
                </div>
              </div>
              <strong className="text-lg font-bold text-[#a86149]">{pendingDeliveries.length}</strong>
            </div>
            {pendingDeliveries[0] && (
              <div className="mt-3 pt-3 border-t border-[#f0e7e0] flex items-center justify-between gap-3 text-xs">
                <span className="text-[#5e5149] truncate">
                  {pendingDeliveries[0].customerName || 'Cliente sem nome'}
                  {pendingDeliveries[0].deliveryScheduledDate ? ` · prazo ${formatDate(pendingDeliveries[0].deliveryScheduledDate)}` : ''}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#a86149] shrink-0" />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('materials')}
            className="w-full text-left bg-white rounded-2xl border border-[#eadfd6] p-5 shadow-xs hover:border-[#c98a72] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f6eadf] text-[#a56d4f] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#352f2b]">Estoque baixo</h4>
                  <p className="text-xs text-[#857970] mt-0.5">
                    {totalLowStock} {totalLowStock === 1 ? 'item pede atenção' : 'itens pedem atenção'}
                  </p>
                </div>
              </div>
              <strong className="text-lg font-bold text-[#a56d4f]">{totalLowStock}</strong>
            </div>
            {totalLowStock > 0 ? (
              <div className="mt-3 pt-3 border-t border-[#f0e7e0] flex items-center justify-between gap-3 text-xs">
                <span className="text-[#5e5149] truncate">
                  {lowStockMaterials[0]?.name || lowStockProducts[0]?.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#a86149] shrink-0" />
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-[#f0e7e0] text-xs text-[#6d7658] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Estoque dentro dos mínimos.
              </div>
            )}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-[#eadfd6] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f0e7e0]">
          <h3 className="text-xs font-bold text-[#352f2b] uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-[#766b64]" />
            Últimos pedidos
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="text-[11px] font-semibold text-[#a86149] hover:text-[#8b503c] cursor-pointer"
          >
            Ver todos
          </button>
        </div>

        {recentSales.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#fbf8f5] border border-[#f0e7e0] text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-[#352f2b] block truncate">{sale.productName}</span>
                  <span className="text-[11px] text-[#9d9189]">
                    {sale.customerName || sale.channel || 'Venda direta'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-[#352f2b] block">{formatCurrency(sale.totalRevenue)}</span>
                  <span className={`text-[10px] font-semibold ${sale.deliveryStatus === 'pendente_entrega' ? 'text-[#a86149]' : 'text-[#6d7658]'}`}>
                    {sale.deliveryStatus === 'pendente_entrega' ? 'A entregar' : 'Entregue'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#9d9189] text-center py-4">
            Nenhum pedido registrado ainda este mês.
          </p>
        )}
      </section>

      {isMonthLoss && (
        <div className="rounded-2xl border border-[#e9c8bd] bg-[#fbefeb] px-4 py-3 text-xs text-[#87493b] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 rotate-180 shrink-0" />
          O resultado do mês está negativo. Toque no resumo para abrir os relatórios.
        </div>
      )}
    </div>
  );
};
