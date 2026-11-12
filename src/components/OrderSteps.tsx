import React from 'react';

const labels = ['Cliente e entrega', 'Produtos', 'Conferir e salvar'];

export function OrderSteps({ step, onSelect, disabled }: {
  step: number;
  onSelect: (step: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label="Etapas do pedido" className="grid grid-cols-3 gap-2">
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          aria-current={step === index ? 'step' : undefined}
          onClick={() => onSelect(index)}
          className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border p-2 text-center text-xs font-semibold sm:flex-row sm:p-3 sm:text-left sm:text-sm ${step === index ? 'border-[#a86149] bg-[#f5e8df] text-[#8b503c]' : 'border-[#e5dad1] bg-white text-[#75665c] hover:bg-[#fbf7f2]'}`}
        >
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${step === index ? 'bg-[#a86149] text-white' : 'bg-[#f6f0e9]'}`}>{index + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
