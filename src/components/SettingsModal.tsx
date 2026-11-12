import { ModalFrame } from './ModalFrame';
import { inspectDataIntegrity, type IntegrityIssue } from '../utils/dataIntegrity';
import { localDateString } from '../utils/localDate';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Check, 
  Download, 
  Upload, 
  RotateCcw, 
  Clock, 
  DollarSign, 
  Sparkles,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { AtelierSettings } from '../types';
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
  const [invoiceFields, setInvoiceFields] = useState({ pixKey: settings.pixKey || "", pixHolder: settings.pixHolder || "", invoiceContact: settings.invoiceContact || "", invoiceAddress: settings.invoiceAddress || "" });
  const [atelierName, setAtelierName] = useState(settings.atelierName);
  const [artisanName, setArtisanName] = useState(settings.artisanName);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [defaultFixedCostPercent, setDefaultFixedCostPercent] = useState(settings.defaultFixedCostPercent.toString());
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(settings.defaultProfitMargin.toString());
  const fileImportRef = useRef<HTMLInputElement>(null);
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIntegrityIssues(null);
    setInvoiceFields({ pixKey: settings.pixKey || "", pixHolder: settings.pixHolder || "", invoiceContact: settings.invoiceContact || "", invoiceAddress: settings.invoiceAddress || "" });
    setAtelierName(settings.atelierName);
    setArtisanName(settings.artisanName);
    setDefaultHourlyRate(settings.defaultHourlyRate.toString());
    setDefaultFixedCostPercent(settings.defaultFixedCostPercent.toString());
    setDefaultProfitMargin(settings.defaultProfitMargin.toString());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      ...invoiceFields,
      atelierName: atelierName.trim() || 'Meu Ateliê',
      artisanName: artisanName.trim() || 'Artesã',
      defaultHourlyRate: parseFloat(defaultHourlyRate) || 35,
      defaultFixedCostPercent: parseFloat(defaultFixedCostPercent) || 10,
      defaultProfitMargin: parseFloat(defaultProfitMargin) || 45,
    });
    onClose();
  };

  // Export JSON file
  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allCurrentData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateStr = localDateString();
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

  return (
    <ModalFrame onClose={onClose} className="liare-form-dialog fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="liare-modal-header px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-base">
              Configurações do Ateliê & Custos Padrão
            </h3>
          </div>
          <button aria-label="Fechar janela" type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="liare-modal-body p-6 space-y-5 text-xs">
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

          <section className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900">Dados da fatura e Pix</h4>
            {([['pixKey', 'Chave Pix'], ['pixHolder', 'Titular do Pix'], ['invoiceContact', 'Contato do ateliê'], ['invoiceAddress', 'Endereço do ateliê']] as const).map(([key, label]) => (
              <label key={key} className="block font-semibold text-stone-700">{label}
                <input type="text" value={invoiceFields[key]} onChange={e => setInvoiceFields(prev => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-base bg-white border border-stone-300 rounded-lg" />
              </label>
            ))}
          </section>
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

          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <button type="button" onClick={() => setIntegrityIssues(inspectDataIntegrity(allCurrentData))}
              className="min-h-11 px-3 py-2 rounded-lg border border-stone-300 bg-white font-semibold text-stone-800">
              Verificar integridade dos dados
            </button>
            <p className="text-stone-500">Apenas verifica. Nenhum dado será alterado ou corrigido.</p>
            {integrityIssues !== null && (
              <div role="status" className="space-y-2">
                <p className="font-semibold text-stone-800">{integrityIssues.length ? `${integrityIssues.length} ponto(s) para conferir` : 'Nenhum problema encontrado nesta checagem.'}</p>
                <ul className="list-disc pl-5 space-y-1 text-stone-700">
                  {integrityIssues.slice(0, 50).map((issue, index) => <li key={`${issue.entityId}-${issue.code}-${index}`}>{issue.message}</li>)}
                </ul>
                {integrityIssues.length > 50 && <p>Mostrando os primeiros 50 pontos.</p>}
              </div>
            )}
          </section>

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
    </ModalFrame>
  );
};

