import { ModalFrame } from './ModalFrame';
import React, { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { AtelierSettings, Customer, Product, Sale } from '../types';
import { buildGroupedInvoiceHtml, buildInvoiceHtml, getGroupedInvoiceDocumentTitle, getInvoiceDocumentTitle } from '../utils/invoice';
import { InvoicePdfActions } from './InvoicePdfActions';

type InvoiceModalProps = {
  settings: AtelierSettings; customers: Customer[]; products: Product[]; onClose: () => void;
} & ({ sale: Sale; sales?: never } | { sale?: never; sales: Sale[] });

export const InvoiceModal = ({ sale, sales, settings, customers, products, onClose }: InvoiceModalProps) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const invoiceTitle = sales ? getGroupedInvoiceDocumentTitle(sales) : getInvoiceDocumentTitle(sale);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = invoiceTitle;
    return () => { document.title = previousTitle; };
  }, [invoiceTitle]);
  const html = useMemo(() => sales ? buildGroupedInvoiceHtml(sales, settings, customers, products) : buildInvoiceHtml(sale, settings, customers, products), [sale, sales, settings, customers, products]);
  const orders = useMemo(() => sales || [sale], [sales, sale]);
  return <ModalFrame onClose={onClose} aria-labelledby="invoice-title" className="bg-stone-900/60">
    <section className="bg-white rounded-2xl w-full max-w-4xl h-[900px] flex flex-col overflow-hidden">
      <header className="liare-modal-header p-4 border-b flex items-center justify-between gap-3">
        <h2 id="invoice-title" className="font-bold text-lg">{sales ? 'Fatura conjunta' : 'Fatura da encomenda'}</h2>
        <button type="button" aria-label="Fechar fatura" onClick={onClose}><X /></button>
      </header>
      {!settings.pixKey && <p className="px-4 pt-3 text-sm text-amber-800">Cadastre sua chave Pix nas configurações para incluí-la na fatura.</p>}
      <iframe ref={frame} title={invoiceTitle} srcDoc={html} className="liare-modal-body flex-1 min-h-0 w-full border-0" />
      <InvoicePdfActions orders={orders} grouped={!!sales} settings={settings} customers={customers} products={products} onPrint={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }} />
    </section>
  </ModalFrame>;
};
