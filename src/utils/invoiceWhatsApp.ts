import type { AtelierSettings, Customer, Product, Sale } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { getGroupedInvoiceTotals, getInvoiceCustomerKey, getInvoiceSelectionError, getInvoiceTotals } from './invoice';
import { formatOrderNumber } from './orderNumbers';

/** National numbers are Brazilian; an explicit + or 00 preserves other country codes. */
export function normalizeWhatsAppPhone(value: string): string | null {
  const input = value.trim();
  if (!input || !/^\+?[\d\s().-]+$/.test(input)) return null;
  let phone = input.replace(/\D/g, '');
  const international = input.startsWith('+') || phone.startsWith('00');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (!international && (phone.length === 10 || phone.length === 11)) phone = '55' + phone;
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  if (phone.startsWith('55') && !/^55[1-9]{2}(?:[2-9]\d{7}|9\d{8})$/.test(phone)) return null;
  if (!international && !phone.startsWith('55')) return null;
  return phone;
}

const inline = (value: string | undefined) => (value || '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
const currency = (value: number) => formatCurrency(value).replace(/\u00a0/g, ' ');
const sortedOrders = (orders: Sale[]) => [...orders].sort((a, b) => a.date.localeCompare(b.date) || (a.orderNumber || 0) - (b.orderNumber || 0) || a.id.localeCompare(b.id));

function summary(totals: ReturnType<typeof getInvoiceTotals>, shipping: number, returns: number): string[] {
  return [
    `Subtotal dos produtos: ${currency(totals.subtotal)}`,
    ...(shipping ? [`Frete: ${currency(shipping)}`] : []),
    ...(totals.discount ? [`*Total antes do desconto: ${currency(Math.round((totals.subtotal + shipping) * 100) / 100)}*`, `*Desconto concedido: −${currency(totals.discount)}*`] : []),
    ...(returns ? [`Devoluções compensadas: −${currency(returns)}`] : []),
    `Total da fatura: ${currency(totals.total)}`,
    `Valor pago: ${currency(totals.paid)}`,
    `*Saldo a pagar: ${currency(totals.balance)}*`,
  ];
}

export function buildInvoiceWhatsAppMessage(orders: Sale[], settings: AtelierSettings, products: Product[]) {
  const sorted = sortedOrders(orders);
  const grouped = sorted.length > 1;
  const groupedTotals = grouped ? getGroupedInvoiceTotals(sorted) : null;
  const totals = groupedTotals || getInvoiceTotals(sorted[0]);
  const shipping = groupedTotals ? groupedTotals.shipping : sorted[0].shippingCharged || 0;
  const returns = groupedTotals ? groupedTotals.returns : (sorted[0].returnAdjustmentCents || 0) / 100;
  const name = inline(sorted[0].customerName);
  const lines = [name ? `Olá, ${name}!` : 'Olá!', 'Segue a sua fatura da LIARE.', '', grouped ? '*LIARE · Fatura conjunta*' : '*LIARE · Fatura do pedido*'];
  for (const order of sorted) {
    lines.push('', `*Pedido nº ${formatOrderNumber(order.orderNumber)}*`, `Data do pedido: ${formatDate(order.date)}`);
    const items = order.items?.length ? order.items : [{ productId: order.productId, productName: order.productName, quantity: order.quantity, unitPrice: order.unitPrice }];
    for (const item of items) {
      const aroma = products.find(product => product.id === item.productId)?.fragrance;
      const productName = inline(item.productName);
      lines.push(`• ${item.quantity} × ${productName}${aroma && !productName.toLocaleLowerCase('pt-BR').includes(aroma.toLocaleLowerCase('pt-BR')) ? ` (${inline(aroma)})` : ''} · ${currency(item.unitPrice)} cada · ${currency(item.quantity * item.unitPrice)}`);
    }
    if (order.paymentScheduledDate) lines.push(`Vencimento: ${formatDate(order.paymentScheduledDate)}`);
    if (order.deliveryActualDate || order.deliveryScheduledDate) lines.push(`Entrega ${order.deliveryActualDate ? 'realizada' : 'prevista'}: ${formatDate(order.deliveryActualDate || order.deliveryScheduledDate!)}`);
    if (grouped) lines.push(...summary(getGroupedInvoiceTotals([order]), order.shippingCharged || 0, (order.returnAdjustmentCents || 0) / 100));
    if (order.notes?.trim()) lines.push(`Observações: ${inline(order.notes)}`);
  }
  lines.push('', grouped ? '*Resumo da fatura conjunta*' : '*Resumo da fatura*', ...summary(totals, shipping, returns));
  if (totals.balance > 0 && settings.pixKey?.trim()) {
    lines.push('', '*Pagamento via Pix*', `Chave Pix: ${inline(settings.pixKey)}`);
    if (settings.pixHolder?.trim()) lines.push(`Titular: ${inline(settings.pixHolder)}`);
  }
  lines.push('', 'Obrigada por escolher a LIARE!', 'Documento de cobrança, sem valor fiscal.');
  return lines.join('\n');
}

export function getInvoiceWhatsApp(orders: Sale[], settings: AtelierSettings, customers: Customer[], products: Product[]) {
  const unavailable = (error: string) => ({ url: null, phone: '', message: '', error });
  if (!orders.length) return unavailable('Selecione um pedido para enviar a fatura.');
  if (orders.length > 1) {
    const error = getInvoiceSelectionError(orders, customers);
    if (error) return unavailable(error);
  }
  const key = getInvoiceCustomerKey(orders[0], customers);
  const customer = customers.find(value => `id:${value.id}` === key);
  let phone = customer?.phone?.trim() || '';
  if (!phone) {
    const contacts = orders.map(order => order.customerContact?.trim() || '').filter(Boolean);
    if (new Set(contacts.map(contact => normalizeWhatsAppPhone(contact) || contact)).size > 1) return unavailable('Os pedidos têm telefones diferentes. Atualize o telefone no cadastro do cliente antes de enviar.');
    phone = contacts[0] || '';
  }
  if (!phone) return unavailable('Cadastre o telefone / WhatsApp do cliente com DDD para enviar a fatura.');
  const number = normalizeWhatsAppPhone(phone);
  if (!number) return unavailable('Confira o telefone / WhatsApp do cliente: informe o DDD e o número. Para outro país, use + e o código do país.');
  const message = buildInvoiceWhatsAppMessage(orders, settings, products);
  return { url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`, phone, message, error: '' };
}
