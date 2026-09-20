import React, { useState, useMemo } from 'react';
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
  X, 
  Check, 
  DollarSign, 
  ArrowUpRight 
} from 'lucide-react';
import { Purchase, PurchaseItem, Material, Supplier, UnitOfMeasure } from '../types';
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  UNIT_SHORT 
} from '../utils/formatters';
import { SearchableMaterialCombobox } from './SearchableMaterialCombobox';

interface PurchasesViewProps {
  purchases: Purchase[];
  materials: Material[];
  suppliers: Supplier[];
  onSavePurchase: (purchase: Purchase, updateStock: boolean) => void;
  onDeletePurchase: (id: string) => void;
  onOpenSuppliers?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  materials,
  suppliers,
  onSavePurchase,
  onDeletePurchase,
  onOpenSuppliers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        const matchesSearch =
          p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
          p.items.some((it) => it.materialName.toLowerCase().includes(searchTerm.toLowerCase()));

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
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Registrar Compra / NF</span>
          </button>
        </div>
      </div>

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
            onClick={() => setIsModalOpen(true)}
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
          isOpen={isModalOpen}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setIsModalOpen(false)}
          onSave={(p, updateStock) => {
            onSavePurchase(p, updateStock);
            setIsModalOpen(false);
          }}
        />
      )}

      {/* Purchase Details Modal */}
      {viewingPurchase && (
        <PurchaseDetailsModal
          purchase={viewingPurchase}
          onClose={() => setViewingPurchase(null)}
        />
      )}
    </div>
  );
};

// ==========================================
// New Purchase Modal
// ==========================================

interface NewPurchaseModalProps {
  isOpen: boolean;
  materials: Material[];
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (p: Purchase, updateStock: boolean) => void;
}

const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  materials,
  suppliers,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [updateStock, setUpdateStock] = useState(true);

  // Items in this purchase
  const [items, setItems] = useState<PurchaseItem[]>([]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Adicione pelo menos um item à compra.');
      return;
    }

    const sup = suppliers.find((s) => s.id === supplierId);
    const supplierName = sup ? sup.name : 'Fornecedor Avulso';

    const purchase: Purchase = {
      id: `pur_${Date.now()}`,
      date,
      supplierId: supplierId || undefined,
      supplierName,
      invoiceNumber: invoiceNumber.trim() || undefined,
      items,
      shippingCost: parsedShipping,
      totalAmount,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onSave(purchase, updateStock);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-stone-900 text-lg">
              Registrar Compra de Materiais
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-stone-900">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Data da Compra *
              </label>
              <input
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
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Quantidade Comprada
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
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
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Valor Total Pago (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
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
                      <td className="py-2 px-3 text-right text-stone-600">{formatNumber(it.quantity)} {it.unit}</td>
                      <td className="py-2 px-3 text-right font-bold text-stone-900">{formatCurrency(it.totalPrice)}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
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
              Somar automaticamente as quantidades compradas ao estoque atual dos materiais
            </label>
          </div>

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
              className="px-5 py-2 text-sm font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>Concluir e Salvar Compra</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Details Modal
const PurchaseDetailsModal: React.FC<{ purchase: Purchase; onClose: () => void }> = ({
  purchase,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Detalhes da Compra
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
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
            <span className="font-bold text-stone-900 text-sm">Total Pago:</span>
            <span className="text-lg font-black text-stone-900">{formatCurrency(purchase.totalAmount)}</span>
          </div>

          {purchase.notes && (
            <div className="text-stone-600">
              <span className="font-semibold block">Observações:</span>
              <p>{purchase.notes}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
