import { ModalFrame } from './ModalFrame';
import React, { useEffect, useMemo, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { AtelierSettings, Customer, Product, Sale } from '../types';
import { buildInvoiceHtml, getInvoiceDocumentTitle } from '../utils/invoice';

export const InvoiceModal = ({ sale, settings, customers, products, onClose }: {
  sale: Sale; settings: AtelierSettings; customers: Customer[]; products: Product[]; onClose: () => void;
}) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const invoiceTitle = getInvoiceDocumentTitle(sale);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = invoiceTitle;
    return () => { document.title = previousTitle; };
  }, [invoiceTitle]);
  const html = useMemo(() => buildInvoiceHtml(sale, settings, customers, products), [sale, settings, customers, products]);
  return <ModalFrame onClose={onClose} aria-labelledby="invoice-title" className="bg-stone-900/60">
    <section className="bg-white rounded-2xl w-full max-w-4xl h-[900px] flex flex-col overflow-hidden">
      <header className="liare-modal-header p-4 border-b flex items-center justify-between gap-3">
        <h2 id="invoice-title" className="font-bold text-lg">Fatura da encomenda</h2>
        <button type="button" aria-label="Fechar fatura" onClick={onClose}><X /></button>
      </header>
      {!settings.pixKey && <p className="px-4 pt-3 text-sm text-amber-800">Cadastre sua chave Pix nas configurações para incluí-la na fatura.</p>}
      <iframe ref={frame} title={invoiceTitle} srcDoc={html} className="liare-modal-body flex-1 min-h-0 w-full border-0" />
      <footer className="p-4 border-t flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Na impressão, escolha Salvar como PDF. No iPhone, use Compartilhar.</p>
        <button onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl flex items-center gap-2"><Printer className="w-4 h-4" />Salvar PDF / Imprimir</button>
      </footer>
    </section>
  </ModalFrame>;
};
