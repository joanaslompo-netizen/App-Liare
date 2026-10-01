import { AtelierSettings, Customer, Product, Sale } from '../types';
import { formatCurrency, formatDate } from './formatters';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: number) => escapeHtml(formatCurrency(value));
const date = (value?: string) => value ? escapeHtml(formatDate(value)) : 'A combinar';

export const getInvoiceTotals = (sale: Sale) => {
  const total = Math.max(0, sale.totalRevenue || 0);
  const paid = sale.paymentStatus !== 'pendente_pagamento'
    ? total : Math.min(total, Math.max(0, sale.amountPaid || 0));
  const discount = Math.max(0, sale.discountAmount || 0);
  return { total, paid, balance: total - paid, discount, subtotal: total + discount };
};

export const buildInvoiceHtml = (
  sale: Sale, settings: AtelierSettings, customers: Customer[], products: Product[]
) => {
  const customer = customers.find((item) => item.id === sale.customerId);
  const totals = getInvoiceTotals(sale);
  const items = sale.items?.length ? sale.items : [{
    productId: sale.productId, productName: sale.productName,
    quantity: sale.quantity, unitPrice: sale.unitPrice,
  }];
  const number = sale.id.replace(/^sale_/, '');
  const rows = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const aroma = product?.fragrance || (!item.productId ? 'A definir' : '');
    return `<tr><td><strong>${escapeHtml(item.productName)}</strong>${aroma ? `<small>Aroma: ${escapeHtml(aroma)}</small>` : ''}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.unitPrice)}</td><td>${money(item.quantity * item.unitPrice)}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fatura LIARE ${escapeHtml(number)}</title><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:white;color:#111830;font:12px Arial,sans-serif;line-height:1.5}
  .page{max-width:178mm;margin:auto}header,.details,.bottom{display:flex;justify-content:space-between;gap:24px}
  header{padding-bottom:24px;border-bottom:1px solid #dce1ea}.brand{font:56px Georgia,serif;color:#a17a2c;letter-spacing:2px;margin-bottom:16px}
  h1{font-size:20px;margin:4px 0 12px}h2{font-size:12px;margin:0 0 5px}p{margin:0}small,.muted{color:#69758c}small{display:block;font-size:11px}header .right{text-align:right}
  .details{padding:24px 0 30px}.details>div{width:50%}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group;background:#d9e8fc;color:#3e4c67}
  th,td{padding:12px 8px;text-align:right;border-bottom:1px solid #dce1ea;vertical-align:top}th:first-child,td:first-child{text-align:left;width:48%}th:nth-child(2){width:14%}th:nth-child(3){width:20%}th:nth-child(4){width:18%}
  td strong{font-weight:500}tr{break-inside:avoid}.bottom{margin-top:28px;align-items:flex-start;break-inside:avoid}.payment{width:45%;overflow-wrap:anywhere}.summary{width:52%}.sum{display:flex;justify-content:space-between;gap:16px;padding:7px 4px}.total{border-top:1px solid #dce1ea;margin-top:10px;padding-top:14px}
  .balance{background:#f1f8ff;border:1px solid #d2e8ff;border-radius:8px;padding:12px;margin-top:12px;font-size:14px}.notes{margin-top:26px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}footer{text-align:center;border-top:1px solid #dce1ea;margin-top:30px;padding-top:16px;font-size:11px;break-inside:avoid}
  @media screen{body{padding:24px}.page{min-height:245mm}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main class="page"><header><div><div class="brand">LIARE</div><strong>${escapeHtml(settings.atelierName)}</strong>
  ${settings.invoiceContact ? `<p class="muted">${escapeHtml(settings.invoiceContact)}</p>` : ''}
  ${settings.invoiceAddress ? `<p class="muted">${escapeHtml(settings.invoiceAddress)}</p>` : ''}</div>
  <div class="right"><h1>Fatura nº ${escapeHtml(number)}</h1><p class="muted">Pedido: ${date(sale.date)}</p><p class="muted">Emissão: ${date(new Date().toLocaleDateString('sv-SE'))}</p>
  ${sale.paymentScheduledDate ? `<p class="muted">Vencimento: ${date(sale.paymentScheduledDate)}</p>` : ''}</div></header>
  <section class="details"><div><h2 class="muted">Fatura para:</h2><strong>${escapeHtml(sale.customerName || customer?.name || 'Cliente não informado')}</strong>
  ${sale.customerContact || customer?.phone ? `<p class="muted">Telefone: ${escapeHtml(sale.customerContact || customer?.phone)}</p>` : ''}
  ${customer?.email ? `<p class="muted">${escapeHtml(customer.email)}</p>` : ''}</div><div><h2 class="muted">Informações da encomenda:</h2>
  <p>Entrega ${sale.deliveryStatus === 'entregue' ? 'realizada' : 'prevista'}: ${date(sale.deliveryActualDate || sale.deliveryScheduledDate)}</p><p>Status: ${sale.deliveryStatus === 'entregue' ? 'Entregue' : 'Aguardando entrega'}</p>
  ${sale.paymentMethod ? `<p>Pagamento: ${escapeHtml(sale.paymentMethod)}</p>` : ''}</div></section>
  <table><thead><tr><th>Produto ou serviço</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
  <section class="bottom"><div class="payment">${settings.pixKey ? `<h2>Pagamento via Pix</h2><p>Chave Pix: ${escapeHtml(settings.pixKey)}</p>${settings.pixHolder ? `<p>Titular: ${escapeHtml(settings.pixHolder)}</p>` : ''}<p class="muted">Envie o comprovante após o pagamento.</p>` : ''}</div>
  <div class="summary"><div class="sum"><strong>Subtotal</strong><strong>${money(totals.subtotal)}</strong></div>
  ${totals.discount ? `<div class="sum"><span>Desconto${sale.discountCode ? ` (${escapeHtml(sale.discountCode)})` : ''}</span><span>−${money(totals.discount)}</span></div>` : ''}
  <div class="sum total"><span>Total da fatura</span><strong>${money(totals.total)}</strong></div><div class="sum"><span>Valor pago</span><span>${money(totals.paid)}</span></div>
  <div class="sum balance"><span>Saldo devedor</span><strong>${money(totals.balance)}</strong></div></div></section>
  ${sale.notes ? `<section class="notes"><h2>Observações da encomenda</h2>${escapeHtml(sale.notes)}</section>` : ''}
  <footer><strong>Obrigada por escolher a LIARE!</strong><small>Documento de cobrança, sem valor fiscal.</small></footer></main></body></html>`;
};
