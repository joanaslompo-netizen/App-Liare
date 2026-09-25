import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  Tag, 
  TrendingUp, 
  Trash2, 
  ShoppingBag, 
  X, 
  Check, 
  Clock,
  Truck,
  AlertCircle,
  CheckCircle2,
  Phone,
  Filter,
  CalendarCheck,
  CreditCard,
  Edit2,
  Package,
  Layers,
  Users,
  Cake,
  Globe,
  Store,
  UserPlus,
  Sparkles,
  Percent
} from 'lucide-react';
import { Sale, Product, Material, RecipeItem, OrderType, DeliveryStatus, PaymentStatus, SaleItem, Customer, DiscountCode, DiscountType } from '../types';
import { 
  formatCurrency, 
  formatPercent, 
  formatDate,
  formatBirthday,
  isBirthdayInMonth,
  matchesSearchText
} from '../utils/formatters';
import { SearchableProductCombobox } from './SearchableProductCombobox';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';
import { getProductFinancialSplit, getSaleFinancials, getSaleItemFinancialSplit } from '../utils/financials';

interface SalesViewProps {
  sales: Sale[];
  products: Product[];
  materials: Material[];
  customers: Customer[];
  paymentMethods: string[];
  discountCodes: DiscountCode[];
  onSaveSale: (sale: Sale) => void;
  onReserveSaleItem: (saleId: string, itemId: string) => number | null;
  onReleaseSaleItemReservation: (saleId: string, itemId: string) => number | null;
  onProduceCustomItem: (
    saleId: string,
    item: SaleItem,
    customer?: { id?: string; name?: string }
  ) => { productId: string; productionId: string; producedQuantity: number; unitCost: number } | null;
  onDeleteSale: (id: string) => void;
  onSaveCustomer: (customer: Customer) => void;
  onAddPaymentMethod: (method: string) => void;
  initialFilter?: 'all' | 'pending_delivery' | 'pending_payment';
  initialCustomerForNewOrder?: Customer | null;
  onClearInitialCustomer?: () => void;
  openNewSaleSignal?: number;
  onOpenCustomers?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  products,
  materials,
  customers = [],
  paymentMethods = ['offline', 'site'],
  discountCodes = [],
  onSaveSale,
  onReserveSaleItem,
  onReleaseSaleItemReservation,
  onProduceCustomItem,
  onDeleteSale,
  onSaveCustomer,
  onAddPaymentMethod,
  initialFilter = 'all',
  initialCustomerForNewOrder,
  onClearInitialCustomer,
  openNewSaleSignal = 0,
  onOpenCustomers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'pending_delivery' | 'pending_payment' | 'completed'>(initialFilter);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (initialCustomerForNewOrder) {
      setEditingSale(null);
      setIsModalOpen(true);
    }
  }, [initialCustomerForNewOrder]);

  useEffect(() => {
    if (openNewSaleSignal > 0) {
      setEditingSale(null);
      setIsModalOpen(true);
    }
  }, [openNewSaleSignal]);

  const getStockProductId = (item: SaleItem) =>
    item.isCustom ? item.customProductId : item.productId;

  const getReservedAcrossOrders = (stockProductId: string) =>
    sales.reduce((total, sale) => {
      if (sale.deliveryStatus === 'entregue' || !sale.items) return total;
      return total + sale.items.reduce((sum, item) => {
        return getStockProductId(item) === stockProductId
          ? sum + (item.reservedQuantity || 0)
          : sum;
      }, 0);
    }, 0);

  const getStockInfo = (item: SaleItem) => {
    const stockProductId = getStockProductId(item);
    const stockProduct = stockProductId ? products.find((p) => p.id === stockProductId) : null;
    const physical = stockProduct?.currentStock ?? 0;
    const reservedThis = item.reservedQuantity || 0;
    const reservedAll = stockProductId ? getReservedAcrossOrders(stockProductId) : 0;
    const reservedOther = Math.max(0, reservedAll - reservedThis);
    const available = Math.max(0, physical - reservedAll);
    const missing = Math.max(0, item.quantity - reservedThis);

    return {
      stockProductId,
      physical,
      reservedThis,
      reservedOther,
      available,
      missing,
    };
  };

  const handleReserveFromList = (sale: Sale, item: SaleItem) => {
    if (!item.id) return;
    onReserveSaleItem(sale.id, item.id);
  };

  const handleReleaseFromList = (sale: Sale, item: SaleItem) => {
    if (!item.id) return;
    onReleaseSaleItemReservation(sale.id, item.id);
  };

  // Quick stats
  const pendingDeliveryList = useMemo(() => sales.filter((s) => s.deliveryStatus === 'pendente_entrega'), [sales]);
  const pendingPaymentList = useMemo(() => sales.filter((s) => s.paymentStatus === 'pendente_pagamento'), [sales]);

  const totalPendingPaymentAmount = useMemo(() => {
    return pendingPaymentList.reduce((acc, s) => acc + s.totalRevenue, 0);
  }, [pendingPaymentList]);

  // Filter and sort
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        // Tab filtering
        if (activeTabFilter === 'pending_delivery' && s.deliveryStatus !== 'pendente_entrega') {
          return false;
        }
        if (activeTabFilter === 'pending_payment' && s.paymentStatus !== 'pendente_pagamento') {
          return false;
        }
        if (activeTabFilter === 'completed' && (s.deliveryStatus === 'pendente_entrega' || s.paymentStatus === 'pendente_pagamento')) {
          return false;
        }

        // Search term matching
        const matchesSearch =
          matchesSearchText(s.productName, searchTerm) ||
          (s.customerName && matchesSearchText(s.customerName, searchTerm)) ||
          (s.customerContact && matchesSearchText(s.customerContact, searchTerm)) ||
          (s.channel && matchesSearchText(s.channel, searchTerm)) ||
          (s.notes && matchesSearchText(s.notes, searchTerm));
        return matchesSearch;
      })
      .sort((a, b) => {
        // If sorting by pending delivery, sort by scheduled delivery date first
        if (activeTabFilter === 'pending_delivery') {
          if (a.deliveryScheduledDate && b.deliveryScheduledDate) {
            return a.deliveryScheduledDate.localeCompare(b.deliveryScheduledDate);
          }
        }
        // If sorting by pending payment, sort by scheduled payment date
        if (activeTabFilter === 'pending_payment') {
          if (a.paymentScheduledDate && b.paymentScheduledDate) {
            return a.paymentScheduledDate.localeCompare(b.paymentScheduledDate);
          }
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [sales, searchTerm, activeTabFilter]);

  // Aggregate metrics across ALL sales
  const totalRevenue = sales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const totalReceived = sales
    .filter((s) => s.paymentStatus !== 'pendente_pagamento')
    .reduce((acc, s) => acc + s.totalRevenue, 0);
  const totalProfit = sales.reduce((acc, s) => acc + getSaleFinancials(s, products).ownerEarnings, 0);
  const isTotalLoss = totalProfit < 0;
  const totalPiecesSold = sales.reduce((acc, s) => acc + s.quantity, 0);

  // Quick Action: Mark Delivery as Complete
  const handleMarkAsDelivered = (sale: Sale) => {
    const today = new Date().toISOString().split('T')[0];
    const updated: Sale = {
      ...sale,
      deliveryStatus: 'entregue',
      deliveryActualDate: today,
    };
    onSaveSale(updated);
  };

  // Quick Action: Mark Payment as Received
  const handleMarkAsPaid = (sale: Sale) => {
    const today = new Date().toISOString().split('T')[0];
    const updated: Sale = {
      ...sale,
      paymentStatus: 'pago',
      paymentActualDate: today,
    };
    onSaveSale(updated);
  };

  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingSale(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
              Registro de Pedidos & Vendas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
              {sales.length} no total
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            Gerencie pedidos sob encomenda, vendas a pronta entrega, entregas agendadas e controle de recebimentos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenCustomers && (
            <button
              type="button"
              onClick={onOpenCustomers}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-stone-50 text-stone-700 text-sm font-semibold rounded-xl border border-stone-200 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-[#a86149]" />
              <span>Clientes</span>
            </button>
          )}
          <button
            id="btn-add-sale"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-98"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Registrar Novo Pedido / Venda</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Visão Financeira e Operacional */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-stone-500 block font-semibold">
            Faturamento Total
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-1 block tracking-tight">
            {formatCurrency(totalRevenue)}
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            {totalPiecesSold} peças contratadas
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className={`text-xs uppercase tracking-wider block font-semibold flex items-center gap-1 ${isTotalLoss ? 'text-red-700' : 'text-emerald-800'}`}>
            <TrendingUp className={`w-3.5 h-3.5 ${isTotalLoss ? 'text-red-600' : 'text-emerald-600'}`} /> Total que fica para você
          </span>
          <span className={`text-2xl font-extrabold mt-1 block tracking-tight ${isTotalLoss ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}
          </span>
          <span className={`text-[11px] font-medium mt-0.5 block ${isTotalLoss ? 'text-red-700' : 'text-emerald-700'}`}>
            mão de obra não é tratada como despesa
          </span>
        </div>

        {/* Pendentes de Entrega Card */}
        <div 
          onClick={() => setActiveTabFilter('pending_delivery')}
          className={`p-4.5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            pendingDeliveryList.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:bg-amber-50'
              : 'bg-white border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-amber-900 block font-bold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-600" /> A Entregar
            </span>
            {pendingDeliveryList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block tracking-tight">
            {pendingDeliveryList.length} {pendingDeliveryList.length === 1 ? 'pedido' : 'pedidos'}
          </span>
          <span className="text-[11px] text-amber-800 font-medium mt-0.5 block">
            clique para filtrar entregas
          </span>
        </div>

        {/* Pendentes de Pagamento Card */}
        <div 
          onClick={() => setActiveTabFilter('pending_payment')}
          className={`p-4.5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            pendingPaymentList.length > 0
              ? 'bg-rose-50/70 border-rose-300 hover:bg-rose-50'
              : 'bg-white border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-rose-900 block font-bold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-rose-600" /> A Receber
            </span>
            {pendingPaymentList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-2xl font-extrabold text-rose-700 mt-1 block tracking-tight">
            {formatCurrency(totalPendingPaymentAmount)}
          </span>
          <span className="text-[11px] text-rose-800 font-medium mt-0.5 block">
            {pendingPaymentList.length} {pendingPaymentList.length === 1 ? 'recebimento pendente' : 'recebimentos pendentes'}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>Todos os Pedidos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {sales.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('pending_delivery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'pending_delivery'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Pendentes de Entrega</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-900/15">
                {pendingDeliveryList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('pending_payment')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'pending_payment'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pendentes de Pagamento</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-900/15">
                {pendingPaymentList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'completed'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Finalizados</span>
            </button>
          </div>

          {activeTabFilter !== 'all' && (
            <button
              onClick={() => setActiveTabFilter('all')}
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
            placeholder="Buscar por cliente, telefone, peça ou canal (Instagram, WhatsApp, Elo7)..."
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

      {/* Orders & Sales Table */}
      {filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            Nenhum pedido encontrado
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            {activeTabFilter !== 'all' 
              ? 'Não há pedidos correspondentes a este filtro no momento.'
              : 'Ao registrar seus pedidos e vendas, você acompanha entregas, faturamento e lucro líquido em tempo real.'}
          </p>
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Registrar Novo Pedido</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50/90 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pedido / Data</th>
                  <th className="py-3 px-4">Peça Solicitada</th>
                  <th className="py-3 px-4">Cliente & Contato</th>
                  <th className="py-3 px-4">Status de Entrega</th>
                  <th className="py-3 px-4">Status de Pagamento</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-right">Lucro Líquido</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSales.map((sale) => {
                  const isPendingDelivery = sale.deliveryStatus === 'pendente_entrega';
                  const isPendingPayment = sale.paymentStatus === 'pendente_pagamento';

                  return (
                    <tr key={sale.id} className="hover:bg-stone-50/70 transition-colors">
                      {/* Date & Type */}
                      <td className="py-3 px-4 whitespace-nowrap text-stone-700">
                        <div className="flex flex-col">
                          <span className="font-semibold text-stone-900 flex items-center gap-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            {formatDate(sale.date)}
                          </span>
                          <span className="mt-1">
                            {sale.orderType === 'encomenda' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                Encomenda
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                                Pronta Entrega
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        <div className="flex items-center gap-2.5">
                          {sale.productImageUrl ? (
                            <img
                              src={sale.productImageUrl}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                              <Tag className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 max-w-sm">
                            <span className="truncate font-semibold text-stone-900 text-xs">
                              {sale.productName}
                            </span>
                            <div className="flex items-center gap-1 text-[11px] text-stone-500 font-normal">
                              {sale.items && sale.items.length > 1 ? (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-900 bg-amber-100/70 px-1.5 py-0.2 rounded text-[10px]">
                                  <Layers className="w-2.5 h-2.5" />
                                  {sale.items.length} itens ({sale.quantity} peças)
                                </span>
                              ) : (
                                <span>
                                  {sale.quantity}x de {formatCurrency(sale.unitPrice)}
                                </span>
                              )}
                            </div>

                            {sale.deliveryStatus === 'pendente_entrega' && sale.items && (
                              <div className="mt-1.5 space-y-1.5">
                                {sale.items.map((item, itemIndex) => {
                                  const info = getStockInfo(item);
                                  const itemKey = item.id || `${sale.id}_stock_${itemIndex}`;
                                  return (
                                    <div key={itemKey} className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5">
                                      {sale.items!.length > 1 && (
                                        <div className="text-[10px] font-bold text-stone-700 truncate mb-0.5">
                                          {item.productName}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[9px] text-stone-500">
                                        <span>Estoque: <strong className="text-stone-700">{info.physical}</strong></span>
                                        <span>Reservado: <strong className="text-stone-700">{info.reservedThis}</strong></span>
                                        <span className={info.missing > 0 ? 'text-amber-800 font-bold' : 'text-emerald-700 font-bold'}>
                                          {info.missing > 0 ? `Faltam ${info.missing}` : 'Pedido coberto'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        {info.missing > 0 && info.available > 0 && item.id && (
                                          <button
                                            type="button"
                                            onClick={() => handleReserveFromList(sale, item)}
                                            className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[9px] font-bold hover:bg-stone-800"
                                          >
                                            Reservar
                                          </button>
                                        )}
                                        {info.reservedThis > 0 && item.id && (
                                          <button
                                            type="button"
                                            onClick={() => handleReleaseFromList(sale, item)}
                                            className="px-2 py-0.5 rounded-md border border-stone-300 bg-white text-stone-600 text-[9px] font-semibold hover:bg-stone-100"
                                          >
                                            Liberar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 text-stone-600">
                        {(() => {
                          const linkedCustomer = sale.customerId 
                            ? customers.find((c) => c.id === sale.customerId) 
                            : customers.find((c) => c.name.toLowerCase() === (sale.customerName || '').toLowerCase());
                          const hasBirthday = linkedCustomer ? isBirthdayInMonth(linkedCustomer.birthdate) : false;

                          return (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-stone-900 text-xs">
                                  {sale.customerName || 'Cliente Balcão'}
                                </span>
                                {hasBirthday && (
                                  <span 
                                    className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300"
                                    title={`Aniversariante! ${linkedCustomer?.birthdate ? formatBirthday(linkedCustomer.birthdate) : ''}`}
                                  >
                                    <Cake className="w-2.5 h-2.5 text-amber-600" />
                                    Aniversariante
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {sale.customerContact && (
                                  <span className="text-[11px] text-stone-500 flex items-center gap-0.5">
                                    <Phone className="w-2.5 h-2.5 text-stone-400" />
                                    {sale.customerContact}
                                  </span>
                                )}
                                {sale.channel && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-medium">
                                    {sale.channel}
                                  </span>
                                )}
                                {sale.paymentMethod && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                    sale.paymentMethod.toLowerCase() === 'site'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : sale.paymentMethod.toLowerCase() === 'offline'
                                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                                      : 'bg-stone-100 text-stone-700 border-stone-200'
                                  }`}>
                                    {sale.paymentMethod}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3 px-4">
                        {isPendingDelivery ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.8 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 w-fit">
                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                              Pendente
                            </span>
                            {sale.deliveryScheduledDate && (
                              <span className="text-[10px] text-amber-800 font-medium flex items-center gap-1">
                                Entrega até: <strong>{formatDate(sale.deliveryScheduledDate)}</strong>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMarkAsDelivered(sale)}
                              className="text-[10px] text-stone-600 hover:text-emerald-700 underline text-left cursor-pointer mt-0.5 font-medium"
                            >
                              ✓ Marcar como Entregue
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Entregue
                            </span>
                            {sale.deliveryActualDate && (
                              <span className="text-[10px] text-stone-400 mt-0.5">
                                em {formatDate(sale.deliveryActualDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4">
                        {isPendingPayment ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.8 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 w-fit">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              A Receber
                            </span>
                            {sale.paymentScheduledDate && (
                              <span className="text-[10px] text-rose-800 font-medium">
                                Cobrar em: <strong>{formatDate(sale.paymentScheduledDate)}</strong>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(sale)}
                              className="text-[10px] text-stone-600 hover:text-emerald-700 underline text-left cursor-pointer mt-0.5 font-medium"
                            >
                              ✓ Confirmar Recebimento
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pago
                            </span>
                            {sale.paymentActualDate && (
                              <span className="text-[10px] text-stone-400 mt-0.5">
                                em {formatDate(sale.paymentActualDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3 px-4 text-right font-bold text-stone-900">
                        {formatCurrency(sale.totalRevenue)}
                      </td>

                      {/* Owner earnings & margin */}
                      <td className="py-3 px-4 text-right">
                        {(() => {
                          const financials = getSaleFinancials(sale, products);
                          return (
                            <>
                              <span className={`font-bold block ${financials.ownerEarnings < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {financials.ownerEarnings > 0 ? '+' : ''}{formatCurrency(financials.ownerEarnings)}
                              </span>
                              <span className={`text-[10px] font-semibold ${financials.ownerEarnings < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                {formatPercent(financials.marginPercent)}
                              </span>
                            </>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(sale)}
                            className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar pedido"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja excluir o registro do pedido de ${sale.productName}?`)) {
                                onDeleteSale(sale.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir pedido"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order / Sale Modal */}
      {isModalOpen && (
        <OrderSaleModal
          isOpen={isModalOpen}
          products={products}
          materials={materials}
          customers={customers}
          paymentMethods={paymentMethods}
          discountCodes={discountCodes}
          sales={sales}
          existingSale={editingSale}
          initialCustomer={initialCustomerForNewOrder}
          onSaveCustomer={onSaveCustomer}
          onAddPaymentMethod={onAddPaymentMethod}
          onReserveSaleItem={onReserveSaleItem}
          onReleaseSaleItemReservation={onReleaseSaleItemReservation}
          onProduceCustomItem={onProduceCustomItem}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSale(null);
            onClearInitialCustomer?.();
          }}
          onSave={(sale) => {
            onSaveSale(sale);
            setIsModalOpen(false);
            setEditingSale(null);
            onClearInitialCustomer?.();
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// Order / Sale Modal with Delivery & Payment Scheduling
// ==========================================

interface OrderSaleModalProps {
  isOpen: boolean;
  products: Product[];
  materials: Material[];
  customers: Customer[];
  paymentMethods: string[];
  discountCodes: DiscountCode[];
  sales: Sale[];
  existingSale?: Sale | null;
  initialCustomer?: Customer | null;
  onSaveCustomer: (customer: Customer) => void;
  onAddPaymentMethod: (method: string) => void;
  onReserveSaleItem: (saleId: string, itemId: string) => number | null;
  onReleaseSaleItemReservation: (saleId: string, itemId: string) => number | null;
  onProduceCustomItem: (
    saleId: string,
    item: SaleItem,
    customer?: { id?: string; name?: string }
  ) => { productId: string; productionId: string; producedQuantity: number; unitCost: number } | null;
  onClose: () => void;
  onSave: (sale: Sale) => void;
}

const OrderSaleModal: React.FC<OrderSaleModalProps> = ({
  products,
  materials,
  customers,
  paymentMethods,
  discountCodes,
  sales,
  existingSale,
  initialCustomer,
  onSaveCustomer,
  onAddPaymentMethod,
  onReserveSaleItem,
  onReleaseSaleItemReservation,
  onProduceCustomItem,
  onClose,
  onSave,
}) => {
  const [orderType, setOrderType] = useState<OrderType>(existingSale?.orderType || 'pronta_entrega');
  const [date, setDate] = useState(existingSale?.date || new Date().toISOString().split('T')[0]);

  // Customer linkage & data
  const [customerId, setCustomerId] = useState<string | undefined>(
    existingSale?.customerId || initialCustomer?.id || undefined
  );
  const [customerName, setCustomerName] = useState(
    existingSale?.customerName || initialCustomer?.name || ''
  );
  const [customerContact, setCustomerContact] = useState(
    existingSale?.customerContact || initialCustomer?.phone || ''
  );

  // Payment Method Category (offline, site, or custom)
  const [paymentMethod, setPaymentMethod] = useState<string>(
    existingSale?.paymentMethod || 'offline'
  );
  const [isAddingPaymentCategory, setIsAddingPaymentCategory] = useState(false);
  const [newPaymentCategoryInput, setNewPaymentCategoryInput] = useState('');

  // Quick customer modal state
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickBirthdate, setQuickBirthdate] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  const [channel, setChannel] = useState(existingSale?.channel || 'Instagram');
  const [notes, setNotes] = useState(existingSale?.notes || '');
  const initialDiscountMode: 'none' | 'code' | 'percentage' | 'fixed' = existingSale?.discountCodeId
    ? 'code'
    : existingSale?.discountType === 'fixed'
      ? 'fixed'
      : existingSale?.discountType === 'percentage'
        ? 'percentage'
        : 'none';
  const [discountMode, setDiscountMode] = useState<'none' | 'code' | 'percentage' | 'fixed'>(initialDiscountMode);
  const [discountCodeId, setDiscountCodeId] = useState(existingSale?.discountCodeId || '');
  const [manualDiscountValue, setManualDiscountValue] = useState(
    existingSale?.discountValue?.toString() || ''
  );

  // Computed all available payment categories
  const allPaymentCategories = useMemo(() => {
    const list = ['offline', 'site'];
    paymentMethods.forEach((m) => {
      if (!list.some((item) => item.toLowerCase() === m.toLowerCase())) {
        list.push(m);
      }
    });
    return list;
  }, [paymentMethods]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    if (customerId) {
      return customers.find((c) => c.id === customerId) || null;
    }
    return null;
  }, [customerId, customers]);

  const appliedDiscountCode = useMemo(() => {
    if (
      existingSale?.discountCodeId === discountCodeId &&
      existingSale.discountType &&
      existingSale.discountValue !== undefined
    ) {
      return {
        id: existingSale.discountCodeId,
        code: existingSale.discountCode || 'DESCONTO',
        type: existingSale.discountType,
        value: existingSale.discountValue,
        active: true,
        createdAt: existingSale.createdAt,
      } as DiscountCode;
    }
    return discountCodes.find((code) => code.id === discountCodeId) || null;
  }, [discountCodes, discountCodeId, existingSale]);

  useEffect(() => {
    if (existingSale || !selectedCustomer) return;

    if (selectedCustomer.defaultDiscountCodeId) {
      const customerCode = discountCodes.find(
        (code) => code.id === selectedCustomer.defaultDiscountCodeId && code.active !== false
      );
      if (customerCode) {
        setDiscountMode('code');
        setDiscountCodeId(customerCode.id);
        setManualDiscountValue('');
        return;
      }
    }

    if ((selectedCustomer.defaultDiscountPercent || 0) > 0) {
      setDiscountMode('percentage');
      setDiscountCodeId('');
      setManualDiscountValue(String(selectedCustomer.defaultDiscountPercent));
      return;
    }

    setDiscountMode('none');
    setDiscountCodeId('');
    setManualDiscountValue('');
  }, [selectedCustomer?.id, discountCodes, existingSale]);

  // Initialize items array from existingSale (or from single product fallback)
  const [items, setItems] = useState<SaleItem[]>(() => {
    if (existingSale?.items && existingSale.items.length > 0) {
      return [...existingSale.items];
    }
    if (existingSale?.productId) {
      return [
        {
          id: `item_0`,
          productId: existingSale.productId,
          productName: existingSale.productName,
          productImageUrl: existingSale.productImageUrl,
          quantity: existingSale.quantity || 1,
          unitPrice: existingSale.unitPrice,
          unitCost: existingSale.unitCost,
          subtotal: existingSale.subtotalRevenue ?? existingSale.totalRevenue,
          totalCost: existingSale.totalCost,
        },
      ];
    }
    return [];
  });

  // State for the "add item" row
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState<string>('');
  const [qtyToAdd, setQtyToAdd] = useState<string>('1');
  const [priceToAdd, setPriceToAdd] = useState<string>('');

  // Item personalizado rápido: pertence somente a este pedido e não entra no catálogo.
  const [isCustomItemMode, setIsCustomItemMode] = useState(false);
  const [customEditingItemId, setCustomEditingItemId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('0');
  const [customRecipeItems, setCustomRecipeItems] = useState<RecipeItem[]>([]);
  const [customMaterialId, setCustomMaterialId] = useState('');
  const [customMaterialQty, setCustomMaterialQty] = useState('1');
  const [customVariableSelections, setCustomVariableSelections] = useState<Record<string, string>>({});

  const selectedCustomMaterial = useMemo(
    () => materials.find((m) => m.id === customMaterialId) || null,
    [materials, customMaterialId]
  );

  const customVirtualRequirements = useMemo(() => {
    if (!selectedCustomMaterial?.isVirtualRecipe || !selectedCustomMaterial.recipeItems?.length) return [];
    return selectedCustomMaterial.recipeItems
      .filter((item) => item.type === 'material' && item.selectionMode === 'category' && item.targetCategory)
      .map((item) => ({
        recipeItemId: item.id,
        category: item.targetCategory as string,
      }));
  }, [selectedCustomMaterial]);

  const getModalStockProductId = (item: SaleItem) =>
    item.isCustom ? item.customProductId : item.productId;

  const getModalStockInfo = (item: SaleItem) => {
    const stockProductId = getModalStockProductId(item);
    const stockProduct = stockProductId ? products.find((p) => p.id === stockProductId) : null;
    const physical = stockProduct?.currentStock ?? 0;
    const reservedThis = item.reservedQuantity || 0;
    const reservedOther = stockProductId
      ? sales.reduce((total, sale) => {
          if (
            sale.id === existingSale?.id ||
            sale.deliveryStatus === 'entregue' ||
            !sale.items
          ) return total;

          return total + sale.items.reduce((sum, saleItem) => {
            const saleItemStockId = saleItem.isCustom ? saleItem.customProductId : saleItem.productId;
            return saleItemStockId === stockProductId
              ? sum + (saleItem.reservedQuantity || 0)
              : sum;
          }, 0);
        }, 0)
      : 0;

    const available = Math.max(0, physical - reservedOther - reservedThis);
    const missing = Math.max(0, item.quantity - reservedThis);

    return {
      physical,
      reservedThis,
      reservedOther,
      available,
      missing,
      stockProductId,
    };
  };

  const handleReserveItemInModal = (item: SaleItem) => {
    if (!existingSale || !item.id) {
      alert('Salve o pedido primeiro para poder reservar uma peça.');
      return;
    }

    const savedItem = existingSale.items?.find((saved) => saved.id === item.id);
    if (!savedItem) {
      alert('Salve as alterações do pedido antes de reservar este novo item.');
      return;
    }
    if (savedItem.quantity !== item.quantity) {
      alert('Salve a nova quantidade do pedido antes de atualizar a reserva.');
      return;
    }

    const newReserved = onReserveSaleItem(existingSale.id, item.id);
    if (newReserved === null) return;
    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id ? { ...current, reservedQuantity: newReserved } : current
      )
    );
  };

  const handleReleaseItemInModal = (item: SaleItem) => {
    if (!existingSale || !item.id) return;
    const newReserved = onReleaseSaleItemReservation(existingSale.id, item.id);
    if (newReserved === null) return;
    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id ? { ...current, reservedQuantity: newReserved } : current
      )
    );
  };

  // When a product is selected in the combobox, pre-fill its selling price
  const handleSelectProductToAdd = (prod: Product | null) => {
    if (prod) {
      setSelectedProductIdToAdd(prod.id);
      setPriceToAdd(prod.actualPrice.toFixed(2));
    } else {
      setSelectedProductIdToAdd('');
      setPriceToAdd('');
    }
  };

  const resetCustomItemEditor = () => {
    setCustomEditingItemId(null);
    setCustomName('');
    setCustomQty('1');
    setCustomPrice('0');
    setCustomRecipeItems([]);
    setCustomMaterialId('');
    setCustomMaterialQty('1');
    setCustomVariableSelections({});
  };

  const handleAddCustomMaterial = () => {
    const material = materials.find((m) => m.id === customMaterialId);
    const qty = parseFloat(customMaterialQty);

    if (!material) {
      alert('Selecione um material para adicionar.');
      return;
    }
    if (!qty || qty <= 0) {
      alert('Informe uma quantidade válida do material.');
      return;
    }

    let effectiveUnitCost = material.usageType === 'durable' ? 0 : material.unitCost;
    let categorySelections: Record<string, string> | undefined;

    if (material.isVirtualRecipe && material.recipeItems?.length) {
      const selections: Record<string, string> = {};

      for (const recipeItem of material.recipeItems) {
        if (recipeItem.type === 'material' && recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
          const chosenId = customVariableSelections[recipeItem.id];
          const chosen = materials.find(
            (m) => m.id === chosenId && !m.isVirtualRecipe && m.category === recipeItem.targetCategory
          );

          if (!chosen) {
            alert(`Escolha um material da categoria ${recipeItem.targetCategory} para usar nesta receita virtual.`);
            return;
          }

          selections[recipeItem.id] = chosen.id;
        }
      }

      const recipeTotalCost = material.recipeItems.reduce((sum, recipeItem) => {
        if (recipeItem.type !== 'material') {
          return sum + (recipeItem.unitCost || 0) * recipeItem.quantity;
        }

        if (recipeItem.selectionMode === 'category' && recipeItem.targetCategory) {
          const chosenId = selections[recipeItem.id];
          const chosen = materials.find((m) => m.id === chosenId);
          const chosenCost = chosen?.usageType === 'durable' ? 0 : (chosen?.unitCost || recipeItem.unitCost || 0);
          return sum + chosenCost * recipeItem.quantity;
        }

        const fixedMaterial = materials.find((m) => m.id === recipeItem.targetId);
        const fixedCost = fixedMaterial?.usageType === 'durable' ? 0 : (fixedMaterial?.unitCost || recipeItem.unitCost || 0);
        return sum + fixedCost * recipeItem.quantity;
      }, 0);

      effectiveUnitCost = recipeTotalCost / Math.max(0.0001, material.batchYield || 1);
      categorySelections = selections;
    }

    const selectionsKey = JSON.stringify(categorySelections || {});
    const existingIndex = customRecipeItems.findIndex(
      (item) => item.targetId === material.id && JSON.stringify(item.categorySelections || {}) === selectionsKey
    );

    if (existingIndex >= 0) {
      const updated = [...customRecipeItems];
      const existing = updated[existingIndex];
      const newQty = existing.quantity + qty;
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        unit: material.unit,
        unitCost: effectiveUnitCost,
        totalCost: newQty * effectiveUnitCost,
        categorySelections,
      };
      setCustomRecipeItems(updated);
    } else {
      setCustomRecipeItems((prev) => [
        ...prev,
        {
          id: `custom_recipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'material',
          targetId: material.id,
          name: material.name,
          quantity: qty,
          unit: material.unit,
          unitCost: effectiveUnitCost,
          totalCost: qty * effectiveUnitCost,
          selectionMode: 'fixed',
          categorySelections,
        },
      ]);
    }

    setCustomMaterialId('');
    setCustomMaterialQty('1');
    setCustomVariableSelections({});
  };

  const handleSaveCustomItem = () => {
    const name = customName.trim();
    if (!name) {
      alert('Informe um nome para o item personalizado.');
      return;
    }

    const quantity = Math.max(1, parseInt(customQty, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(customPrice) || 0);
    const unitCost = customRecipeItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const existingCustom = customEditingItemId
      ? items.find((item) => item.id === customEditingItemId)
      : null;

    const customItem: SaleItem = {
      ...(existingCustom || {}),
      id: existingCustom?.id || `custom_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: existingCustom?.productId || `custom_product_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productName: name,
      quantity,
      unitPrice,
      unitCost,
      unitBusinessCost: unitCost,
      unitLaborRemuneration: existingCustom?.unitLaborRemuneration ?? 0,
      subtotal: quantity * unitPrice,
      totalCost: quantity * unitCost,
      isCustom: true,
      customRecipeItems: customRecipeItems,
    };

    if (customEditingItemId) {
      setItems((prev) => prev.map((item) => item.id === customEditingItemId ? customItem : item));
    } else {
      setItems((prev) => [...prev, customItem]);
    }

    resetCustomItemEditor();
    setIsCustomItemMode(false);
  };

  const handleEditCustomItem = (item: SaleItem) => {
    setCustomEditingItemId(item.id || null);
    setCustomName(item.productName);
    setCustomQty(item.quantity.toString());
    setCustomPrice(item.unitPrice.toString());
    setCustomRecipeItems(item.customRecipeItems ? [...item.customRecipeItems] : []);
    setCustomMaterialId('');
    setCustomMaterialQty('1');
    setCustomVariableSelections({});
    setIsCustomItemMode(true);
  };

  const handleProduceCustomItemNow = (item: SaleItem) => {
    if (!existingSale) {
      alert('Salve o pedido primeiro. Depois abra-o novamente para produzir o item personalizado.');
      return;
    }
    if (!item.customRecipeItems?.length) {
      alert('Preencha os insumos do item personalizado antes de produzir.');
      return;
    }

    const result = onProduceCustomItem(
      existingSale.id,
      item,
      { id: customerId, name: customerName.trim() || undefined }
    );
    if (!result) return;

    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? {
              ...current,
              customProductId: result.productId,
              customProductionId: result.productionId,
              customProducedQuantity: result.producedQuantity,
              customProducedAt: new Date().toISOString().split('T')[0],
              reservedQuantity: Math.min(
                current.quantity,
                (current.reservedQuantity || 0) + 1
              ),
              unitCost: result.unitCost,
              totalCost: result.unitCost * current.quantity,
            }
          : current
      )
    );
  };

  // Delivery settings
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(
    existingSale?.deliveryStatus || (orderType === 'encomenda' ? 'pendente_entrega' : 'entregue')
  );
  const [deliveryScheduledDate, setDeliveryScheduledDate] = useState(
    existingSale?.deliveryScheduledDate || (orderType === 'encomenda' ? '' : '')
  );

  // Payment settings
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    existingSale?.paymentStatus || 'pago'
  );
  const [paymentScheduledDate, setPaymentScheduledDate] = useState(
    existingSale?.paymentScheduledDate || ''
  );

  // Auto-switch delivery status default when orderType switches
  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    if (!existingSale) {
      if (type === 'encomenda') {
        setDeliveryStatus('pendente_entrega');
      } else {
        setDeliveryStatus('entregue');
      }
    }
  };

  // Add item to items list
  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductIdToAdd);
    if (!prod) {
      alert('Selecione um produto para adicionar ao pedido.');
      return;
    }
    const q = Math.max(1, parseInt(qtyToAdd, 10) || 1);
    const parsedPrice = priceToAdd.trim() === '' ? prod.actualPrice : parseFloat(priceToAdd);
    const p = Number.isFinite(parsedPrice) ? Math.max(0, parsedPrice) : prod.actualPrice;
    const cost = prod.unitCostFromBatch > 0 ? prod.unitCostFromBatch : prod.totalCost;

    // Check if product already exists in items list: if so, increment quantity
    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      const existing = updated[existingIndex];
      const newQty = existing.quantity + q;
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        unitPrice: p, // update to latest chosen price
        subtotal: newQty * p,
        totalCost: newQty * cost,
      };
      setItems(updated);
    } else {
      const financialSplit = getProductFinancialSplit(prod);
      const newItem: SaleItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        productImageUrl: prod.imageUrl,
        quantity: q,
        unitPrice: p,
        unitCost: cost,
        unitBusinessCost: financialSplit.businessCostPerUnit,
        unitLaborRemuneration: financialSplit.laborRemunerationPerUnit,
        subtotal: q * p,
        totalCost: q * cost,
      };
      setItems([...items, newItem]);
    }

    // Reset picker inputs
    setSelectedProductIdToAdd('');
    setQtyToAdd('1');
    setPriceToAdd('');
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  // Update item quantity
  const handleUpdateItemQty = (id: string, newQty: number) => {
    const validQty = Math.max(1, newQty);
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          quantity: validQty,
          reservedQuantity: Math.min(it.reservedQuantity || 0, validQty),
          subtotal: validQty * it.unitPrice,
          totalCost: validQty * it.unitCost,
        };
      })
    );
  };

  // Update item price
  const handleUpdateItemPrice = (id: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          unitPrice: validPrice,
          subtotal: it.quantity * validPrice,
        };
      })
    );
  };

  // Aggregate totals from items + order discount
  const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
  const subtotalRevenue = items.reduce((acc, it) => acc + (it.subtotal || (it.quantity * it.unitPrice)), 0);
  const totalCost = items.reduce((acc, it) => acc + it.totalCost, 0);
  const totalBusinessCost = items.reduce((acc, it) => {
    const split = getSaleItemFinancialSplit(it, products);
    return acc + split.businessCostPerUnit * it.quantity;
  }, 0);
  const totalLaborRemuneration = items.reduce((acc, it) => {
    const split = getSaleItemFinancialSplit(it, products);
    return acc + split.laborRemunerationPerUnit * it.quantity;
  }, 0);

  const effectiveDiscountType: DiscountType | undefined =
    discountMode === 'code'
      ? appliedDiscountCode?.type
      : discountMode === 'percentage'
        ? 'percentage'
        : discountMode === 'fixed'
          ? 'fixed'
          : undefined;
  const effectiveDiscountValue =
    discountMode === 'code'
      ? (appliedDiscountCode?.value || 0)
      : Math.max(0, parseFloat(manualDiscountValue) || 0);
  const discountAmount = effectiveDiscountType === 'percentage'
    ? Math.min(subtotalRevenue, subtotalRevenue * Math.min(100, effectiveDiscountValue) / 100)
    : effectiveDiscountType === 'fixed'
      ? Math.min(subtotalRevenue, effectiveDiscountValue)
      : 0;
  const totalRevenue = Math.max(0, subtotalRevenue - discountAmount);
  const totalProfit = totalRevenue - totalBusinessCost;
  const commercialProfit = totalProfit - totalLaborRemuneration;
  const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const isLoss = totalProfit < 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Adicione pelo menos um produto ao pedido.');
      return;
    }
    if (subtotalRevenue <= 0 && !items.some((item) => item.isCustom)) {
      alert('O valor dos itens do pedido deve ser maior que zero.');
      return;
    }

    if (deliveryStatus === 'entregue') {
      const customNotReady = items.find(
        (item) => item.isCustom && (item.customProducedQuantity || 0) < item.quantity
      );
      if (customNotReady) {
        alert(
          `Antes de marcar o pedido como entregue, produza todas as unidades de "${customNotReady.productName}". Produzidas: ${customNotReady.customProducedQuantity || 0} de ${customNotReady.quantity}.`
        );
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // Primary product summary for backwards compatibility
    const firstItem = items[0];
    const summaryProductName = items.length === 1 
      ? firstItem.productName 
      : `${firstItem.productName} + ${items.length - 1} outro(s)`;

    const updatedSale: Sale = {
      id: existingSale?.id || `sale_${Date.now()}`,
      date,
      productId: firstItem.productId,
      productName: summaryProductName,
      productImageUrl: firstItem.productImageUrl || existingSale?.productImageUrl,
      quantity: totalQuantity,
      unitPrice: totalQuantity > 0 ? totalRevenue / totalQuantity : firstItem.unitPrice,
      unitCost: totalQuantity > 0 ? totalCost / totalQuantity : firstItem.unitCost,
      items,
      subtotalRevenue,
      discountType: effectiveDiscountType,
      discountValue: effectiveDiscountType ? effectiveDiscountValue : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountCode: discountMode === 'code' ? appliedDiscountCode?.code : undefined,
      discountCodeId: discountMode === 'code' ? appliedDiscountCode?.id : undefined,
      totalRevenue,
      totalCost,
      totalBusinessCost,
      totalLaborRemuneration,
      commercialProfit,
      totalProfit,
      marginPercent,
      customerId: customerId || undefined,
      customerName: customerName.trim() || undefined,
      customerContact: customerContact.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      channel: channel.trim() || undefined,
      notes: notes.trim() || undefined,

      orderType,
      deliveryStatus,
      deliveryScheduledDate: deliveryStatus === 'pendente_entrega' ? (deliveryScheduledDate || undefined) : undefined,
      deliveryActualDate: deliveryStatus === 'entregue' ? (existingSale?.deliveryActualDate || today) : undefined,
      paymentStatus,
      paymentScheduledDate: paymentStatus === 'pendente_pagamento' ? (paymentScheduledDate || undefined) : undefined,
      paymentActualDate: paymentStatus === 'pago' ? (existingSale?.paymentActualDate || today) : undefined,

      createdAt: existingSale?.createdAt || today,
    };

    onSave(updatedSale);
  };

  const handleAddNewPaymentCategory = () => {
    const trimmed = newPaymentCategoryInput.trim();
    if (!trimmed) return;
    onAddPaymentMethod(trimmed);
    setPaymentMethod(trimmed);
    setNewPaymentCategoryInput('');
    setIsAddingPaymentCategory(false);
  };

  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: quickName.trim(),
      phone: quickPhone.trim(),
      birthdate: quickBirthdate.trim() ? quickBirthdate.trim() : undefined,
      notes: quickNotes.trim() ? quickNotes.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveCustomer(newCust);
    setCustomerId(newCust.id);
    setCustomerName(newCust.name);
    setCustomerContact(newCust.phone);
    setIsQuickCustomerOpen(false);
    setQuickName('');
    setQuickPhone('');
    setQuickBirthdate('');
    setQuickNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                {existingSale ? 'Editar Pedido / Venda' : 'Registrar Pedido / Venda'}
              </h3>
              <p className="text-xs text-stone-500">
                Adicione um ou múltiplos produtos, selecione quantidades e acompanhe prazos
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Order Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Modalidade de Atendimento *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOrderTypeChange('pronta_entrega')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  orderType === 'pronta_entrega'
                    ? 'bg-amber-50 border-amber-400 text-stone-900 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Tag className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Pronta Entrega</span>
                  <span className="text-[11px] text-stone-500">Peças prontas para entrega imediata</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOrderTypeChange('encomenda')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  orderType === 'encomenda'
                    ? 'bg-amber-50 border-amber-400 text-stone-900 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Encomenda / Pedido</span>
                  <span className="text-[11px] text-stone-500">Produzir para entregar depois</span>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION: Products & Items (Multi-item support with searchable combobox & quantity selectors) */}
          <div className="bg-stone-50/80 border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-600" />
                Produtos do Pedido ({items.length} {items.length === 1 ? 'item' : 'itens'}) *
              </label>
              {items.length > 0 && (
                <span className="text-xs font-semibold text-stone-600">
                  Total de peças: <strong className="text-stone-900">{totalQuantity}</strong>
                </span>
              )}
            </div>

            {/* Adicionar item do catálogo ou item personalizado de uso único */}
            <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[11px] font-bold text-stone-700">
                  Buscar e Adicionar Peça ao Pedido:
                </span>

                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCustomItemMode}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCustomItemMode(checked);
                      if (!checked) resetCustomItemEditor();
                    }}
                    className="w-3.5 h-3.5 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Personalizado
                </label>
              </div>

              {!isCustomItemMode ? (
                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                    Produto (Digite o nome para buscar)
                  </label>

                  <div className={`space-y-2.5 ${
                    selectedProductIdToAdd
                      ? 'rounded-xl border border-amber-300 bg-amber-50/70 p-2.5'
                      : ''
                  }`}>
                    <SearchableProductCombobox
                      products={products}
                      selectedProductId={selectedProductIdToAdd}
                      onSelectProduct={handleSelectProductToAdd}
                      placeholder="Digite para buscar produto final..."
                      id="order-product-search-combobox"
                      filterOnlyFinalForSale={true}
                      embeddedSelectedCard={true}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold text-stone-500 mb-0.5">Qtd</label>
                        <div className="flex w-full">
                          <button
                            type="button"
                            onClick={() =>
                              setQtyToAdd((current) =>
                                String(Math.max(1, (parseInt(current, 10) || 1) - 1))
                              )
                            }
                            className="w-10 shrink-0 rounded-l-lg border border-r-0 border-stone-300 bg-stone-50 text-stone-700 font-bold hover:bg-stone-100"
                            aria-label="Diminuir quantidade"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={qtyToAdd}
                            onChange={(e) => setQtyToAdd(e.target.value)}
                            className="min-w-0 flex-1 px-2.5 py-2 text-sm bg-white border border-stone-300 focus:ring-2 focus:ring-amber-500 text-stone-900 font-bold text-center"
                            placeholder="1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQtyToAdd((current) =>
                                String(Math.max(1, (parseInt(current, 10) || 1) + 1))
                              )
                            }
                            className="w-10 shrink-0 rounded-r-lg border border-l-0 border-stone-300 bg-stone-50 text-stone-700 font-bold hover:bg-stone-100"
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold text-stone-500 mb-0.5">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={priceToAdd}
                          onChange={(e) => setPriceToAdd(e.target.value)}
                          onBlur={() => {
                            const parsed = parseFloat(priceToAdd);
                            if (Number.isFinite(parsed)) {
                              setPriceToAdd(Math.max(0, parsed).toFixed(2));
                            }
                          }}
                          className="w-full px-2.5 py-2 text-sm font-bold text-center bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                          placeholder="0,00"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-98 shadow-2xs"
                        >
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                        Nome do item personalizado *
                      </label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Ex: Vela em recipiente da cliente"
                        className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-stone-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Qtd</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        className="w-full px-2.5 py-2 text-sm bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-stone-900 font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Preço (opcional)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full px-2.5 py-2 text-sm bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-stone-900"
                        placeholder="0,00"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleSaveCustomItem}
                        className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{customEditingItemId ? 'Salvar' : 'Adicionar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[11px] font-bold text-purple-950">Insumos / composição</span>
                        <span className="text-[10px] text-purple-700 ml-1.5">opcional — pode preencher depois</span>
                      </div>
                      <span className="text-[10px] font-semibold text-purple-800">
                        Custo atual: {formatCurrency(customRecipeItems.reduce((sum, item) => sum + (item.totalCost || 0), 0))}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-7">
                        <label className="block text-[10px] font-bold text-stone-500 mb-0.5">Material</label>
                        <SearchableMaterialCombobox
                          materials={materials}
                          selectedMaterialId={customMaterialId}
                          onSelectMaterial={(mat) => {
                            setCustomMaterialId(mat?.id || '');
                            setCustomVariableSelections({});
                          }}
                          placeholder="Buscar material..."
                          id="custom-order-material-search"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-stone-500 mb-0.5">Quantidade</label>
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          value={customMaterialQty}
                          onChange={(e) => setCustomMaterialQty(e.target.value)}
                          className="w-full px-2.5 py-2 text-sm bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-stone-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCustomMaterial}
                          className="w-full py-2 px-2.5 bg-white hover:bg-purple-50 border border-purple-300 text-purple-900 text-[11px] font-bold rounded-lg"
                        >
                          + Insumo
                        </button>
                      </div>
                    </div>

                    {selectedCustomMaterial?.isVirtualRecipe && customVirtualRequirements.length > 0 && (
                      <div className="rounded-lg border border-purple-200 bg-white p-3 space-y-2">
                        <div>
                          <span className="text-[11px] font-bold text-purple-950">Escolha da receita virtual</span>
                          <p className="text-[10px] text-purple-700 mt-0.5">
                            Selecione agora qual material será usado nas categorias variáveis desta receita.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {customVirtualRequirements.map((requirement, index) => {
                            const categoryMaterials = materials.filter(
                              (m) => !m.isVirtualRecipe && m.category === requirement.category
                            );
                            return (
                              <div key={requirement.recipeItemId}>
                                <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                                  {requirement.category} *
                                </label>
                                <SearchableMaterialCombobox
                                  materials={categoryMaterials}
                                  selectedMaterialId={customVariableSelections[requirement.recipeItemId] || ''}
                                  onSelectMaterial={(mat) => {
                                    setCustomVariableSelections((prev) => ({
                                      ...prev,
                                      [requirement.recipeItemId]: mat?.id || '',
                                    }));
                                  }}
                                  placeholder={`Escolha um material de ${requirement.category}...`}
                                  id={`custom-virtual-category-${index}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {customRecipeItems.length > 0 && (
                      <div className="space-y-1.5">
                        {customRecipeItems.map((recipeItem) => (
                          <div key={recipeItem.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-purple-100 px-2.5 py-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11px] font-bold text-stone-800 block truncate">{recipeItem.name}</span>
                                {materials.find((m) => m.id === recipeItem.targetId)?.isVirtualRecipe && (
                                  <span className="shrink-0 text-[9px] font-bold text-purple-800 bg-purple-100 border border-purple-200 rounded px-1.5 py-0.5">
                                    Receita virtual
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-500">
                                {recipeItem.quantity} {recipeItem.unit} × {formatCurrency(recipeItem.unitCost)}
                              </span>
                              {recipeItem.categorySelections && Object.keys(recipeItem.categorySelections).length > 0 && (
                                <div className="text-[10px] text-purple-700 mt-0.5">
                                  {Object.entries(recipeItem.categorySelections).map(([recipeItemId, materialId]) => {
                                    const virtualMaterial = materials.find((m) => m.id === recipeItem.targetId);
                                    const categoryItem = virtualMaterial?.recipeItems?.find((item) => item.id === recipeItemId);
                                    const selectedMaterial = materials.find((m) => m.id === materialId);
                                    return (
                                      <span key={recipeItemId} className="mr-2">
                                        {categoryItem?.targetCategory || 'Escolha'}: <strong>{selectedMaterial?.name || 'não encontrado'}</strong>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-stone-800">{formatCurrency(recipeItem.totalCost)}</span>
                              <button
                                type="button"
                                onClick={() => setCustomRecipeItems((prev) => prev.filter((item) => item.id !== recipeItem.id))}
                                className="p-1 text-stone-400 hover:text-rose-600"
                                title="Remover insumo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {customEditingItemId && (
                      <button
                        type="button"
                        onClick={() => {
                          resetCustomItemEditor();
                          setIsCustomItemMode(false);
                        }}
                        className="text-[10px] font-semibold text-stone-500 hover:text-stone-800 underline"
                      >
                        Cancelar edição do item
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Items List Table / Cards */}
            {items.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-dashed border-stone-300 text-center text-xs text-stone-500">
                Nenhum item adicionado ao pedido ainda. Busque um produto do catálogo ou marque “Personalizado” para uma encomenda única.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100 shadow-2xs">
                {items.map((item, idx) => {
                  const itemId = item.id || `item_${idx}_${item.productId}`;
                  const itemSubtotal = item.subtotal ?? (item.quantity * item.unitPrice);
                  return (
                    <div key={itemId} className="p-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5 hover:bg-stone-50/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-[1_1_240px]">
                        {item.productImageUrl ? (
                          <img
                            src={item.productImageUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.isCustom && (
                              <Sparkles
                                className="w-3.5 h-3.5 text-purple-600 shrink-0"
                                aria-label="Item personalizado"
                              />
                            )}
                            <span className="text-xs font-bold text-stone-900 block whitespace-nowrap">
                              {item.productName}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500">
                            {item.isCustom && (!item.customRecipeItems || item.customRecipeItems.length === 0)
                              ? 'Custo ainda não preenchido'
                              : `Custo un: ${formatCurrency(item.unitCost)}`}
                          </span>

                          {(() => {
                            const stockInfo = getModalStockInfo(item);
                            return (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[10px]">
                                  <span className="text-stone-500">
                                    Estoque físico: <strong className="text-stone-700">{stockInfo.physical}</strong>
                                  </span>
                                  <span className="text-stone-500">
                                    Reservado aqui: <strong className="text-stone-700">{stockInfo.reservedThis}</strong>
                                  </span>
                                  <span className="text-stone-500">
                                    Outros pedidos: <strong className="text-stone-700">{stockInfo.reservedOther}</strong>
                                  </span>
                                  <span className="text-stone-500">
                                    Disponível: <strong className="text-stone-700">{stockInfo.available}</strong>
                                  </span>
                                  <span className={stockInfo.missing > 0 ? 'text-amber-800 font-bold' : 'text-emerald-700 font-bold'}>
                                    {stockInfo.missing > 0 ? `Faltam ${stockInfo.missing}` : 'Pedido coberto'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {stockInfo.missing > 0 && stockInfo.available > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleReserveItemInModal(item)}
                                      className="px-2 py-1 rounded-md bg-stone-900 text-white text-[10px] font-bold hover:bg-stone-800"
                                    >
                                      Reservar
                                    </button>
                                  )}
                                  {stockInfo.reservedThis > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleReleaseItemInModal(item)}
                                      className="px-2 py-1 rounded-md border border-stone-300 bg-white text-stone-600 text-[10px] font-semibold hover:bg-stone-100"
                                    >
                                      Liberar reserva
                                    </button>
                                  )}
                                  {!existingSale && (
                                    <span className="text-[9px] text-stone-400">
                                      salve o pedido para reservar
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {item.isCustom && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleProduceCustomItemNow(item)}
                                disabled={!existingSale || !item.customRecipeItems?.length}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-800 text-[10px] font-bold hover:bg-purple-100 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                                title={
                                  !existingSale
                                    ? 'Salve o pedido primeiro para liberar a produção'
                                    : !item.customRecipeItems?.length
                                      ? 'Preencha os insumos antes de produzir'
                                      : 'Produzir uma unidade, baixar insumos e adicionar ao estoque'
                                }
                              >
                                <Package className="w-3 h-3" />
                                Produzir +1
                              </button>
                              {(item.customProducedQuantity || 0) > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-700">
                                  Produzido: {item.customProducedQuantity} un
                                </span>
                              )}
                              {!existingSale && (
                                <span className="text-[10px] text-stone-400">
                                  salve o pedido para produzir
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Selector with +/- buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(itemId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 flex items-center justify-center text-xs font-bold cursor-pointer"
                          title="Diminuir quantidade"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemQty(itemId, parseInt(e.target.value, 10) || 1)}
                          className="w-12 py-1 text-xs font-bold text-center bg-stone-50 border border-stone-200 rounded-md focus:ring-1 focus:ring-amber-500 text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(itemId, item.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold cursor-pointer"
                          title="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Price */}
                      <div className="flex items-center gap-1 shrink-0 w-24">
                        <span className="text-[11px] text-stone-400 font-medium">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItemPrice(itemId, parseFloat(e.target.value) || 0)}
                          className="w-full py-1 px-1.5 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-md focus:ring-1 focus:ring-amber-500 text-stone-900 text-right"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="w-20 text-right shrink-0">
                        <span className="text-xs font-bold text-stone-900 block">
                          {formatCurrency(itemSubtotal)}
                        </span>
                      </div>

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleEditCustomItem(item)}
                          className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Editar item personalizado e composição"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete item button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemId)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date, Customer Selection & Quick Add */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Data do Pedido *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full sm:w-60 px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>

            {/* Customer Box */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  Cliente do Pedido
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/90 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-700" />
                  <span>+ Novo Cliente Rápido</span>
                </button>
              </div>

              {selectedCustomer ? (
                <div className="p-3 bg-amber-50/80 border border-amber-300/90 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-950 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm truncate">
                          {selectedCustomer.name}
                        </span>
                        {isBirthdayInMonth(selectedCustomer.birthdate) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded border border-amber-400">
                            <Cake className="w-2.5 h-2.5 text-amber-800" />
                            Aniversariante!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-600 mt-0.5 flex-wrap">
                        {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                        {selectedCustomer.birthdate && (
                          <span className="text-stone-500">🎂 {formatBirthday(selectedCustomer.birthdate)}</span>
                        )}
                        {(selectedCustomer.defaultDiscountCodeId || (selectedCustomer.defaultDiscountPercent || 0) > 0) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f5e8df] text-[#8b503c] border border-[#ead4c8]">
                            {selectedCustomer.defaultDiscountCodeId
                              ? (discountCodes.find((code) => code.id === selectedCustomer.defaultDiscountCodeId)?.code || 'Cupom')
                              : `${selectedCustomer.defaultDiscountPercent}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId(undefined);
                      setCustomerName('');
                      setCustomerContact('');
                    }}
                    className="text-xs text-stone-500 hover:text-rose-600 font-medium underline cursor-pointer shrink-0"
                  >
                    Trocar / Desvincular
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Selecione um cliente já cadastrado ({customers.length} disponíveis):
                    </label>
                    <select
                      value={customerId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setCustomerId(undefined);
                          return;
                        }
                        const found = customers.find((c) => c.id === val);
                        if (found) {
                          setCustomerId(found.id);
                          setCustomerName(found.name);
                          setCustomerContact(found.phone);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
                    >
                      <option value="">-- Escolher Cliente da Lista --</option>
                      {[...customers]
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''} {c.birthdate ? `🎂 ${formatBirthday(c.birthdate)}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200/70">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-0.5">
                        Ou digite o Nome avulso:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Amanda Silva (Cliente balcão)"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setCustomerId(undefined);
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-0.5">
                        Telefone / WhatsApp:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: (11) 99999-0000"
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Category Selection: "offline", "site" ou +nova categoria */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  Forma / Canal de Pagamento *
                </label>
                {!isAddingPaymentCategory && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPaymentCategory(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-amber-600" />
                    <span>+ Nova Categoria</span>
                  </button>
                )}
              </div>

              {/* Badges / Options */}
              <div className="flex flex-wrap items-center gap-2">
                {allPaymentCategories.map((method) => {
                  const isSelected = paymentMethod.toLowerCase() === method.toLowerCase();
                  const isOffline = method.toLowerCase() === 'offline';
                  const isSite = method.toLowerCase() === 'site';

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:bg-amber-50/40'
                      }`}
                    >
                      {isOffline ? (
                        <Store className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
                      ) : isSite ? (
                        <Globe className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-stone-500'}`} />
                      ) : (
                        <Tag className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
                      )}
                      <span>{method}</span>
                      {isSelected && <Check className="w-3 h-3 text-amber-400 ml-0.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Inline input to add custom payment category */}
              {isAddingPaymentCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Nome da categoria (ex: Pix, Cartão, Boleto, etc.)"
                    value={newPaymentCategoryInput}
                    onChange={(e) => setNewPaymentCategoryInput(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewPaymentCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewPaymentCategory}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-lg cursor-pointer"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPaymentCategory(false);
                      setNewPaymentCategoryInput('');
                    }}
                    className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order Discount */}
          <div className="p-4 rounded-xl bg-[#fbf7f2] border border-[#eadfd6] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-[#b96f55]" />
                Desconto do pedido
              </label>
              {discountAmount > 0 && (
                <span className="text-xs font-bold text-[#a86149]">
                  -{formatCurrency(discountAmount)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['none', 'Sem desconto'],
                ['code', 'Código'],
                ['percentage', '% manual'],
                ['fixed', 'R$ manual'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setDiscountMode(mode as 'none' | 'code' | 'percentage' | 'fixed');
                    if (mode === 'none') {
                      setDiscountCodeId('');
                      setManualDiscountValue('');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${discountMode === mode ? 'bg-[#b96f55] text-white border-[#b96f55]' : 'bg-white text-stone-600 border-stone-200 hover:border-[#c98a72]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {discountMode === 'code' && (
              <select
                value={discountCodeId}
                onChange={(e) => setDiscountCodeId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#b96f55] text-stone-900"
              >
                <option value="">Escolher código de desconto...</option>
                {discountCodes.filter((code) => code.active !== false).map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.code} · {code.type === 'percentage' ? `${code.value}%` : formatCurrency(code.value)}
                  </option>
                ))}
              </select>
            )}

            {(discountMode === 'percentage' || discountMode === 'fixed') && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={discountMode === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={manualDiscountValue}
                  onChange={(e) => setManualDiscountValue(e.target.value)}
                  placeholder={discountMode === 'percentage' ? 'Ex: 10' : 'Ex: 20,00'}
                  className="w-full px-3 py-2 pr-10 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#b96f55] text-stone-900"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                  {discountMode === 'percentage' ? '%' : 'R$'}
                </span>
              </div>
            )}

            {selectedCustomer && (
              <div className="text-[10px] text-stone-500">
                {selectedCustomer.defaultDiscountCodeId || (selectedCustomer.defaultDiscountPercent || 0) > 0
                  ? 'Benefício padrão do cliente aplicado automaticamente neste novo pedido.'
                  : 'Este cliente não possui benefício padrão cadastrado.'}
              </div>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Canal de Venda
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
            >
              <option value="Instagram">Instagram Direct</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Elo7">Elo7</option>
              <option value="Feira Criativa">Feira / Bazar</option>
              <option value="Loja Parceira">Loja Parceira</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Delivery Configuration Section */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" />
                Controle de Entrega
              </span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryStatus"
                    checked={deliveryStatus === 'entregue'}
                    onChange={() => setDeliveryStatus('entregue')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-stone-800">Já Entregue</span>
                </label>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer ml-2">
                  <input
                    type="radio"
                    name="deliveryStatus"
                    checked={deliveryStatus === 'pendente_entrega'}
                    onChange={() => setDeliveryStatus('pendente_entrega')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-amber-900">Entregar Depois 📦</span>
                </label>
              </div>
            </div>

            {deliveryStatus === 'pendente_entrega' && (
              <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                  Data Programada para Entrega:
                </label>
                <input
                  type="date"
                  value={deliveryScheduledDate}
                  onChange={(e) => setDeliveryScheduledDate(e.target.value)}
                  className="w-full sm:w-48 px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 font-semibold"
                />
              </div>
            )}
          </div>

          {/* Payment Configuration Section */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Controle de Pagamento
              </span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="paymentStatus"
                    checked={paymentStatus === 'pago'}
                    onChange={() => setPaymentStatus('pago')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-stone-800">Pago na Hora ✓</span>
                </label>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer ml-2">
                  <input
                    type="radio"
                    name="paymentStatus"
                    checked={paymentStatus === 'pendente_pagamento'}
                    onChange={() => setPaymentStatus('pendente_pagamento')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-rose-900">Receber Depois ⏳</span>
                </label>
              </div>
            </div>

            {paymentStatus === 'pendente_pagamento' && (
              <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-rose-600" />
                  Data Prevista para Recebimento:
                </label>
                <input
                  type="date"
                  value={paymentScheduledDate}
                  onChange={(e) => setPaymentScheduledDate(e.target.value)}
                  className="w-full sm:w-48 px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-stone-900 font-semibold"
                />
              </div>
            )}
          </div>

          {/* Profit Preview Banner */}
          {items.length > 0 && (
            <div className={`border rounded-2xl p-4 space-y-2 text-xs ${isLoss ? 'bg-red-50/80 border-red-200' : 'bg-emerald-50/80 border-emerald-200'}`}>
              <div className="flex justify-between text-stone-600">
                <span>Subtotal ({totalQuantity} peças):</span>
                <span className="font-semibold text-stone-900">{formatCurrency(subtotalRevenue)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#a86149]">
                  <span>
                    Desconto{discountMode === 'code' && appliedDiscountCode ? ` · ${appliedDiscountCode.code}` : ''}:
                  </span>
                  <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-700 font-semibold">
                <span>Total do pedido:</span>
                <span className="font-bold text-stone-900">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Custo de Produção Total dos Itens:</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
              <div className={`pt-2 border-t flex justify-between items-baseline ${isLoss ? 'border-red-200' : 'border-emerald-200'}`}>
                <span className={`font-bold ${isLoss ? 'text-red-950' : 'text-emerald-950'}`}>Lucro Líquido Real:</span>
                <div className="text-right">
                  <span className={`text-lg font-extrabold ${isLoss ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}
                  </span>
                  <span className={`text-xs ml-1.5 font-semibold ${isLoss ? 'text-red-800' : 'text-emerald-800'}`}>
                    ({formatPercent(marginPercent)})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Observações / Detalhes do Pedido
            </label>
            <input
              type="text"
              placeholder="Ex: Fita lilás, cartão 'Com Carinho', combinar entrega no metrô..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          {/* Footer */}
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
              <span>{existingSale ? 'Salvar Alterações' : 'Concluir Pedido'}</span>
            </button>
          </div>
        </form>

        {/* Quick Customer Registration Modal Overlay */}
        {isQuickCustomerOpen && (
          <div className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Cadastro Rápido de Cliente</h4>
                    <p className="text-[11px] text-stone-500">Adicione os dados e vincule ao pedido instantaneamente</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Nome Completo do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Amanda Silva"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-0000"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Data de Aniversário</span>
                    <span className="text-[10px] text-stone-400 font-normal">Dia e Mês ou Data Completa</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 15/09 ou 1992-09-15"
                    value={quickBirthdate}
                    onChange={(e) => setQuickBirthdate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Observações / Preferências
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Gosta de tons lilás, prefere entrega aos sábados..."
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 text-sm"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200/70 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickCustomer}
                  disabled={!quickName.trim()}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Cadastrar e Vincular</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
