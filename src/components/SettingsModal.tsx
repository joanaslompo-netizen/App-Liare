import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Check, 
  Download, 
  Upload, 
  RotateCcw, 
  Clock, 
  Percent, 
  DollarSign, 
  Sparkles,
  Cloud,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';
import { AtelierSettings, DiscountCode, DiscountType } from '../types';
import { User } from '../lib/firebase';
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_MATERIALS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_PURCHASES, 
  DEFAULT_SALES, 
  DEFAULT_SUPPLIERS 
} from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AtelierSettings;
  user: User | null;
  onClose: () => void;
  onSaveSettings: (newSettings: AtelierSettings) => void;
  onRestoreAllData: (data: any) => void;
  onOpenExamplePresets: () => void;
  onOpenCloudSync: () => void;
  allCurrentData: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  user,
  onClose,
  onSaveSettings,
  onRestoreAllData,
  onOpenExamplePresets,
  onOpenCloudSync,
  allCurrentData,
}) => {
  const [atelierName, setAtelierName] = useState(settings.atelierName);
  const [artisanName, setArtisanName] = useState(settings.artisanName);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [defaultFixedCostPercent, setDefaultFixedCostPercent] = useState(settings.defaultFixedCostPercent.toString());
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(settings.defaultProfitMargin.toString());
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(
    Array.isArray(settings.discountCodes) ? settings.discountCodes : (DEFAULT_SETTINGS.discountCodes || [])
  );
  const [newDiscountCode, setNewDiscountCode] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<DiscountType>('percentage');
  const [newDiscountValue, setNewDiscountValue] = useState('10');
  const [editingDiscountCodeId, setEditingDiscountCodeId] = useState<string | null>(null);

  const fileImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAtelierName(settings.atelierName);
    setArtisanName(settings.artisanName);
    setDefaultHourlyRate(settings.defaultHourlyRate.toString());
    setDefaultFixedCostPercent(settings.defaultFixedCostPercent.toString());
    setDefaultProfitMargin(settings.defaultProfitMargin.toString());
    setDiscountCodes(
      Array.isArray(settings.discountCodes) ? settings.discountCodes : (DEFAULT_SETTINGS.discountCodes || [])
    );
    setEditingDiscountCodeId(null);
    setNewDiscountCode('');
    setNewDiscountType('percentage');
    setNewDiscountValue('10');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      atelierName: atelierName.trim() || 'Meu Ateliê',
      artisanName: artisanName.trim() || 'Artesã',
      defaultHourlyRate: parseFloat(defaultHourlyRate) || 35,
      defaultFixedCostPercent: parseFloat(defaultFixedCostPercent) || 10,
      defaultProfitMargin: parseFloat(defaultProfitMargin) || 45,
      discountCodes,
    });
    onClose();
  };

  // Export JSON file
  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allCurrentData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('download', `backup_atelie_custos_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.materials || !parsed.products) {
          throw new Error('Arquivo de backup inválido.');
        }
        if (confirm('Deseja restaurar este backup? Os dados atuais serão substituídos.')) {
          onRestoreAllData(parsed);
          onClose();
        }
      } catch (err: any) {
        alert('Erro ao importar backup: ' + (err.message || 'arquivo inválido'));
      }
    };
    reader.readAsText(file);
  };

  // Reset to default sample data
  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar os dados de demonstração iniciais do ateliê?')) {
      onRestoreAllData({
        materials: DEFAULT_MATERIALS,
        products: DEFAULT_PRODUCTS,
        purchases: DEFAULT_PURCHASES,
        sales: DEFAULT_SALES,
        suppliers: DEFAULT_SUPPLIERS,
        settings: DEFAULT_SETTINGS,
      });
      onClose();
    }
  };

  const persistDiscountCodes = (nextCodes: DiscountCode[]) => {
    setDiscountCodes(nextCodes);
    onSaveSettings({
      ...settings,
      atelierName: atelierName.trim() || settings.atelierName,
      artisanName: artisanName.trim() || settings.artisanName,
      defaultHourlyRate: parseFloat(defaultHourlyRate) || settings.defaultHourlyRate,
      defaultFixedCostPercent: parseFloat(defaultFixedCostPercent) || settings.defaultFixedCostPercent,
      defaultProfitMargin: parseFloat(defaultProfitMargin) || settings.defaultProfitMargin,
      discountCodes: nextCodes,
    });
  };

  const resetDiscountEditor = () => {
    setEditingDiscountCodeId(null);
    setNewDiscountCode('');
    setNewDiscountType('percentage');
    setNewDiscountValue('10');
  };

  const handleAddDiscountCode = () => {
    const code = newDiscountCode.trim().toUpperCase().replace(/\s+/g, '');
    const value = Math.max(0, parseFloat(newDiscountValue) || 0);
    if (!code || value <= 0) return;
    if (discountCodes.some((item) => item.id !== editingDiscountCodeId && item.code.toUpperCase() === code)) {
      alert('Já existe um código de desconto com esse nome.');
      return;
    }

    if (editingDiscountCodeId) {
      const next = discountCodes.map((item) =>
        item.id === editingDiscountCodeId
          ? {
              ...item,
              code,
              type: newDiscountType,
              value: newDiscountType === 'percentage' ? Math.min(100, value) : value,
            }
          : item
      );
      persistDiscountCodes(next);
      resetDiscountEditor();
      return;
    }

    const next = [
      ...discountCodes,
      {
        id: `discount_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code,
        type: newDiscountType,
        value: newDiscountType === 'percentage' ? Math.min(100, value) : value,
        active: true,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ];
    persistDiscountCodes(next);
    resetDiscountEditor();
  };

  const handleEditDiscountCode = (discount: DiscountCode) => {
    setEditingDiscountCodeId(discount.id);
    setNewDiscountCode(discount.code);
    setNewDiscountType(discount.type);
    setNewDiscountValue(discount.value.toString());
  };

  const handleToggleDiscountCode = (id: string) => {
    const next = discountCodes.map((item) =>
      item.id === id ? { ...item, active: item.active === false } : item
    );
    persistDiscountCodes(next);
  };

  const handleDeleteDiscountCode = (id: string) => {
    const next = discountCodes.filter((item) => item.id !== id);
    persistDiscountCodes(next);
    if (editingDiscountCodeId === id) resetDiscountEditor();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-base">
              Configurações do Ateliê & Custos Padrão
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Nome do Ateliê
              </label>
              <input
                type="text"
                value={atelierName}
                onChange={(e) => setAtelierName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Nome da Artesã / Artesão
              </label>
              <input
                type="text"
                value={artisanName}
                onChange={(e) => setArtisanName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
            </div>
          </div>

          {/* Pricing defaults */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Parâmetros Padrão de Precificação
            </h4>

            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                <span>Valor Padrão da Hora de Trabalho (R$/h)</span>
                <span className="font-bold text-stone-900">R$ {defaultHourlyRate}/h</span>
              </label>
              <input
                type="number"
                step="1"
                min="5"
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
              />
              <p className="text-[10px] text-stone-400 mt-1">
                Define quanto você quer ganhar por hora trabalhada na confecção das peças (pro-labore).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Custos Fixos Padrão (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="50"
                  value={defaultFixedCostPercent}
                  onChange={(e) => setDefaultFixedCostPercent(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Margem de Lucro Padrão (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="90"
                  value={defaultProfitMargin}
                  onChange={(e) => setDefaultProfitMargin(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Discount codes */}
          <div className="bg-[#fbf7f2] p-4 rounded-xl border border-[#eadfd6] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#b96f55]" />
                Códigos de desconto
              </h4>
              <span className="text-[10px] text-stone-500">{discountCodes.length} cadastrados</span>
            </div>

            <div className="space-y-2">
              {discountCodes.map((discount) => (
                <div key={discount.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{discount.code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${discount.active === false ? 'bg-stone-100 text-stone-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {discount.active === false ? 'Pausado' : 'Ativo'}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500">
                      {discount.type === 'percentage' ? `${discount.value}% de desconto` : `${discount.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEditDiscountCode(discount)}
                    className="p-1.5 text-stone-400 hover:text-[#a86149] hover:bg-[#fbf7f2] rounded-lg"
                    title="Editar código"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleDiscountCode(discount.id)}
                    className="px-2 py-1 text-[10px] font-semibold rounded-lg border border-stone-200 hover:bg-stone-50"
                  >
                    {discount.active === false ? 'Ativar' : 'Pausar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDiscountCode(discount.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600"
                    title="Excluir código"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] gap-2 pt-1">
              <input
                type="text"
                value={newDiscountCode}
                onChange={(e) => setNewDiscountCode(e.target.value)}
                placeholder="Código (ex: VIP20)"
                className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#b96f55] text-stone-900 uppercase"
              />
              <select
                value={newDiscountType}
                onChange={(e) => setNewDiscountType(e.target.value as DiscountType)}
                className="px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900"
              >
                <option value="percentage">Porcentagem</option>
                <option value="fixed">Valor em R$</option>
              </select>
              <input
                type="number"
                min="0"
                max={newDiscountType === 'percentage' ? 100 : undefined}
                step="0.01"
                value={newDiscountValue}
                onChange={(e) => setNewDiscountValue(e.target.value)}
                className="px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900"
              />
              <button
                type="button"
                onClick={handleAddDiscountCode}
                className="px-3 py-2 rounded-lg bg-[#b96f55] hover:bg-[#a86149] text-white text-xs font-bold"
              >
                {editingDiscountCodeId ? 'Salvar alteração' : 'Adicionar'}
              </button>
              {editingDiscountCodeId && (
                <button
                  type="button"
                  onClick={resetDiscountEditor}
                  className="px-3 py-2 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs font-semibold hover:bg-stone-50"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>

          {/* Cloud Sync Section */}
          <div className="bg-stone-900 text-white p-4 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Sincronização Nuvem (Google)
                </h4>
              </div>
              {user ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectado
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-medium">
                  Apenas Local
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              {user
                ? `Seus dados estão vinculados à conta Google (${user.email}) e sincronizam automaticamente entre notebook, celular e tablet.`
                : 'Conecte sua conta Google para acessar o sistema no notebook, celular e tablet sem perder nada.'}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCloudSync();
              }}
              className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{user ? 'Gerenciar Aparelhos Conectados' : 'Conectar Conta Google Agora'}</span>
            </button>
          </div>

          {/* Backup & Data Section */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 space-y-2.5">
            <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
              Backup & Segurança dos Seus Dados
            </h4>
            <p className="text-[11px] text-stone-500">
              Seus dados ficam salvos com segurança no seu navegador. Você pode exportar um backup a qualquer momento.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg font-medium text-xs shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Exportar Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileImportRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg font-medium text-xs shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-stone-600" />
                <span>Importar Backup</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExamplePresets();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg font-medium text-xs shadow-2xs cursor-pointer"
                title="Trocar para outro nicho (Costura, Velas, Encadernação, Crochê ou Vazio)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Trocar Tema de Exemplos</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium text-xs ml-auto shadow-2xs"
                title="Recarrega os produtos e materiais de exemplo"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span>Restaurar Exemplos Iniciais</span>
              </button>

              <input
                ref={fileImportRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
