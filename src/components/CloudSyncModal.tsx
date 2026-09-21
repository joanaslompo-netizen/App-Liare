import React from 'react';
import { 
  X, 
  Cloud, 
  CloudCheck, 
  RefreshCw, 
  LogOut, 
  Laptop, 
  Smartphone, 
  Tablet, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { User } from '../lib/firebase';
import { CloudSyncStatus } from '../services/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: Date | null;
  onLoginGoogle: () => void;
  onLogout: () => void;
  onForceSync: () => void;
  itemCounts: {
    materials: number;
    products: number;
    purchases: number;
    productions?: number;
    projects?: number;
    sales: number;
    customers?: number;
  };
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  syncStatus,
  lastSyncedAt,
  onLoginGoogle,
  onLogout,
  onForceSync,
  itemCounts,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sincronização em Nuvem</h3>
              <p className="text-xs text-stone-400">Notebook, Celular & Tablet sincronizados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {user ? (
            /* Logged in state */
            <div className="space-y-5">
              {/* User Identity Card */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full border-2 border-amber-300 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-lg shrink-0">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'J'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {user.displayName || 'Artesã'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                        Conectado
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 truncate">{user.email}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Conta Google vinculada com segurança
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-100/70 rounded-lg border border-rose-200 transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Sair da conta Google neste aparelho"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desconectar</span>
                </button>
              </div>

              {/* Realtime Status */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {syncStatus === 'syncing' ? (
                      <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : syncStatus === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="text-xs font-bold text-stone-900">
                      {syncStatus === 'syncing'
                        ? 'Sincronizando com a nuvem...'
                        : syncStatus === 'error'
                        ? 'Erro na sincronização'
                        : 'Sincronizado e Atualizado na Nuvem'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onForceSync}
                    disabled={syncStatus === 'syncing'}
                    className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sincronizar Agora</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-1 border-t border-stone-200 text-center">
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Materiais</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.materials}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Receitas</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.products}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Produções</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.productions ?? 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Projetos</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.projects ?? 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Compras</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.purchases}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Vendas</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.sales}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200/60">
                    <span className="text-[10px] text-stone-500 block">Clientes</span>
                    <span className="text-sm font-bold text-stone-800">{itemCounts.customers ?? 0}</span>
                  </div>
                </div>

                {lastSyncedAt && (
                  <p className="text-[11px] text-stone-500 text-right">
                    Última sincronização: {lastSyncedAt.toLocaleTimeString('pt-BR')} de {lastSyncedAt.toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              {/* Devices Instructions */}
              <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold text-stone-800 flex items-center gap-2">
                  <span>Como acessar nos seus 3 aparelhos:</span>
                </h4>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex flex-col items-center">
                    <Laptop className="w-5 h-5 text-amber-700 mb-1" />
                    <span className="text-xs font-semibold text-stone-800">Notebook</span>
                    <span className="text-[10px] text-stone-500 mt-0.5">Gestão Completa</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex flex-col items-center">
                    <Smartphone className="w-5 h-5 text-amber-700 mb-1" />
                    <span className="text-xs font-semibold text-stone-800">Celular</span>
                    <span className="text-[10px] text-stone-500 mt-0.5">Compras & Feiras</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex flex-col items-center">
                    <Tablet className="w-5 h-5 text-amber-700 mb-1" />
                    <span className="text-xs font-semibold text-stone-800">Tablet</span>
                    <span className="text-[10px] text-stone-500 mt-0.5">Bancada do Ateliê</span>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/50">
                  💡 <strong>Dica de uso:</strong> Basta abrir o link do aplicativo no navegador do celular ou tablet e clicar em <strong>"Entrar com o Google"</strong> com a sua conta (<span className="font-semibold text-stone-900">{user.email}</span>). Qualquer alteração feita em um aparelho atualizará os outros em segundos!
                </p>
              </div>
            </div>
          ) : (
            /* Logged out state */
            <div className="text-center space-y-5 py-2">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
                <Cloud className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-stone-900">
                  Sincronize seu Notebook, Celular e Tablet
                </h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto mt-1.5 leading-relaxed">
                  Conecte sua conta Google para manter suas fórmulas, estoque de materiais, compras e precificação sempre atualizados em todos os seus aparelhos.
                </p>
              </div>

              {/* Device Icons Row */}
              <div className="flex items-center justify-center gap-6 py-2 text-stone-500">
                <div className="flex flex-col items-center gap-1">
                  <Laptop className="w-6 h-6 text-stone-700" />
                  <span className="text-[11px] font-medium">Notebook</span>
                </div>
                <span className="text-stone-300 font-bold">⇄</span>
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="w-6 h-6 text-stone-700" />
                  <span className="text-[11px] font-medium">Celular</span>
                </div>
                <span className="text-stone-300 font-bold">⇄</span>
                <div className="flex flex-col items-center gap-1">
                  <Tablet className="w-6 h-6 text-stone-700" />
                  <span className="text-[11px] font-medium">Tablet</span>
                </div>
              </div>

              {/* Login Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-modal-login-google"
                  onClick={onLoginGoogle}
                  className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm rounded-xl border border-stone-300 shadow-md hover:shadow-lg inline-flex items-center justify-center gap-3 transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com a Conta Google</span>
                </button>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl text-left text-xs text-stone-500 space-y-1 border border-stone-200">
                <p className="font-semibold text-stone-700">O que acontece ao conectar?</p>
                <p>
                  • Seus dados cadastrados serão salvos com segurança no seu banco de dados em nuvem.
                </p>
                <p>
                  • O aplicativo continuará funcionando normalmente mesmo se você estiver sem sinal de internet.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
