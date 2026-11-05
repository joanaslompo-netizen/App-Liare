import React, { useEffect, useMemo, useState } from 'react';
import { Download, MessageCircle, Printer, Share2 } from 'lucide-react';
import type { AtelierSettings, Customer, Product, Sale } from '../types';
import { getInvoiceWhatsApp } from '../utils/invoiceWhatsApp';

type Props = { orders: Sale[]; grouped: boolean; settings: AtelierSettings; customers: Customer[]; products: Product[]; onPrint: () => void };
const primary = 'px-4 py-2 bg-emerald-700 text-white rounded-xl inline-flex items-center gap-2 disabled:opacity-50';
const secondary = 'px-4 py-2 border border-stone-300 bg-white rounded-xl inline-flex items-center gap-2 disabled:opacity-50';

function canShareFile(file: File | null) {
  try { return !!file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }); }
  catch { return false; }
}

export function InvoicePdfActions({ orders, grouped, settings, customers, products, onPrint }: Props) {
  const source = useMemo(() => ({ orders, grouped, settings, customers, products }), [orders, grouped, settings, customers, products]);
  const [result, setResult] = useState<{ source: typeof source; file?: File; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0), [sharing, setSharing] = useState(false), [notice, setNotice] = useState('');
  const file = result?.source === source ? result.file || null : null;
  const error = result?.source === source ? result.error : '';
  const [download, setDownload] = useState<{ file: File; url: string } | null>(null);
  const shareAvailable = canShareFile(file);
  const whatsapp = useMemo(() => getInvoiceWhatsApp(orders, settings, customers, products), [orders, settings, customers, products]);
  const chatUrl = whatsapp.url ? whatsapp.url.split('?')[0] : null;
  useEffect(() => {
    let cancelled = false;
    setNotice('');
    import('../utils/invoicePdf').then(module => module.createInvoicePdfFile(source.orders, source.settings, source.customers, source.products, source.grouped)).then(file => {
      if (!cancelled) setResult({ source, file });
    }).catch(() => { if (!cancelled) setResult({ source, error: 'Não consegui preparar o PDF. Tente novamente ou use Imprimir.' }); });
    return () => { cancelled = true; };
  }, [source, attempt]);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setDownload({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const downloadUrl = download?.file === file ? download?.url : null;
  const share = async () => {
    if (!file || !shareAvailable || sharing) return;
    setSharing(true); setNotice('');
    try {
      // The file is prepared before the click so native sharing keeps user activation.
      await navigator.share({ files: [file], title: 'Fatura LIARE' });
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') setNotice('Não foi possível compartilhar neste aparelho. Você pode baixar o PDF e anexá-lo na conversa.');
    } finally { setSharing(false); }
  };
  return <footer className="shrink-0 p-4 border-t space-y-3" aria-label="Compartilhar fatura em PDF">
    {file ? <p className="text-sm text-stone-600">{shareAvailable ? 'Compartilhe o PDF: escolha WhatsApp e depois o contato do cliente.' : 'Neste navegador, baixe o PDF e anexe o arquivo na conversa do WhatsApp.'}</p> : !error && <p role="status" className="text-sm text-stone-600">Preparando a fatura em PDF…</p>}
    {error && <p role="alert" className="text-sm text-amber-800">{error} <button type="button" className="underline" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Tentar novamente</button></p>}
    {notice && <p role="status" className="text-sm text-amber-800">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      {shareAvailable && <button type="button" className={primary} disabled={sharing} onClick={share}><Share2 className="w-4 h-4" />{sharing ? 'Compartilhando…' : 'Compartilhar PDF'}</button>}
      {downloadUrl && file ? <a className={shareAvailable ? secondary : primary} href={downloadUrl} download={file.name}><Download className="w-4 h-4" />Baixar PDF</a> : <button type="button" className={primary} disabled><Download className="w-4 h-4" />Baixar PDF</button>}
      {chatUrl && <a className={secondary} href={chatUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" />Abrir WhatsApp do cliente</a>}
      <button type="button" className={secondary} onClick={onPrint}><Printer className="w-4 h-4" />Imprimir</button>
    </div>
    <p className="text-xs text-stone-500">{whatsapp.phone ? `WhatsApp do cliente: ${whatsapp.phone}. ` : whatsapp.error + ' '}{shareAvailable && 'Compartilhar abre as opções do aparelho; você escolhe o contato e confirma o envio.'}</p>
  </footer>;
}
