import React, { useEffect, useMemo, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { AtelierSettings, Customer, Product, Sale } from '../types';
import { buildInvoiceHtml } from '../utils/invoice';

export const InvoiceModal = ({ sale, settings, customers, products, onClose }: {
  sale: Sale; settings: AtelierSettings; customers: Customer[]; products: Product[]; onClose: () => void;
}) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  const html = useMemo(() => buildInvoiceHtml(sale, settings, customers, products), [sale, settings, customers, products]);
  return <dialog ref={dialog} onCancel={onClose} className="m-auto p-0 bg-transparent w-[95vw] max-w-4xl backdrop:bg-stone-900/60">
    <section role="dialog" aria-modal="true" aria-labelledby="invoice-title" className="bg-white rounded-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden">
      <header className="p-4 border-b flex items-center justify-between gap-3">
        <h2 id="invoice-title" className="font-bold text-lg">Fatura da encomenda</h2>
        <button aria-label="Fechar fatura" onClick={onClose}><X /></button>
      </header>
      {!settings.pixKey && <p className="px-4 pt-3 text-sm text-amber-800">Cadastre sua chave Pix nas configurações para incluí-la na fatura.</p>}
      <iframe ref={frame} title="Prévia da fatura A4" srcDoc={html} className="flex-1 min-h-0 w-full border-0" />
      <footer className="p-4 border-t flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Na impressão, escolha Salvar como PDF. No iPhone, use Compartilhar.</p>
        <button onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl flex items-center gap-2"><Printer className="w-4 h-4" />Salvar PDF / Imprimir</button>
      </footer>
    </section>
  </dialog>;
};
