import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  Edit2, 
  Trash2, 
  Package, 
  X, 
  Check, 
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { Supplier, Material, Purchase } from '../types';
import { formatCurrency, matchesSearchText } from '../utils/formatters';

interface SuppliersViewProps {
  suppliers: Supplier[];
  materials: Material[];
  purchases: Purchase[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onSelectSupplierMaterials: (supplierName: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  materials,
  purchases,
  onSaveSupplier,
  onDeleteSupplier,
  onSelectSupplierMaterials,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const match =
        matchesSearchText(s.name, searchTerm) ||
        (s.phone && matchesSearchText(s.phone, searchTerm)) ||
        (s.email && matchesSearchText(s.email, searchTerm)) ||
        (s.notes && matchesSearchText(s.notes, searchTerm));
      return match;
    });
  }, [suppliers, searchTerm]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
            Catálogo de Fornecedores
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Mantenha contatos, links de lojas, compras efetuadas e materiais fornecidos ao seu ateliê.
          </p>
        </div>

        <button
          id="btn-add-supplier"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Novo Fornecedor</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar fornecedor por nome, telefone ou anotação..."
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
      </div>

      {/* Suppliers Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">
            Nenhum fornecedor encontrado
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-5">
            Cadastre os armarinhos, lojas de tecidos e papelarias onde você adquire seus insumos.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Primeiro Fornecedor</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((sup) => {
            // Associated materials count
            const supplierMaterials = materials.filter(
              (m) => m.supplierId === sup.id || m.supplierName === sup.name
            );
            // Purchases total
            const supplierPurchases = purchases.filter(
              (p) => p.supplierId === sup.id || p.supplierName === sup.name
            );
            const totalSpentWithSup = supplierPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

            // Clean phone for whatsapp
            const phoneDigits = sup.phone ? sup.phone.replace(/\D/g, '') : '';

            return (
              <div
                key={sup.id}
                id={`supplier-card-${sup.id}`}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 text-base leading-snug">
                          {sup.name}
                        </h4>
                        <span className="text-[11px] text-stone-400">
                          {supplierMaterials.length} {supplierMaterials.length === 1 ? 'material fornecido' : 'materiais fornecidos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(sup)}
                        className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir o fornecedor "${sup.name}"?`)) {
                            onDeleteSupplier(sup.id);
                          }
                        }}
                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Links */}
                  <div className="space-y-1.5 text-xs text-stone-600">
                    {sup.phone && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-stone-700">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          {sup.phone}
                        </span>
                        {phoneDigits.length >= 10 && (
                          <a
                            href={`https://wa.me/55${phoneDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline font-medium"
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        )}
                      </div>
                    )}

                    {sup.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a
                          href={`mailto:${sup.email}`}
                          className="hover:text-amber-800 truncate"
                        >
                          {sup.email}
                        </a>
                      </div>
                    )}

                    {sup.website && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a
                          href={sup.website.startsWith('http') ? sup.website : `https://${sup.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-800 hover:underline truncate flex items-center gap-1"
                        >
                          <span>Acessar Loja</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {sup.notes && (
                      <p className="text-[11px] text-stone-500 pt-1 italic">
                        "{sup.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer with Totals & Filter */}
                <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 block">
                      Total Comprado
                    </span>
                    <span className="font-bold text-stone-900">
                      {formatCurrency(totalSpentWithSup)}
                    </span>
                  </div>

                  {supplierMaterials.length > 0 && (
                    <button
                      onClick={() => onSelectSupplierMaterials(sup.name)}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline cursor-pointer"
                    >
                      Ver Materiais ({supplierMaterials.length})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <SupplierModal
          isOpen={isModalOpen}
          supplier={editingSupplier}
          onClose={() => setIsModalOpen(false)}
          onSave={(saved) => {
            onSaveSupplier(saved);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

interface SupplierModalProps {
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (s: Supplier) => void;
}

const SupplierModal: React.FC<SupplierModalProps> = ({
  supplier,
  onClose,
  onSave,
}) => {
  const isEditing = !!supplier;
  const [name, setName] = useState(supplier?.name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [website, setWebsite] = useState(supplier?.website || '');
  const [notes, setNotes] = useState(supplier?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome do fornecedor.');
      return;
    }

    const saved: Supplier = {
      id: supplier?.id || `sup_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: supplier?.createdAt || new Date().toISOString().split('T')[0],
    };

    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-base">
            {isEditing ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}
          </h3>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Nome da Loja / Fornecedor *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Armarinho Central ou Tecidos do Brás"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              E-mail de Contato
            </label>
            <input
              type="email"
              placeholder="contato@fornecedor.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Site ou Link da Loja Virtual
            </label>
            <input
              type="text"
              placeholder="https://lojadotecido.com.br"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Anotações / Especialidade
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Melhor preço para zíperes em atacado, entrega rápida via transportadora..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
            >
              Salvar Fornecedor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
