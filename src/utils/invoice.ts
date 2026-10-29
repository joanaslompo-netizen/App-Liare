import { formatOrderNumber } from './orderNumbers';
import { AtelierSettings, Customer, Product, Sale } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { isActiveOrder } from './financeLedger';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: number) => escapeHtml(formatCurrency(value));
const date = (value?: string) => value ? escapeHtml(formatDate(value)) : 'A combinar';

export const getInvoiceDocumentTitle = (sale: Pick<Sale, 'orderNumber'>) =>
  `Liare - Pedido ${sale.orderNumber ? String(sale.orderNumber).padStart(3, '0') : 'A definir'}`;

export const getInvoiceTotals = (sale: Sale) => {
  const total = Math.max(0, (sale.totalRevenue || 0)-(sale.returnAdjustmentCents||0)/100);
  const paid = Math.max(0, sale.amountPaid ?? (sale.paymentStatus === 'pago' ? total : 0));
  const discount = Math.max(0, sale.discountAmount || 0);
  return { total, paid, balance: Math.max(0, total - paid), discount, subtotal: total + discount + (sale.returnAdjustmentCents||0)/100 - (sale.shippingCharged||0) };
};

const normalizeCustomerName = (name?: string) => (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
const normalizeContact = (contact?: string) => (contact || '').replace(/\D/g, '');

/** Prefer the saved customer ID; resolve older orders only when the match is unique. */
export const getInvoiceCustomerKey = (sale: Sale, customers: Customer[]) => {
  if (sale.customerId) return `id:${sale.customerId}`;
  const name = normalizeCustomerName(sale.customerName);
  const contact = normalizeContact(sale.customerContact);
  if (!name) return null;
  const matches = customers.filter(customer => normalizeCustomerName(customer.name) === name &&
    (!contact || normalizeContact(customer.phone) === contact));
  if (matches.length === 1) return `id:${matches[0].id}`;
  return `legacy:${JSON.stringify([name, contact])}`;
};

export const getInvoiceSelectionError = (sales: Sale[], customers: Customer[]) => {
  if (!sales.length) return 'Selecione pelo menos um pedido.';
  if (new Set(sales.map(sale => sale.id)).size !== sales.length) return 'Um pedido foi selecionado mais de uma vez.';
  if (sales.some(sale => !isActiveOrder(sale))) return 'Selecione apenas pedidos confirmados e não cancelados.';
  const key = getInvoiceCustomerKey(sales[0], customers);
  if (!key || sales.some(sale => getInvoiceCustomerKey(sale, customers) !== key)) return 'Selecione pedidos da mesma pessoa, com cliente identificado.';
  return null;
};

export const getGroupedInvoiceTotals = (sales: Sale[]) => {
  const cents = { total: 0, paid: 0, balance: 0, discount: 0, subtotal: 0, shipping: 0, returns: 0 };
  for (const sale of sales) {
    const totals = getInvoiceTotals(sale);
    const total = Math.round(totals.total * 100);
    // An excess payment on one order is not automatically allocated to another order.
    const paid = Math.min(total, Math.round(totals.paid * 100));
    cents.total += total;
    cents.paid += paid;
    cents.balance += Math.max(0, total - paid);
    cents.discount += Math.round(totals.discount * 100);
    cents.subtotal += Math.round(totals.subtotal * 100);
    cents.shipping += Math.round((sale.shippingCharged || 0) * 100);
    cents.returns += sale.returnAdjustmentCents || 0;
  }
  return {
    total: cents.total / 100, paid: cents.paid / 100, balance: cents.balance / 100,
    discount: cents.discount / 100, subtotal: cents.subtotal / 100,
    shipping: cents.shipping / 100, returns: cents.returns / 100,
  };
};

export const getGroupedInvoiceDocumentTitle = (sales: Sale[]) =>
  `Liare - Fatura conjunta - ${sales[0]?.customerName || 'Cliente'}`;

const renderItems = (sale: Sale, products: Product[]) => {
  const items = sale.items?.length ? sale.items : [{
    productId: sale.productId, productName: sale.productName,
    quantity: sale.quantity, unitPrice: sale.unitPrice,
  }];
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const aroma = product?.fragrance || (!item.productId ? 'A definir' : '');
    return `<tr><td><strong>${escapeHtml(item.productName)}</strong>${aroma ? `<small>Aroma: ${escapeHtml(aroma)}</small>` : ''}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.unitPrice)}</td><td>${money(item.quantity * item.unitPrice)}</td></tr>`;
  }).join('');
};
const renderItemsTable = (sale: Sale, products: Product[]) =>
  `<table><thead><tr><th>Produto ou serviço</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>${renderItems(sale, products)}</tbody></table>`;
const deliveryInfo = (sale: Sale) => `<p>Entrega ${sale.deliveryStatus === 'entregue' ? 'realizada' : 'prevista'}: ${date(sale.deliveryActualDate || sale.deliveryScheduledDate)}</p><p>Status: ${sale.deliveryStatus === 'entregue' ? 'Entregue' : sale.deliveryStatus === 'parcial' ? 'Entrega parcial' : 'Aguardando entrega'}</p>`;

export const buildInvoiceHtml = (
  sale: Sale, settings: AtelierSettings, customers: Customer[], products: Product[]
) => buildInvoiceDocument(sale, settings, customers, products);

export const buildGroupedInvoiceHtml = (
  sales: Sale[], settings: AtelierSettings, customers: Customer[], products: Product[]
) => {
  const error = getInvoiceSelectionError(sales, customers);
  if (error) throw new Error(error);
  const sorted = [...sales].sort((a, b) => a.date.localeCompare(b.date) || (a.orderNumber || 0) - (b.orderNumber || 0) || a.id.localeCompare(b.id));
  return buildInvoiceDocument(sorted[0], settings, customers, products, sorted);
};

const buildInvoiceDocument = (
  sale: Sale, settings: AtelierSettings, customers: Customer[], products: Product[], groupedSales?: Sale[]
) => {
  const customerKey = getInvoiceCustomerKey(sale, customers);
  const customer = customers.find((item) => `id:${item.id}` === customerKey);
  const groupedTotals = groupedSales ? getGroupedInvoiceTotals(groupedSales) : null;
  const totals = groupedTotals || getInvoiceTotals(sale);
  const shipping = groupedTotals ? groupedTotals.shipping : (sale.shippingCharged || 0);
  const returns = groupedTotals ? groupedTotals.returns : (sale.returnAdjustmentCents || 0) / 100;
  const originalTotal = Math.round((totals.subtotal + shipping) * 100) / 100;
  const number = formatOrderNumber(sale.orderNumber);
  const title = groupedSales ? getGroupedInvoiceDocumentTitle(groupedSales) : getInvoiceDocumentTitle(sale);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:white;color:#111830;font:12px Arial,sans-serif;line-height:1.5}
  .page{max-width:178mm;margin:auto}header,.details,.bottom{display:flex;justify-content:space-between;gap:24px}
  header{padding-bottom:24px;border-bottom:1px solid #dce1ea}.brand{font:56px Georgia,serif;color:#a17a2c;letter-spacing:2px;margin-bottom:16px}
  h1{font-size:20px;margin:4px 0 12px}h2{font-size:12px;margin:0 0 5px}p{margin:0}small,.muted{color:#69758c}small{display:block;font-size:11px}header .right{text-align:right}
  .details{padding:24px 0 30px}.details>div{width:50%}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group;background:#d9e8fc;color:#3e4c67}
  th,td{padding:12px 8px;text-align:right;border-bottom:1px solid #dce1ea;vertical-align:top}th:first-child,td:first-child{text-align:left;width:48%}th:nth-child(2){width:14%}th:nth-child(3){width:20%}th:nth-child(4){width:18%}
  td strong{font-weight:500}tr{break-inside:avoid}.bottom{margin-top:28px;align-items:flex-start;break-inside:avoid}.payment{width:45%;overflow-wrap:anywhere}.summary{width:52%}.sum{display:flex;justify-content:space-between;gap:16px;padding:7px 4px}.total{border-top:1px solid #dce1ea;margin-top:10px;padding-top:14px}
  .balance{background:#f1f8ff;border:1px solid #d2e8ff;border-radius:8px;padding:12px;margin-top:12px;font-size:14px}.notes{margin-top:26px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}footer{text-align:center;border-top:1px solid #dce1ea;margin-top:30px;padding-top:16px;font-size:11px;break-inside:avoid}
  .original{background:#f8f4ed;border:1px solid #e4d7bf;border-radius:8px;padding:12px;margin-top:8px;font-size:13px}.discount{background:#edf5ed;border:1px solid #c9ddcd;color:#315c42;border-radius:8px;padding:12px;margin-top:8px;font-size:14px}.sum strong{flex-shrink:0}.order-original,.order-discount{font-weight:700}.order-discount{color:#315c42}
  .order{margin-bottom:28px}.order-head{padding:12px 8px;background:#f6f3ee;break-after:avoid}.order-head h2{font-size:14px}.order-info{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;color:#69758c}.order-summary{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px 16px;padding:12px 8px;break-inside:avoid}.order-summary span{white-space:nowrap}.order .notes{margin:8px}.details,.right{overflow-wrap:anywhere}
  @media screen{body{padding:24px}.page{min-height:245mm}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main class="page"><header><div><div class="brand">LIARE</div><strong>${escapeHtml(settings.atelierName)}</strong>
  ${settings.invoiceContact ? `<p class="muted">${escapeHtml(settings.invoiceContact)}</p>` : ''}
  ${settings.invoiceAddress ? `<p class="muted">${escapeHtml(settings.invoiceAddress)}</p>` : ''}</div>
  <div class="right"><h1>${groupedSales ? 'Fatura conjunta' : `Fatura nº ${escapeHtml(number)}`}</h1>${groupedSales ? `<p class="muted">${groupedSales.length} pedidos selecionados</p>` : `<p class="muted">Pedido nº ${escapeHtml(number)}</p><p class="muted">Data do pedido: ${date(sale.date)}</p>`}<p class="muted">Emissão: ${date(new Date().toLocaleDateString('sv-SE'))}</p>
  ${!groupedSales && sale.paymentScheduledDate ? `<p class="muted">Vencimento: ${date(sale.paymentScheduledDate)}</p>` : ''}</div></header>
  <section class="details"><div><h2 class="muted">Fatura para:</h2><strong>${escapeHtml(sale.customerName || customer?.name || 'Cliente não informado')}</strong>
  ${sale.customerContact || customer?.phone ? `<p class="muted">Telefone: ${escapeHtml(sale.customerContact || customer?.phone)}</p>` : ''}
  ${customer?.email ? `<p class="muted">${escapeHtml(customer.email)}</p>` : ''}</div><div><h2 class="muted">${groupedSales ? 'Pedidos incluídos:' : 'Informações da encomenda:'}</h2>
  ${groupedSales ? `<p>${groupedSales.map(order => `#${escapeHtml(formatOrderNumber(order.orderNumber))}`).join(', ')}</p><p class="muted">Os valores pagos já foram descontados do saldo de cada pedido.</p>` : `${deliveryInfo(sale)}${sale.paymentMethod ? `<p>Pagamento: ${escapeHtml(sale.paymentMethod)}</p>` : ''}`}</div></section>
  ${groupedSales ? groupedSales.map(order => {
    const orderTotals = getGroupedInvoiceTotals([order]);
    return `<section class="order"><div class="order-head"><h2>Pedido nº ${escapeHtml(formatOrderNumber(order.orderNumber))}</h2><div class="order-info"><span>Data do pedido: ${date(order.date)}</span>${order.paymentScheduledDate ? `<span>Vencimento: ${date(order.paymentScheduledDate)}</span>` : ''}</div>${deliveryInfo(order)}${order.paymentMethod ? `<p>Pagamento: ${escapeHtml(order.paymentMethod)}</p>` : ''}</div>
    ${renderItemsTable(order, products)}<div class="order-summary">${orderTotals.shipping ? `<span>Frete: ${money(orderTotals.shipping)}</span>` : ''}${orderTotals.discount ? `<span class="order-original">Total antes do desconto: ${money(Math.round((orderTotals.subtotal + orderTotals.shipping) * 100) / 100)}</span><span class="order-discount">Desconto concedido${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ''}: −${money(orderTotals.discount)}</span>` : ''}${orderTotals.returns ? `<span>Devoluções compensadas: −${money(orderTotals.returns)}</span>` : ''}<span>Total: <strong>${money(orderTotals.total)}</strong></span><span>Valor pago: ${money(orderTotals.paid)}</span><span>Saldo: <strong>${money(orderTotals.balance)}</strong></span></div>${order.notes ? `<div class="notes"><strong>Observações:</strong> ${escapeHtml(order.notes)}</div>` : ''}</section>`;
  }).join('') : renderItemsTable(sale, products)}
  <section class="bottom"><div class="payment">${settings.pixKey ? `<h2>Pagamento via Pix</h2><p>Chave Pix: ${escapeHtml(settings.pixKey)}</p>${settings.pixHolder ? `<p>Titular: ${escapeHtml(settings.pixHolder)}</p>` : ''}<p class="muted">Envie o comprovante após o pagamento.</p><p class="muted">Para pagar com cartão, solicite o link pelo WhatsApp do ateliê.</p>` : ''}</div>
  <div class="summary">${!totals.discount || shipping ? `<div class="sum"><span>Subtotal dos produtos</span><strong>${money(totals.subtotal)}</strong></div>` : ''}
  ${shipping ? `<div class="sum"><span>Frete</span><span>${money(shipping)}</span></div>` : ''}
  ${totals.discount ? `<div class="sum original"><span>${groupedSales ? 'Total dos pedidos antes dos descontos' : 'Total do pedido antes do desconto'}</span><strong>${money(originalTotal)}</strong></div><div class="sum discount"><span>Desconto concedido${!groupedSales && sale.discountCode ? ` (${escapeHtml(sale.discountCode)})` : ''}</span><strong>−${money(totals.discount)}</strong></div>` : ''}
  ${returns ? `<div class="sum"><span>Devoluções compensadas</span><span>−${money(returns)}</span></div>` : ''}
  <div class="sum total"><span>Total da fatura</span><strong>${money(totals.total)}</strong></div><div class="sum"><span>Valor pago</span><span>${money(totals.paid)}</span></div>
  <div class="sum balance"><span>Saldo devedor</span><strong>${money(totals.balance)}</strong></div></div></section>
  ${!groupedSales && sale.notes ? `<section class="notes"><h2>Observações da encomenda</h2>${escapeHtml(sale.notes)}</section>` : ''}
  <footer><strong>Obrigada por escolher a LIARE!</strong><small>Documento de cobrança, sem valor fiscal.</small></footer></main></body></html>`;
};
