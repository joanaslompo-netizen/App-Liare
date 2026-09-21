import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Cake, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  MessageCircle, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Tag, 
  CreditCard,
  Layers,
  ChevronRight,
  ExternalLink,
  Percent
} from 'lucide-react';
import { Customer, Sale, Product, DiscountCode } from '../types';
import { 
  formatCurrency, 
  formatDate, 
  formatBirthday, 
  isBirthdayInMonth 
} from '../utils/formatters';

interface CustomersViewProps {
  customers: Customer[];
  sales: Sale[];
  products: Product[];
  discountCodes: DiscountCode[];
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onNavigateToNewOrderWithCustomer?: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  sales,
  products,
  discountCodes,
  onSaveCustomer,
  onDeleteCustomer,
  onNavigateToNewOrderWithCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'birthdays_month' | 'has_purchases' | 'no_purchases'>('all');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingHistoryCustomer, setViewingHistoryCustomer] = useState<Customer | null>(null);

  // Current month for birthday tracking (1-indexed: 1 = Jan, 9 = Sep, etc.)
  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, []);
  const currentMonthName = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  }, []);

  // Map customer sales
  const customerSalesMap = useMemo(() => {
    const map = new Map<string, Sale[]>();
    customers.forEach((c) => map.set(c.id, []));

    sales.forEach((sale) => {
      if (sale.customerId && map.has(sale.customerId)) {
        map.get(sale.customerId)!.push(sale);
      } else if (sale.customerName) {
        // Fallback match by exact or close name if customerId was omitted
        const matched = customers.find(
          (c) => c.name.trim().toLowerCase() === sale.customerName?.trim().toLowerCase()
        );
        if (matched && map.has(matched.id)) {
          map.get(matched.id)!.push(sale);
        }
      }
    });

    // Sort sales for each customer by date desc
    map.forEach((list) => {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return map;
  }, [customers, sales]);

  // Birthday customers this month
  const birthdayCustomersThisMonth = useMemo(() => {
    return customers.filter((c) => isBirthdayInMonth(c.birthdate, currentMonthNumber));
  }, [customers, currentMonthNumber]);

  // Overall KPIs
  const totalCustomersCount = customers.length;

  const totalSpentAllCustomers = useMemo(() => {
    return sales.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);
  }, [sales]);

  const averageTicketPerCustomer = useMemo(() => {
    if (totalCustomersCount === 0) return 0;
    return totalSpentAllCustomers / totalCustomersCount;
  }, [totalSpentAllCustomers, totalCustomersCount]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Tab filter
        if (filterType === 'birthdays_month' && !isBirthdayInMonth(c.birthdate, currentMonthNumber)) {
          return false;
        }
        const custSales = customerSalesMap.get(c.id) || [];
        if (filterType === 'has_purchases' && custSales.length === 0) {
          return false;
        }
        if (filterType === 'no_purchases' && custSales.length > 0) {
          return false;
        }

        // Search term matching
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // If filtering by birthday, sort by day of the month, then A-Z
        if (filterType === 'birthdays_month') {
          const dayA = a.birthdate ? parseInt(a.birthdate.split('-')[2] || '0', 10) : 0;
          const dayB = b.birthdate ? parseInt(b.birthdate.split('-')[2] || '0', 10) : 0;
          if (dayA !== dayB) return dayA - dayB;
        }
        // Standard rule: sort all customers alphabetically from A to Z
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [customers, searchTerm, filterType, currentMonthNumber, customerSalesMap]);

  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  };

  const handleOpenHistory = (customer: Customer) => {
    setViewingHistoryCustomer(customer);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
              Clientes do Ateliê
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
              {totalCustomersCount} {totalCustomersCount === 1 ? 'cadastrado' : 'cadastrados'}
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            Cadastro de contatos, aniversários e histórico detalhado das compras realizadas.
          </p>
        </div>

        <button
          id="btn-add-customer"
          onClick={handleOpenNewCustomer}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-98"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-stone-500 block font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-stone-400" /> Total de Clientes
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-1 block tracking-tight">
            {totalCustomersCount}
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Base ativa de compradores
          </span>
        </div>

        {/* Aniversariantes do Mês Card */}
        <div 
          onClick={() => setFilterType('birthdays_month')}
          className={`p-4.5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            birthdayCustomersThisMonth.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:bg-amber-50'
              : 'bg-white border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-amber-900 block font-bold flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5 text-amber-600" /> Aniversários em {currentMonthName}
            </span>
            {birthdayCustomersThisMonth.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block tracking-tight">
            {birthdayCustomersThisMonth.length} {birthdayCustomersThisMonth.length === 1 ? 'cliente' : 'clientes'}
          </span>
          <span className="text-[11px] text-amber-800 font-medium mt-0.5 block">
            clique para ver aniversariantes
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-emerald-800 block font-semibold flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Total em Compras
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block tracking-tight">
            {formatCurrency(totalSpentAllCustomers)}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
            faturamento acumulado
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-stone-500 block font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> Média por Cliente
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-1 block tracking-tight">
            {formatCurrency(averageTicketPerCustomer)}
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            gasto médio estimado
          </span>
        </div>
      </div>

      {/* Birthday Alert Banner if there are birthdays this month */}
      {birthdayCustomersThisMonth.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-xs">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Felicitações & Mimos de Aniversário ({currentMonthName})
              </h4>
              <p className="text-xs text-amber-900 mt-0.5">
                Você tem {birthdayCustomersThisMonth.length} {birthdayCustomersThisMonth.length === 1 ? 'aniversariante' : 'aniversariantes'} neste mês:{' '}
                <span className="font-semibold text-stone-950">
                  {birthdayCustomersThisMonth.map((c) => `${c.name} (${formatBirthday(c.birthdate)})`).join(', ')}
                </span>. Aproveite para enviar uma mensagem carinhosa ou cupom pelo WhatsApp!
              </p>
            </div>
          </div>

          <button
            onClick={() => setFilterType('birthdays_month')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Ver Aniversariantes
          </button>
        </div>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>Todos os Clientes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {customers.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('birthdays_month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'birthdays_month'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Cake className="w-3.5 h-3.5" />
              <span>Aniversariantes do Mês ({currentMonthName})</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-900/15">
                {birthdayCustomersThisMonth.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('has_purchases')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'has_purchases'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
              <span>Com Compras Realizadas</span>
            </button>

            <button
              onClick={() => setFilterType('no_purchases')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'no_purchases'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>Sem Compras Ainda</span>
            </button>
          </div>

          {filterType !== 'all' && (
            <button
              onClick={() => setFilterType('all')}
              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nome do cliente, telefone, e-mail ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 placeholder-stone-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Customers List / Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            Nenhum cliente encontrado
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            {searchTerm || filterType !== 'all'
              ? 'Não encontramos nenhum cliente correspondente a essa busca ou filtro.'
              : 'Cadastre seus clientes com nome, telefone e data de aniversário para acompanhar compras e manter contato próximo.'}
          </p>
          <button
            onClick={handleOpenNewCustomer}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Primeiro Cliente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const customerSales = customerSalesMap.get(customer.id) || [];
            const purchasesCount = customerSales.length;
            const totalSpent = customerSales.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);
            const isBirthdayMonth = isBirthdayInMonth(customer.birthdate, currentMonthNumber);
            const cleanPhone = customer.phone.replace(/\D/g, '');
            const whatsappUrl = cleanPhone 
              ? `https://wa.me/55${cleanPhone}` 
              : undefined;

            return (
              <div 
                key={customer.id} 
                className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden shadow-2xs ${
                  isBirthdayMonth ? 'border-amber-300 ring-1 ring-amber-400/30' : 'border-stone-200'
                }`}
              >
                {/* Card Top */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isBirthdayMonth 
                          ? 'bg-amber-500 text-stone-950 font-extrabold' 
                          : 'bg-stone-900 text-amber-400'
                      }`}>
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">

                        <h3 className="font-bold text-stone-900 text-sm truncate">
                          {customer.name}
                        </h3>
                        {customer.email && (
                          <p className="text-[11px] text-stone-400 truncate">
                            {customer.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditCustomer(customer)}
                        className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir o cadastro de ${customer.name}?`)) {
                            onDeleteCustomer(customer.id);
                          }
                        }}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Birthday badge if available */}
                  <div className="flex flex-wrap gap-1.5">
                    {customer.birthdate ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.8 rounded-lg border ${
                        isBirthdayMonth
                          ? 'bg-amber-100/90 text-amber-950 border-amber-300 font-bold'
                          : 'bg-stone-50 text-stone-600 border-stone-200'
                      }`}>
                        <Cake className={`w-3 h-3 ${isBirthdayMonth ? 'text-amber-700' : 'text-stone-400'}`} />
                        <span>{formatBirthday(customer.birthdate)}</span>
                        {isBirthdayMonth && (
                          <span className="ml-1 text-[10px] bg-amber-500 text-stone-950 px-1 py-0.2 rounded font-extrabold">
                            Aniversário este mês!
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 italic">
                        Sem aniversário informado
                      </span>
                    )}

                    {customer.phone && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                        title="Conversar no WhatsApp"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{customer.phone}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-emerald-500 ml-0.5" />
                      </a>
                    )}
                  </div>

                  {/* Notes snippet */}
                  {customer.notes && (
                    <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100 line-clamp-2">
                      {customer.notes}
                    </p>
                  )}

                  {/* Purchases metrics */}
                  <div className="pt-2 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Compras Realizadas
                      </span>
                      <span className="font-bold text-stone-900 mt-0.5 block">
                        {purchasesCount} {purchasesCount === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Total Investido
                      </span>
                      <span className="font-extrabold text-emerald-700 mt-0.5 block">
                        {formatCurrency(totalSpent)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(customer)}
                    className="flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 py-1 px-2 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ver Compras ({purchasesCount})</span>
                  </button>

                  {onNavigateToNewOrderWithCustomer && (
                    <button
                      type="button"
                      onClick={() => onNavigateToNewOrderWithCustomer(customer)}
                      className="flex items-center gap-1 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-500 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Pedido</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Create / Edit Modal */}
      {isCustomerModalOpen && (
        <CustomerFormModal
          isOpen={isCustomerModalOpen}
          existingCustomer={editingCustomer}
          discountCodes={discountCodes}
          onClose={() => {
            setIsCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
          onSave={(saved) => {
            onSaveCustomer(saved);
            setIsCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Customer Purchase History Modal */}
      {viewingHistoryCustomer && (
        <CustomerPurchaseHistoryModal
          customer={viewingHistoryCustomer}
          sales={customerSalesMap.get(viewingHistoryCustomer.id) || []}
          onClose={() => setViewingHistoryCustomer(null)}
          onNewOrder={() => {
            const c = viewingHistoryCustomer;
            setViewingHistoryCustomer(null);
            if (onNavigateToNewOrderWithCustomer && c) {
              onNavigateToNewOrderWithCustomer(c);
            }
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// Customer Form Modal (Create / Edit)
// ==========================================

interface CustomerFormModalProps {
  isOpen: boolean;
  existingCustomer?: Customer | null;
  discountCodes: DiscountCode[];
  onClose: () => void;
  onSave: (customer: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  existingCustomer,
  discountCodes,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(existingCustomer?.name || '');
  const [phone, setPhone] = useState(existingCustomer?.phone || '');
  const [birthdate, setBirthdate] = useState(existingCustomer?.birthdate || '');
  const [email, setEmail] = useState(existingCustomer?.email || '');
  const initialDiscountMode = existingCustomer?.defaultDiscountCodeId
    ? 'code'
    : (existingCustomer?.defaultDiscountPercent || 0) > 0
      ? 'percentage'
      : 'none';
  const [discountMode, setDiscountMode] = useState<'none' | 'code' | 'percentage'>(initialDiscountMode);
  const [defaultDiscountCodeId, setDefaultDiscountCodeId] = useState(existingCustomer?.defaultDiscountCodeId || '');
  const [defaultDiscountPercent, setDefaultDiscountPercent] = useState(
    existingCustomer?.defaultDiscountPercent?.toString() || ''
  );
  const [notes, setNotes] = useState(existingCustomer?.notes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (!phone.trim()) {
      alert('Por favor, informe o telefone ou WhatsApp do cliente.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const customer: Customer = {
      id: existingCustomer?.id || `cust_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      birthdate: birthdate.trim() || undefined,
      email: email.trim() || undefined,
      defaultDiscountCodeId: discountMode === 'code' && defaultDiscountCodeId ? defaultDiscountCodeId : undefined,
      defaultDiscountPercent:
        discountMode === 'percentage'
          ? Math.min(100, Math.max(0, parseFloat(defaultDiscountPercent) || 0))
          : undefined,
      notes: notes.trim() || undefined,
      createdAt: existingCustomer?.createdAt || today,
    };

    onSave(customer);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {existingCustomer ? 'Editar Cadastro de Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <p className="text-xs text-stone-500">
                Guarde contatos, data de aniversário e preferências para atendimento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Amanda Ferreira Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          {/* Telefone e Aniversário lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Telefone / WhatsApp *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: (11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Cake className="w-3.5 h-3.5 text-amber-600" />
                Data de Aniversário
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 font-medium"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Permite avisar aniversariantes do mês
              </span>
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              E-mail (opcional)
            </label>
            <input
              type="email"
              placeholder="Ex: amanda.silva@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>
          {/* Benefício padrão */}
          <div className="p-4 rounded-xl bg-[#fbf7f2] border border-[#eadfd6] space-y-3">
            <div className="flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-[#b96f55]" />
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Benefício padrão do cliente
              </label>
            </div>

            <select
              value={discountMode}
              onChange={(e) => setDiscountMode(e.target.value as 'none' | 'code' | 'percentage')}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#b96f55] text-stone-900"
            >
              <option value="none">Sem desconto automático</option>
              <option value="code">Vincular código de desconto</option>
              <option value="percentage">Porcentagem fixa para este cliente</option>
            </select>

            {discountMode === 'code' && (
              <select
                value={defaultDiscountCodeId}
                onChange={(e) => setDefaultDiscountCodeId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#b96f55] text-stone-900"
              >
                <option value="">Escolher código...</option>
                {discountCodes.filter((code) => code.active !== false).map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.code} · {code.type === 'percentage' ? `${code.value}%` : formatCurrency(code.value)}
                  </option>
                ))}
              </select>
            )}

            {discountMode === 'percentage' && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={defaultDiscountPercent}
                  onChange={(e) => setDefaultDiscountPercent(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full px-3 py-2 pr-9 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#b96f55] text-stone-900"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-500">%</span>
              </div>
            )}
          </div>

          {/* Observações / Notas */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Observações & Preferências do Cliente
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Adora essência de Vanilla e Lavanda, prefere entregas aos sábados, gosta de laço kraft para presente..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 placeholder-stone-400"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>{existingCustomer ? 'Salvar Alterações' : 'Salvar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Customer Purchase History Modal / Drawer
// ==========================================

interface CustomerPurchaseHistoryModalProps {
  customer: Customer;
  sales: Sale[];
  onClose: () => void;
  onNewOrder: () => void;
}

export const CustomerPurchaseHistoryModal: React.FC<CustomerPurchaseHistoryModalProps> = ({
  customer,
  sales,
  onClose,
  onNewOrder,
}) => {
  const cleanPhone = customer.phone.replace(/\D/g, '');
  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : undefined;

  const totalSpent = sales.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);
  const totalProfit = sales.reduce((acc, s) => acc + (s.totalProfit || 0), 0);
  const totalItemsCount = sales.reduce((acc, s) => acc + (s.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-stone-200 bg-stone-50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-amber-400 font-bold text-lg flex items-center justify-center shrink-0">
              {customer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                {customer.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {customer.phone && (
                  <span className="text-xs text-stone-500 flex items-center gap-1 font-medium">
                    <Phone className="w-3 h-3 text-stone-400" />
                    {customer.phone}
                  </span>
                )}
                {customer.birthdate && (
                  <span className="text-xs text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-amber-200">
                    <Cake className="w-3 h-3 text-amber-600" />
                    {formatBirthday(customer.birthdate)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lifetime Value Summary Box */}
        <div className="px-6 py-4 bg-stone-100/70 border-b border-stone-200 grid grid-cols-3 gap-3 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-500 block">
              Total em Compras
            </span>
            <span className="text-base font-extrabold text-stone-900 mt-0.5 block">
              {formatCurrency(totalSpent)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-500 block">
              Lucro Real Gerado
            </span>
            <span className="text-base font-extrabold text-emerald-600 mt-0.5 block">
              +{formatCurrency(totalProfit)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-500 block">
              Total de Peças
            </span>
            <span className="text-base font-extrabold text-stone-900 mt-0.5 block">
              {totalItemsCount} peças ({sales.length} pedidos)
            </span>
          </div>
        </div>

        {/* Scrollable Purchases List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              Histórico de Compras Realizadas ({sales.length})
            </h4>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Mandar mensagem no WhatsApp</span>
              </a>
            )}
          </div>

          {sales.length === 0 ? (
            <div className="p-8 rounded-2xl bg-stone-50 border border-dashed border-stone-200 text-center space-y-2">
              <p className="text-xs text-stone-500">
                Este cliente ainda não possui compras registradas no ateliê.
              </p>
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Lançar Primeiro Pedido para {customer.name}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => {
                const isPendingDelivery = sale.deliveryStatus === 'pendente_entrega';
                const isPendingPayment = sale.paymentStatus === 'pendente_pagamento';

                return (
                  <div
                    key={sale.id}
                    className="p-4 rounded-xl border border-stone-200 hover:border-amber-300 transition-colors bg-white shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {sale.productImageUrl ? (
                          <img
                            src={sale.productImageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="font-bold text-stone-900 text-xs truncate">
                            {sale.productName}
                          </h5>
                          <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formatDate(sale.date)}
                            </span>
                            {sale.channel && (
                              <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-medium text-[10px]">
                                {sale.channel}
                              </span>
                            )}
                            {sale.paymentMethod && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold text-[10px]">
                                {sale.paymentMethod}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-stone-900 text-sm block">
                          {formatCurrency(sale.totalRevenue)}
                        </span>
                        <span className="text-[11px] text-emerald-600 font-bold block">
                          +{formatCurrency(sale.totalProfit)}
                        </span>
                      </div>
                    </div>

                    {/* Multiple items listing if present */}
                    {sale.items && sale.items.length > 1 && (
                      <div className="bg-stone-50 p-2 rounded-lg text-[11px] text-stone-600 space-y-1">
                        <span className="font-bold text-stone-700 block text-[10px] uppercase">
                          Itens do Pedido:
                        </span>
                        {sale.items.map((it, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <span className="truncate">{it.quantity}x {it.productName}</span>
                            <span className="font-semibold text-stone-800">{formatCurrency(it.subtotal || (it.quantity * it.unitPrice))}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100 text-[11px]">
                      {isPendingDelivery ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                          <Clock className="w-2.5 h-2.5 text-amber-700" />
                          Entrega Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                          ✓ Entregue
                        </span>
                      )}

                      {isPendingPayment ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-900">
                          <CreditCard className="w-2.5 h-2.5 text-rose-700" />
                          Pagamento Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                          ✓ Pago
                        </span>
                      )}

                      {sale.notes && (
                        <span className="text-[10px] text-stone-500 italic ml-auto truncate max-w-xs">
                          "{sale.notes}"
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-200/60 rounded-xl cursor-pointer"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={onNewOrder}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs active:scale-98"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Lançar Novo Pedido para {customer.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
