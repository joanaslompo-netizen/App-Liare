import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Circle, 
  DollarSign, 
  Package, 
  Plus, 
  Tag, 
  TrendingUp, 
  Trash2, 
  Calendar, 
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Clock,
  Lightbulb,
  Check,
  Truck,
  CreditCard,
  Phone,
  AlertCircle,
  Factory
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
  // New task form state
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Low stock materials
  const lowStockMaterials = useMemo(
    () => materials.filter((m) => m.currentStock <= m.minStock),
    [materials]
  );

  // Low stock products / recipes
  const lowStockProducts = useMemo(
    () => products.filter((p) => (p.minStock ?? 0) > 0 && (p.currentStock ?? 0) <= (p.minStock ?? 0)),
    [products]
  );

  // Pending Deliveries & Payments
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

  // Month Financials
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthSales = sales.filter((s) => s.date.startsWith(currentMonth));
  const monthRevenue = monthSales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const monthProfit = monthSales.reduce((acc, s) => acc + s.totalProfit, 0);
  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;
  const isMonthLoss = monthProfit < 0;

  // Format today's date in Portuguese
  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Todo stats
  const completedTodosCount = todos.filter((t) => t.completed).length;
  const totalTodosCount = todos.length;
  const completionPercentage = totalTodosCount > 0 ? Math.round((completedTodosCount / totalTodosCount) * 100) : 0;

  // Filtered todos
  const filteredTodos = todos.filter((t) => {
    if (todoFilter === 'pending') return !t.completed;
    if (todoFilter === 'completed') return t.completed;
    return true;
  });

  // Add new todo
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

  // Toggle todo
  const handleToggleTodo = (id: string) => {
    const updated = todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    onUpdateTodos(updated);
  };

  // Delete todo
  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    onUpdateTodos(updated);
  };

  // Add quick preset suggestion
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

  // Recent sales (up to 4)
  const recentSales = [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{capitalizedDate}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Olá, {artisanName || 'Artesã'}! ✨
            </h2>
            <p className="text-sm text-stone-500 mt-1 max-w-2xl">
              Bem-vinda ao painel do <strong className="text-stone-700">{atelierName || 'seu ateliê'}</strong>. 
              Acompanhe pedidos a produzir, entregas programadas, cobranças e tarefas de hoje.
            </p>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-home-quick-sale"
              onClick={onOpenNewSale ? onOpenNewSale : () => onNavigate('sales')}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>+ Novo Pedido / Venda</span>
            </button>

            <button
              id="btn-home-quick-product"
              onClick={onOpenNewProduct ? onOpenNewProduct : () => onNavigate('products')}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Nova Receita</span>
            </button>

            <button
              id="btn-home-quick-material"
              onClick={onOpenNewMaterial ? onOpenNewMaterial : () => onNavigate('materials')}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Material</span>
            </button>

            <button
              id="btn-home-quick-production"
              onClick={() => onNavigate('productions')}
              className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Factory className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Lançar Produção</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Primary Summary Metric Cards (Including Pending Deliveries & Pending Payments) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pedidos Pendentes de Entrega */}
        <div 
          onClick={() => onNavigate('sales', 'pending_delivery')}
          className={`p-5 rounded-2xl border transition-all shadow-xs cursor-pointer group ${
            pendingDeliveries.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
              : 'bg-white border-stone-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-600" />
              Entregas Pendentes
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
              pendingDeliveries.length > 0 ? 'bg-amber-200/80 text-amber-900 font-bold text-xs' : 'bg-stone-100 text-stone-600'
            }`}>
              {pendingDeliveries.length}
            </div>
          </div>
          <div className="text-2xl font-extrabold text-stone-900 tracking-tight">
            {pendingDeliveries.length} {pendingDeliveries.length === 1 ? 'pedido a entregar' : 'pedidos a entregar'}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              {pendingDeliveries.length > 0 ? 'Com data programada' : 'Tudo entregue ✓'}
            </span>
            <span className="text-amber-800 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Ver pedidos <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Valores Pendentes de Pagamento */}
        <div 
          onClick={() => onNavigate('sales', 'pending_payment')}
          className={`p-5 rounded-2xl border transition-all shadow-xs cursor-pointer group ${
            pendingPayments.length > 0
              ? 'bg-rose-50/60 border-rose-300 hover:border-rose-400'
              : 'bg-white border-stone-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-rose-600" />
              Valores a Receber
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
              pendingPayments.length > 0 ? 'bg-rose-200 text-rose-900 font-bold text-xs' : 'bg-stone-100 text-stone-600'
            }`}>
              {pendingPayments.length}
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 tracking-tight">
            {formatCurrency(totalPendingPaymentAmount)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              {pendingPayments.length} {pendingPayments.length === 1 ? 'cliente pendente' : 'clientes pendentes'}
            </span>
            <span className="text-rose-800 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Cobranças <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Faturamento do Mês */}
        <div 
          onClick={() => onNavigate('sales')}
          className="bg-white p-5 rounded-2xl border border-stone-200 hover:border-amber-400 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento no Mês</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900 tracking-tight">
            {formatCurrency(monthRevenue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>{monthSales.length} {monthSales.length === 1 ? 'venda no mês' : 'vendas no mês'}</span>
            <span className="text-amber-700 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Histórico <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Lucro Líquido Real */}
        <div 
          onClick={() => onNavigate('reports')}
          className="bg-white p-5 rounded-2xl border border-stone-200 hover:border-amber-400 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isMonthLoss ? 'text-red-700' : 'text-emerald-800'}`}>Lucro Líquido Real</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${isMonthLoss ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${isMonthLoss ? 'text-red-600' : 'text-emerald-600'}`}>
            {monthProfit > 0 ? '+' : ''}{formatCurrency(monthProfit)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>Margem: <strong className={isMonthLoss ? 'text-red-600' : undefined}>{formatPercent(monthMargin)}</strong></span>
            <span className="text-amber-700 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Relatório <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Destaque Operacional: Pedidos com Entrega Programada & Cobranças a Vencer */}
      {(pendingDeliveries.length > 0 || pendingPayments.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box 1: Entregas Programadas */}
          <div className="bg-white rounded-2xl border border-amber-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Próximas Entregas a Despachar
                  </h4>
                  <span className="text-[11px] text-stone-500">
                    {pendingDeliveries.length} {pendingDeliveries.length === 1 ? 'pedido aguardando envio' : 'pedidos aguardando envio'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sales', 'pending_delivery')}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Ver todos
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {pendingDeliveries.slice(0, 3).map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900 truncate">
                        {item.customerName || 'Cliente sem nome'}
                      </span>
                      {item.customerContact && (
                        <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {item.customerContact}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-600 block mt-0.5">
                      {item.quantity}x {item.productName}
                    </span>
                    {item.deliveryScheduledDate && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Prazo: {formatDate(item.deliveryScheduledDate)}
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-stone-900 block">
                      {formatCurrency(item.totalRevenue)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('sales', 'pending_delivery')}
                      className="text-[10px] font-semibold text-amber-900 hover:underline cursor-pointer"
                    >
                      Gerenciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Box 2: Pagamentos a Receber */}
          <div className="bg-white rounded-2xl border border-rose-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-800 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Pagamentos a Receber
                  </h4>
                  <span className="text-[11px] text-stone-500">
                    Total em aberto: <strong>{formatCurrency(totalPendingPaymentAmount)}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sales', 'pending_payment')}
                className="text-xs font-bold text-rose-800 hover:text-rose-950 underline cursor-pointer"
              >
                Ver todos
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {pendingPayments.slice(0, 3).map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/60 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900 truncate">
                        {item.customerName || 'Cliente sem nome'}
                      </span>
                      {item.customerContact && (
                        <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {item.customerContact}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-600 block mt-0.5">
                      {item.quantity}x {item.productName}
                    </span>
                    {item.paymentScheduledDate && (
                      <span className="text-[10px] font-bold text-rose-900 bg-rose-200/60 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        Cobrar em: {formatDate(item.paymentScheduledDate)}
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-extrabold text-rose-700 block">
                      {formatCurrency(item.totalRevenue)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('sales', 'pending_payment')}
                      className="text-[10px] font-semibold text-rose-900 hover:underline cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Checklist & Alerts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Checklist de Afazeres do Ateliê */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header & Progress */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-stone-900 tracking-tight">
                    Afazeres & Tarefas do Ateliê
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                    {completedTodosCount}/{totalTodosCount} feitas
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Organize sua produção diária, encomendas a embalar e materiais a comprar.
                </p>
              </div>

              {/* Todo Filters */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTodoFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    todoFilter === 'all' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Todas ({todos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTodoFilter('pending')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    todoFilter === 'pending' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Pendentes ({todos.filter((t) => !t.completed).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTodoFilter('completed')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    todoFilter === 'completed' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Concluídas ({completedTodosCount})
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {totalTodosCount > 0 && (
              <div className="py-3">
                <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                  <span>Progresso das tarefas</span>
                  <span className="font-semibold text-stone-700">{completionPercentage}%</span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quick Add Form */}
            <form onSubmit={handleAddTodo} className="my-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Adicionar nova tarefa... (ex: Cortar 10 metros de fita, entregar pedido de Amanda)"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-300 focus:border-amber-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs text-stone-800 placeholder-stone-400 outline-none transition-all shadow-2xs"
              />
              <select
                value={newTodoPriority}
                onChange={(e: any) => setNewTodoPriority(e.target.value)}
                className="bg-stone-50 border border-stone-300 text-stone-700 text-xs px-2.5 py-2.5 rounded-xl outline-none"
                title="Prioridade da tarefa"
              >
                <option value="normal">Normal</option>
                <option value="high">Urgente 🔥</option>
                <option value="low">Baixa</option>
              </select>
              <button
                type="submit"
                disabled={!newTodoText.trim()}
                className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </form>

            {/* Todo Items List */}
            <div className="space-y-2 mt-4 max-h-[340px] overflow-y-auto pr-1">
              {filteredTodos.length === 0 ? (
                <div className="text-center py-8 text-stone-400 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-1.5 text-stone-300" />
                  <p className="text-xs font-medium">Nenhuma tarefa encontrada neste filtro.</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">Adicione afazeres acima para manter sua rotina organizada.</p>
                </div>
              ) : (
                filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      todo.completed
                        ? 'bg-stone-50/70 border-stone-200/60 opacity-65'
                        : 'bg-white border-stone-200 hover:border-amber-300 shadow-2xs'
                    }`}
                  >
                    <div 
                      onClick={() => handleToggleTodo(todo.id)}
                      className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                    >
                      <button
                        type="button"
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          todo.completed 
                            ? 'bg-emerald-600 text-white' 
                            : 'border-2 border-stone-300 hover:border-amber-500 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>

                      <div className="flex flex-col">
                        <span className={`text-xs ${todo.completed ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}`}>
                          {todo.text}
                        </span>
                        {todo.dueDate && (
                          <span className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" /> Até {new Date(todo.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {todo.priority === 'high' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                          Urgente
                        </span>
                      )}
                      {todo.priority === 'low' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                          Baixa
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Excluir tarefa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Sugestões rápidas de afazeres:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAddSuggestion('Repor materiais com estoque baixo no fornecedor')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-600 transition-colors cursor-pointer"
              >
                + Repor materiais baixos
              </button>
              <button
                type="button"
                onClick={() => handleAddSuggestion('Precificar novos produtos e atualizar margens de lucro')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-600 transition-colors cursor-pointer"
              >
                + Precificar novas receitas
              </button>
              <button
                type="button"
                onClick={() => handleAddSuggestion('Cobrar recebimento dos pedidos pendentes')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-600 transition-colors cursor-pointer"
              >
                + Cobrar pedidos a receber
              </button>
              <button
                type="button"
                onClick={() => handleAddSuggestion('Embalar encomendas e despachar aos correios/clientes')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-600 transition-colors cursor-pointer"
              >
                + Embalar encomendas
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Alertas Inteligentes & Dica */}
        <div className="space-y-6">
          {/* Alertas de Estoque & Produção */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alertas de Estoque
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                (lowStockMaterials.length + lowStockProducts.length) > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {lowStockMaterials.length + lowStockProducts.length} {(lowStockMaterials.length + lowStockProducts.length) === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {(lowStockMaterials.length + lowStockProducts.length) > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs text-stone-500">
                  Insumos e receitas que atingiram ou estão abaixo da quantidade mínima:
                </p>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {/* Materiais Baixos */}
                  {lowStockMaterials.map((mat) => (
                    <div 
                      key={mat.id}
                      className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-200/60 px-1.5 py-0.2 rounded">Insumo</span>
                          <span className="font-semibold text-stone-900 truncate" title={mat.name}>
                            {mat.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-rose-600 font-medium block mt-0.5">
                          Resta: {mat.currentStock} {mat.unit} (Mín: {mat.minStock} {mat.unit})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('materials')}
                        className="px-2 py-1 bg-white hover:bg-amber-100 text-stone-800 text-[11px] font-semibold rounded-lg border border-stone-300 shrink-0 cursor-pointer shadow-2xs"
                      >
                        Ver
                      </button>
                    </div>
                  ))}

                  {/* Produtos/Receitas Baixas */}
                  {lowStockProducts.map((prod) => (
                    <div 
                      key={prod.id}
                      className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/70 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.2 rounded">Receita</span>
                          <span className="font-semibold text-stone-900 truncate" title={prod.name}>
                            {prod.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-rose-700 font-medium block mt-0.5">
                          Estoque: {prod.currentStock ?? 0} un (Mín: {prod.minStock ?? 0} un)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('productions')}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] font-bold rounded-lg shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <Factory className="w-3 h-3" />
                        <span>Produzir</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('materials')}
                    className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl transition-colors text-center cursor-pointer"
                  >
                    Estoque Insumos
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('productions')}
                    className="py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-colors text-center cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Lançar Produção</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-emerald-50/50 rounded-xl border border-emerald-200/60 p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                <h4 className="text-xs font-bold text-emerald-950">Estoque Saudável</h4>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  Todos os insumos e receitas estão com estoque suficiente!
                </p>
              </div>
            )}
          </div>

          {/* Dica de Gestão & Precificação para o Ateliê */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/40 to-stone-100 rounded-2xl border border-amber-300/60 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-900 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Dica de Ouro do Ateliê
              </h4>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed">
              <strong>Sempre estipule datas de entrega e cobrança:</strong> ao aceitar encomendas personalizadas,
              definir prazos claros evita atrasos na produção e melhora a previsibilidade do seu fluxo de caixa!
            </p>
          </div>

          {/* Últimos Pedidos Recentes */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-stone-600" />
                Últimos Pedidos
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                Ver todos
              </button>
            </div>

            {recentSales.length > 0 ? (
              <div className="space-y-2">
                {recentSales.map((sale) => (
                  <div 
                    key={sale.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-stone-900 block truncate">
                        {sale.productName}
                      </span>
                      <span className="text-[11px] text-stone-400">
                        {sale.customerName ? `${sale.customerName}` : sale.channel || 'Venda direta'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-stone-900 block">
                        {formatCurrency(sale.totalRevenue)}
                      </span>
                      <span className={`text-[10px] font-semibold ${
                        sale.deliveryStatus === 'pendente_entrega' ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {sale.deliveryStatus === 'pendente_entrega' ? 'A entregar' : 'Entregue'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 text-center py-4">
                Nenhum pedido registrado ainda este mês.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
