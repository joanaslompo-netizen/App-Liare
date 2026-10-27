import { ModalFrame } from './ModalFrame';
import { localDateString } from '../utils/localDate';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Calendar, 
  Building2, 
  Receipt, 
  Truck, 
  Trash2, 
  Eye, 
  Pencil,
  X, 
  Check, 
  DollarSign, 
  ArrowUpRight 
} from 'lucide-react';
import { Purchase, PurchaseItem, PurchasePayment, PurchaseEditOptions, FinanceData, Material, Supplier, UnitOfMeasure } from '../types';
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  UNIT_SHORT,
  matchesSearchText
} from '../utils/formatters';
import { FinancialAccountSelect } from './FinancialAccountSelect';
import { accountName, cardFirstDueDate, monthlyDueDate } from '../utils/bankAccounts';
import { allocateCents, cents, money, newId } from '../utils/financeLedger';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';
import { purchaseFingerprint, purchaseItemId, purchasePaymentState } from '../utils/purchaseEditing';

interface PurchasesViewProps {
  finance?: FinanceData;
  purchases: Purchase[];
  materials: Material[];
  suppliers: Supplier[];
  onSavePurchase: (purchase: Purchase, updateStock: boolean, payment?: PurchasePayment, edit?: PurchaseEditOptions) => void | boolean | Promise<boolean>;
  onDeletePurchase: (id: string) => void;
  onOpenSuppliers?: () => void;
  openNewPurchaseSignal?: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  finance = {version: 1, entries: [], bills: []},
  materials,
  suppliers,
  onSavePurchase,
  onDeletePurchase,
  onOpenSuppliers,
  openNewPurchaseSignal = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [notice, setNotice] = useState('');
  const editPurchase = (purchase: Purchase) => {
    setViewingPurchase(null);
    setEditingPurchase(purchase);
    setIsModalOpen(true);
  };
  const newPurchase = () => { setEditingPurchase(null); setIsModalOpen(true); };

  useEffect(() => {
    if (openNewPurchaseSignal > 0) { setEditingPurchase(null); setIsModalOpen(true); }
  }, [openNewPurchaseSignal]);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        const matchesSearch =
          matchesSearchText(p.supplierName, searchTerm) ||
          (p.invoiceNumber && matchesSearchText(p.invoiceNumber, searchTerm)) ||
          (p.notes && matchesSearchText(p.notes, searchTerm)) ||
          p.items.some((it) => matchesSearchText(it.materialName, searchTerm));

        const matchesSupplier =
          selectedSupplierFilter === 'all' || p.supplierId === selectedSupplierFilter;

        return matchesSearch && matchesSupplier;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, searchTerm, selectedSupplierFilter]);

  // Aggregate totals
  const totalSpent = filteredPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
            Histórico de Compras de Materiais
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Registre entradas de notas, pedidos com fornecedores e reabastecimento de estoque.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenSuppliers && (
            <button
              type="button"
              onClick={onOpenSuppliers}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 text-sm font-medium rounded-xl border border-stone-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Building2 className="w-4 h-4 text-amber-700" />
              <span>Fornecedores</span>
            </button>
          )}

          <button
            id="btn-add-purchase"
            onClick={newPurchase}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Registrar Compra / NF</span>
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {/* Summary banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Total Gasto no Período
          </span>
          <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">
            {formatCurrency(totalSpent)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Total de Pedidos Registrados
          </span>
          <span className="text-2xl font-bold text-stone-900 mt-0.5 block">
            {filteredPurchases.length}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-500 block uppercase font-medium">
            Ticket Médio por Compra
          </span>
          <span className="text-2xl font-bold text-stone-900 mt-0.5 block">
            {filteredPurchases.length > 0
              ? formatCurrency(totalSpent / filteredPurchases.length)
              : 'R$ 0,00'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por fornecedor, NF ou material comprado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
          >
            <option value="all">Todos os Fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchases Table / List */}
      {filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            Nenhuma compra encontrada
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            Registre compras de tecidos, zíperes e insumos para manter os custos unitários e estoque sempre atualizados.
          </p>
          <button
            onClick={newPurchase}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Registrar Primeira Compra</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">NF / Doc</th>
                  <th className="py-3 px-4">Itens Comprados</th>
                  <th className="py-3 px-4 text-right">Frete</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-stone-700 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        {formatDate(p.date)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        {p.supplierName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500 font-mono text-xs">
                      {p.invoiceNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-stone-700">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {p.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-800"
                          >
                            {formatNumber(it.quantity)} {UNIT_SHORT[it.unit]} {it.materialName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-stone-500 whitespace-nowrap">
                      {p.shippingCost > 0 ? formatCurrency(p.shippingCost) : 'Grátis'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-stone-900 whitespace-nowrap">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingPurchase(p)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!p.cancelledAt && <button type="button" onClick={() => editPurchase(p)}
                          aria-label={`Editar compra de ${p.supplierName}`} title="Editar compra"
                          className="inline-flex items-center gap-1 p-1.5 text-stone-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" /><span className="text-xs">Editar</span>
                        </button>}
                        <button
                          onClick={() => {
                            if (confirm('Deseja excluir este registro de compra?')) {
                              onDeletePurchase(p.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      {isModalOpen && (
        <NewPurchaseModal
          key={editingPurchase?.id || 'new'}
          original={editingPurchase}
          isOpen={isModalOpen}
          finance={finance}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setIsModalOpen(false)}
          onSave={async (p, updateStock, payment, edit) => {
            if (await onSavePurchase(p, updateStock, payment, edit) === false) return false;
            setIsModalOpen(false);
            setEditingPurchase(null);
            setNotice(edit ? 'Compra atualizada.' : 'Compra registrada.');
            return true;
          }}
        />
      )}

      {/* Purchase Details Modal */}
      {viewingPurchase && (
        <PurchaseDetailsModal
          purchase={viewingPurchase}
          finance={finance}
          onClose={() => setViewingPurchase(null)}
          onEdit={() => editPurchase(viewingPurchase)}
        />
      )}
    </div>
  );
};

// ==========================================
// New Purchase Modal
// ==========================================

interface NewPurchaseModalProps {
  original?: Purchase | null;
  finance: FinanceData;
  isOpen: boolean;
  materials: Material[];
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (p: Purchase, updateStock: boolean, payment?: PurchasePayment, edit?: PurchaseEditOptions) => boolean | Promise<boolean>;
}

const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  original,
  finance,
  materials,
  suppliers,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(original?.date || localDateString());
  const [supplierId, setSupplierId] = useState(original?.supplierId || '');
  const [freeSupplierName, setFreeSupplierName] = useState(original?.supplierName || '');
  const [invoiceNumber, setInvoiceNumber] = useState(original?.invoiceNumber || '');
  const [shippingCost, setShippingCost] = useState(String(original?.shippingCost || 0));
  const [notes, setNotes] = useState(original?.notes || '');
  const [updateStock, setUpdateStock] = useState(original?.stockApplied ?? true);
  const [originalStock, setOriginalStock] = useState(original?.stockApplied === undefined ? '' : String(original.stockApplied));
  const [paymentType, setPaymentType] = useState(original ? original.paymentPlan?.cardId ? 'card' : original.paymentPlan?.paidNow ? 'paid' : 'later' : 'paid');
  const [cardId, setCardId] = useState(original?.paymentPlan?.cardId || finance.cards?.[0]?.id || '');
  const [installments, setInstallments] = useState(original?.paymentPlan?.installments || 1);
  const [busy, setBusy] = useState(false);
  const [purchaseId] = useState(() => original?.id || newId());
  const [operationId] = useState(newId);
  const paymentState = original ? purchasePaymentState(original, finance) : null;
  const selectedCard = finance.cards?.find(card => card.id === cardId);
  const [dueDate, setDueDate] = useState(original?.paymentPlan?.dueDate || original?.date || localDateString());
  const closingDay = selectedCard?.closingDay, cardDueDay = selectedCard?.dueDay;
  useEffect(() => {
    if (paymentState?.locked || (original?.date === date && original.paymentPlan?.cardId === cardId)) return;
    if (paymentType === 'card' && closingDay && cardDueDay && date) setDueDate(cardFirstDueDate(date, {closingDay, dueDay: cardDueDay}));
  }, [paymentType, cardId, closingDay, cardDueDay, date, original, paymentState?.locked]);
  const [account, setAccount] = useState(original?.paymentPlan?.account || 'Principal');

  // Items in this purchase
  const [items, setItems] = useState<PurchaseItem[]>(() => original?.items.map((item, index) => ({ ...item, id: purchaseItemId(original, index) })) || []);

  // Item being added
  const [selectedMatId, setSelectedMatId] = useState('');
  const [qty, setQty] = useState('1');
  const [pricePaid, setPricePaid] = useState('');

  const selectedMat = useMemo(() => {
    return materials.find((m) => m.id === selectedMatId);
  }, [materials, selectedMatId]);

  const handleAddItem = () => {
    if (!selectedMatId) {
      alert('Selecione um material da lista.');
      return;
    }
    const mat = materials.find((m) => m.id === selectedMatId);
    if (!mat) return;

    const parsedQty = parseFloat(qty);
    const parsedPrice = parseFloat(pricePaid);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Informe o valor pago.');
      return;
    }

    const newItem: PurchaseItem = {
      id: newId(),
      materialId: mat.id,
      materialName: mat.name,
      quantity: parsedQty,
      unit: mat.packageUnit || mat.unit,
      packagePrice: parsedPrice,
      totalPrice: parsedPrice,
    };

    setItems([...items, newItem]);
    setSelectedMatId('');
    setQty('1');
    setPricePaid('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const itemsTotal = items.reduce((acc, it) => acc + it.totalPrice, 0);
  const parsedShipping = parseFloat(shippingCost) || 0;
  const totalAmount = itemsTotal + parsedShipping;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (original && originalStock === '') { alert('Confirme se o estoque da compra original já foi registrado.'); return; }
    if (paymentType === 'card' && !selectedCard) { alert('Selecione um cartão cadastrado.'); return; }
    if (items.length === 0) {
      alert('Adicione pelo menos um item à compra.');
      return;
    }

    const sup = suppliers.find((s) => s.id === supplierId);
    const supplierName = sup ? sup.name : (freeSupplierName.trim() || 'Fornecedor Avulso');

    const purchase: Purchase = {
      ...original,
      id: purchaseId,
      date,
      supplierId: supplierId || undefined,
      supplierName,
      invoiceNumber: invoiceNumber.trim() || undefined,
      items,
      shippingCost: parsedShipping,
      totalAmount,
      notes: notes.trim() || undefined,
      createdAt: original?.createdAt || localDateString(),
    };

    setBusy(true);
    try { await onSave(purchase, updateStock, {paidNow: paymentType === 'paid', dueDate, account, ...(paymentType === 'card' ? {cardId} : {}), installments: paymentType === 'paid' ? 1 : installments},
      original ? { operationId, expectedFingerprint: purchaseFingerprint(original), originalStockApplied: originalStock === 'true' } : undefined); }
    catch (failure) { alert(failure instanceof Error ? failure.message : 'Não foi possível salvar a compra.'); }
    finally { setBusy(false); }
  };

  return (
    <ModalFrame onClose={onClose} className="liare-form-dialog fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Modal Header */}
        <div className="liare-modal-header flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-stone-900 text-lg">
              {original ? 'Editar compra' : 'Registrar Compra de Materiais'}
            </h3>
          </div>
          <button aria-label="Fechar janela" type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="liare-modal-body p-6 space-y-5 text-stone-900">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="purchase-date" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Data da Compra *
              </label>
              <input
                id="purchase-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Fornecedor
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              >
                <option value="">Selecione ou Avulso</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!supplierId && (
                <input
                  type="text"
                  aria-label="Nome do fornecedor avulso"
                  placeholder="Nome do fornecedor (opcional)"
                  value={freeSupplierName}
                  onChange={(event) => setFreeSupplierName(event.target.value)}
                  className="mt-2 w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                NF / Recibo / Pedido
              </label>
              <input
                type="text"
                placeholder="Ex: NF-4081"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>
          </div>

          {/* Add item to purchase box */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Adicionar Itens da Nota / Pedido
              </h4>
              <span className="text-[11px] text-stone-500">
                {materials.length} materiais cadastrados no ateliê
              </span>
            </div>

            {/* Searchable Material Combobox */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Material Comprado <span className="text-rose-500">*</span>
              </label>
              <SearchableMaterialCombobox
                materials={materials}
                selectedMaterialId={selectedMatId}
                onSelectMaterial={(mat) => {
                  if (mat) {
                    setSelectedMatId(mat.id);
                    const currentQty = parseFloat(qty) || 1;
                    setPricePaid((mat.packagePrice * currentQty).toFixed(2));
                  } else {
                    setSelectedMatId('');
                    setPricePaid('');
                  }
                }}
                placeholder="Comece a digitar o nome do material (ex: cera, pavio, rótulo, essência, pote)..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
              <div className="sm:col-span-4">
                <label htmlFor="purchase-quantity" className="block text-[11px] font-medium text-stone-600 mb-1">
                  Quantidade Comprada
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    id="purchase-quantity"
                    value={qty}
                    onChange={(e) => {
                      const newQty = e.target.value;
                      setQty(newQty);
                      if (selectedMat) {
                        const parsed = parseFloat(newQty);
                        if (!isNaN(parsed) && parsed > 0) {
                          setPricePaid((selectedMat.packagePrice * parsed).toFixed(2));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                  />
                  {selectedMat && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 pointer-events-none">
                      {UNIT_SHORT[selectedMat.packageUnit] || selectedMat.packageUnit}
                    </span>
                  )}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="purchase-item-total" className="block text-[11px] font-medium text-stone-600 mb-1">
                  Valor total deste item (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="purchase-item-total"
                    value={pricePaid}
                    onChange={(e) => setPricePaid(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 font-semibold"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <button
                  type="button"
                  id="btn-insert-purchase-item"
                  onClick={handleAddItem}
                  className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inserir Item</span>
                </button>
              </div>
            </div>

            {selectedMat && (
              <div className="text-[11px] text-stone-500 bg-amber-50/50 rounded-lg p-2.5 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>
                  Conversão para estoque: 1 {selectedMat.packageUnit} = {formatNumber(selectedMat.packageQuantity)} {UNIT_SHORT[selectedMat.unit]}.
                  {parseFloat(qty) > 0 && (
                    <strong className="text-amber-900 ml-1">
                      Entrarão +{formatNumber((parseFloat(qty) || 0) * selectedMat.packageQuantity)} {UNIT_SHORT[selectedMat.unit]} no estoque.
                    </strong>
                  )}
                </span>
                {parseFloat(pricePaid) > 0 && parseFloat(qty) > 0 && (
                  <span className="font-semibold text-stone-700">
                    Custo por {UNIT_SHORT[selectedMat.unit]}: {formatCurrency(parseFloat(pricePaid) / ((parseFloat(qty) || 1) * selectedMat.packageQuantity))}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-right">Valor</th>
                    <th className="py-2 px-3 text-center">Remover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-stone-900">{it.materialName}</td>
                      <td className="py-2 px-3 text-right text-stone-600"><input aria-label={`Quantidade do item ${idx + 1}`} type="number" min="0.0001" step="any" value={it.quantity || ''}
                        onChange={event => setItems(previous => previous.map((item, index) => index === idx ? { ...item, quantity: Number(event.target.value) } : item))}
                        className="w-20 rounded-lg border border-stone-300 bg-white p-2 text-right" /> {it.unit}</td>
                      <td className="py-2 px-3 text-right font-bold text-stone-900"><input aria-label={`Valor do item ${idx + 1}`} type="number" min="0" step="0.01" value={it.totalPrice}
                        onChange={event => setItems(previous => previous.map((item, index) => index === idx ? { ...item, totalPrice: Number(event.target.value), packagePrice: Number(event.target.value) } : item))}
                        className="w-24 rounded-lg border border-stone-300 bg-white p-2 text-right" /></td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          aria-label={`Remover item ${idx + 1}`}
                          onClick={() => handleRemoveItem(idx)}
                          className="text-stone-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Shipping and Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Valor do Frete (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-right">
              <span className="text-xs text-amber-900 font-semibold block">
                Valor Total da Compra:
              </span>
              <span className="text-xl font-black text-stone-900">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {original && original.stockApplied === undefined && <label className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            O estoque da compra original já foi registrado?
            <select required aria-label="Estoque da compra original" value={originalStock} onChange={event => setOriginalStock(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-2">
              <option value="">Selecione</option><option value="true">Sim, já entrou no estoque</option><option value="false">Não entrou no estoque</option>
            </select>
          </label>}
          {/* Update stock automatically checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="chk-update-stock"
              type="checkbox"
              checked={updateStock}
              onChange={(e) => setUpdateStock(e.target.checked)}
              className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
            />
            <label htmlFor="chk-update-stock" className="text-xs font-medium text-stone-700 cursor-pointer">
              {original ? 'Considerar esta compra no estoque (ajustar apenas a diferença)' : 'Somar automaticamente as quantidades compradas ao estoque atual dos materiais'}
            </label>
          </div>

          {paymentState?.legacy ? <p className="rounded-xl border bg-stone-50 p-4 text-sm">Esta compra antiga não possui um plano de pagamento registrado. A edição atualiza a compra e o estoque; não cria pagamentos ou parcelas.</p> : <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            {paymentState?.locked && <p className="text-sm text-stone-600">Os pagamentos já registrados serão mantidos. Uma diferença no total ajusta o saldo a pagar.</p>}
            {original && paymentState?.automaticPayment && <p className="text-sm text-stone-600">O pagamento à vista será corrigido junto com o total da compra.</p>}
            <fieldset disabled={paymentState?.locked} className="space-y-3 disabled:opacity-70">
            <label className="block text-sm font-semibold">Pagamento<select aria-label="Pagamento da compra" className="mt-1 w-full rounded-xl border bg-white p-2.5 text-base" value={paymentType} onChange={event => {setPaymentType(event.target.value); if(event.target.value === 'paid')setInstallments(1);}}><option value="paid">Já paguei à vista</option><option value="later">Pagar depois / boleto</option><option value="card">Cartão de crédito</option></select></label>
            {paymentType === 'paid' ? <label className="block text-sm">Conta de saída<FinancialAccountSelect required finance={finance} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-base" value={account} onChange={setAccount}/></label> : <>
              {paymentType === 'card' && <label className="block text-sm">Cartão<select required aria-label="Cartão da compra" className="mt-1 w-full rounded-xl border bg-white p-2.5 text-base" value={cardId} onChange={event=>setCardId(event.target.value)}><option value="">Selecione o cartão</option>{finance.cards?.map(card=><option key={card.id} value={card.id}>{card.name}</option>)}</select>{!finance.cards?.length && <span className="mt-1 block text-xs text-stone-500">Cadastre em Financeiro → Contas e cartões.</span>}</label>}
              <div className="grid grid-cols-2 gap-3"><label className="text-sm">Número de parcelas<input aria-label="Número de parcelas" required type="number" min="1" max="36" step="1" className="mt-1 w-full rounded-xl border bg-white p-2.5 text-base" value={installments || ''} onChange={event=>setInstallments(Number(event.target.value))}/></label><label className="text-sm">Primeiro vencimento<input aria-label="Primeiro vencimento" required type="date" className="mt-1 w-full rounded-xl border bg-white p-2.5 text-base" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label></div>
              {!paymentState?.locked && totalAmount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && Number.isInteger(installments) && installments >= 1 && installments <= 36 && <details className="rounded-xl border bg-white p-3" open><summary className="cursor-pointer text-sm font-medium">{installments === 1 ? 'Pagamento à vista no vencimento' : `${installments} parcelas · total ${formatCurrency(totalAmount)}`}</summary><div className="mt-2 space-y-1">{allocateCents(cents(totalAmount), Array(installments).fill(1)).map((value,index)=><div key={index} className="flex justify-between text-sm"><span>{index+1}/{installments} · {formatDate(index === 0 ? dueDate : monthlyDueDate(dueDate,index,paymentType === 'card' ? selectedCard?.dueDay : undefined))}</span><strong>{formatCurrency(money(value))}</strong></div>)}</div></details>}
              <p className="text-xs text-stone-500">A compra entra no estoque uma vez. {paymentType === 'card' ? 'As parcelas entram nas faturas; a conta bancária só muda ao registrar o pagamento.' : 'As parcelas ficam em A pagar até você registrar os pagamentos.'}</p>
            </>}
            </fieldset>
            <p className="text-xs text-stone-500">Custo da última compra usado na receita; custo médio mantido para o estoque.</p>
          </div>}
          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Observações da Compra
            </label>
            <input
              type="text"
              placeholder="Ex: Pagamento via Pix; tecidos para a coleção outono..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 text-sm font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>{busy ? 'Salvando…' : original ? 'Salvar alterações' : 'Salvar Compra'}</span>
            </button>
          </div>
        </form>
      </div>
    </ModalFrame>
  );
};

// Details Modal
const PurchaseDetailsModal: React.FC<{ purchase: Purchase; finance: FinanceData; onClose: () => void; onEdit: () => void }> = ({
  purchase,
  finance,
  onClose,
  onEdit,
}) => {
  return (
    <ModalFrame onClose={onClose} className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="liare-modal-header px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Detalhes da Compra
          </h3>
          <button aria-label="Fechar janela" type="button" onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="liare-modal-body p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-stone-200">
            <div>
              <span className="text-stone-500 block">Data:</span>
              <span className="font-semibold text-stone-900 text-sm">{formatDate(purchase.date)}</span>
            </div>
            <div>
              <span className="text-stone-500 block">Fornecedor:</span>
              <span className="font-semibold text-stone-900 text-sm">{purchase.supplierName}</span>
            </div>
            <div>
              <span className="text-stone-500 block">Nota / Recibo:</span>
              <span className="font-mono text-stone-700">{purchase.invoiceNumber || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-stone-500 block">Frete:</span>
              <span className="font-semibold text-stone-900">{formatCurrency(purchase.shippingCost)}</span>
            </div>
          </div>

          <div>
            <h5 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] mb-2">
              Itens Comprados
            </h5>
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600">
                  <tr>
                    <th className="py-2 px-3">Material</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {purchase.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-stone-900">{it.materialName}</td>
                      <td className="py-2 px-3 text-right text-stone-600">{formatNumber(it.quantity)} {it.unit}</td>
                      <td className="py-2 px-3 text-right font-bold text-stone-900">{formatCurrency(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex justify-between items-center">
            <span className="font-bold text-stone-900 text-sm">Total da compra:</span>
            <span className="text-lg font-black text-stone-900">{formatCurrency(purchase.totalAmount)}</span>
          </div>

          {purchase.paymentPlan && <p className="rounded-xl border bg-stone-50 p-3 text-sm">{purchase.paymentPlan.cardId ? `Cartão ${finance.cards?.find(card=>card.id===purchase.paymentPlan?.cardId)?.name || 'cadastrado'}` : purchase.paymentPlan.paidNow ? `Pago pela conta ${accountName(finance,purchase.paymentPlan.account)}` : 'A pagar'} · {purchase.paymentPlan.installments || 1} parcela(s){!purchase.paymentPlan.paidNow && ` · Primeiro vencimento: ${formatDate(purchase.paymentPlan.dueDate)}`}</p>}
          {purchase.notes && (
            <div className="text-stone-600">
              <span className="font-semibold block">Observações:</span>
              <p>{purchase.notes}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 text-right">
          {!purchase.cancelledAt && <button type="button" onClick={onEdit} className="mr-2 rounded-lg border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-800">Editar compra</button>}
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};
