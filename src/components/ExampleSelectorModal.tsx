import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  Scissors, 
  Flame, 
  BookOpen, 
  HelpCircle, 
  Layers, 
  ArrowRight,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { ATELIER_PRESETS, AtelierPreset } from '../utils/presets';

interface ExampleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: AtelierPreset) => void;
  currentPresetId?: string;
}

export const ExampleSelectorModal: React.FC<ExampleSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
  const [selectedId, setSelectedId] = useState<string>('costura');

  if (!isOpen) return null;

  const handleApply = (preset: AtelierPreset) => {
    const isClean = preset.id === 'limpo';
    const message = isClean
      ? 'Deseja realmente limpar todos os dados e começar o ateliê em branco? Você poderá adicionar seus materiais e receitas do zero.'
      : `Deseja carregar os exemplos de "${preset.title}"? Os dados atuais serão substituídos por este conjunto temático.`;

    if (confirm(message)) {
      onSelectPreset(preset);
      onClose();
    }
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'costura':
        return <Scissors className="w-5 h-5 text-amber-700" />;
      case 'velas':
        return <Flame className="w-5 h-5 text-rose-700" />;
      case 'papelaria':
        return <BookOpen className="w-5 h-5 text-blue-700" />;
      case 'croche':
        return <Layers className="w-5 h-5 text-emerald-700" />;
      case 'limpo':
        return <Trash2 className="w-5 h-5 text-stone-500" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-700" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">
                Escolha o Tema de Exemplos do Ateliê
              </h3>
              <p className="text-xs text-stone-500">
                Alterne entre conjuntos prontos de exemplo ou limpe tudo para começar com seu estoque real.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Fichas Técnicas & Sub-produtos integrados:</span>
              Todos os modelos abaixo já trazem exemplos práticos de fichas técnicas, insumos intermediários (como etiquetas e alças) e histórico de compras calculados.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {ATELIER_PRESETS.map((preset) => {
              const isSelected = selectedId === preset.id;
              const isClean = preset.id === 'limpo';

              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedId(preset.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50/30 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(preset.id)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                          {preset.title}
                        </h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isClean
                            ? 'bg-stone-200 text-stone-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        {preset.description}
                      </p>

                      {!isClean && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {preset.materials.slice(0, 3).map((m) => (
                            <span key={m.id} className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium">
                              📦 {m.name.split(' (')[0].split(' ')[0]} {m.name.split(' ')[1] || ''}
                            </span>
                          ))}
                          {preset.products.slice(0, 2).map((p) => (
                            <span key={p.id} className="text-[10px] bg-amber-50 border border-amber-200/60 text-amber-900 px-2 py-0.5 rounded-md font-medium">
                              ✨ {p.name.split(' (')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex sm:flex-col items-end justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(preset);
                      }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs'
                          : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                      }`}
                    >
                      <span>Aplicar Tema</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-stone-500">
            Você pode editar ou apagar qualquer item a qualquer momento.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-700 hover:bg-stone-200 rounded-xl font-medium cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
