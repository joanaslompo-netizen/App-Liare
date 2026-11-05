import type { AtelierSettings, Customer, Product, Sale } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { getGroupedInvoiceDocumentTitle, getGroupedInvoiceTotals, getInvoiceCustomerKey, getInvoiceDocumentTitle, getInvoiceSelectionError, getInvoiceTotals } from './invoice';
import { formatOrderNumber } from './orderNumbers';
import { localDateString } from './localDate';

type Node = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '');
const money = (value: number) => formatCurrency(value).replace(/\u00a0/g, ' ');
const date = (value?: string) => value ? formatDate(value) : 'A combinar';
const muted = (value: unknown): Node => ({ text: text(value), color: '#69758c', fontSize: 9, margin: [0, 2, 0, 0] });
const rule = (): Node => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 505, y2: 0, lineWidth: 0.6, lineColor: '#dce1ea' }], margin: [0, 16, 0, 16] });
const tableLayout = {
  hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#dce1ea',
  paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 8, paddingBottom: () => 8,
};

function itemsTable(sale: Sale, products: Product[]): Node {
  const items = sale.items?.length ? sale.items : [{ productId: sale.productId, productName: sale.productName, quantity: sale.quantity, unitPrice: sale.unitPrice }];
  const header = ['Produto ou serviço', 'Quantidade', 'Preço unitário', 'Total'].map((value, index) => ({ text: value, bold: true, color: '#3e4c67', fillColor: '#d9e8fc', alignment: index ? 'right' : 'left' }));
  return { table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: ['*', 55, 78, 70], body: [header, ...items.map(item => {
    const aroma = products.find(product => product.id === item.productId)?.fragrance;
    return [{ stack: [{ text: text(item.productName) }, ...(aroma ? [muted(`Aroma: ${aroma}`)] : [])] }, { text: text(item.quantity), alignment: 'right' }, { text: money(item.unitPrice), alignment: 'right' }, { text: money(item.quantity * item.unitPrice), alignment: 'right' }];
  })] }, layout: tableLayout, margin: [0, 10, 0, 14] };
}

function totalsTable(totals: ReturnType<typeof getInvoiceTotals>, shipping: number, returns: number, grouped = false): Node {
  const rows: Node[][] = [];
  const add = (label: string, amount: number, emphasis = '', negative = false) => {
    const style = emphasis === 'discount' ? { fillColor: '#edf5ed', color: '#315c42', bold: true } : emphasis === 'original' ? { fillColor: '#f8f4ed', bold: true } : emphasis === 'balance' ? { fillColor: '#f1f8ff', bold: true } : {};
    rows.push([{ text: label, ...style }, { text: (negative ? '-' : '') + money(amount), alignment: 'right', ...style }]);
  };
  add('Subtotal dos produtos', totals.subtotal);
  if (shipping) add('Frete', shipping);
  if (totals.discount) {
    add(grouped ? 'Total dos pedidos antes dos descontos' : 'Total do pedido antes do desconto', Math.round((totals.subtotal + shipping) * 100) / 100, 'original');
    add('Desconto concedido', totals.discount, 'discount', true);
  }
  if (returns) add('Devoluções compensadas', returns, '', true);
  add('Total da fatura', totals.total);
  add('Valor pago', totals.paid);
  add('Saldo devedor', totals.balance, 'balance');
  return { table: { widths: ['*', 'auto'], dontBreakRows: true, body: rows }, layout: { ...tableLayout, paddingTop: () => 6, paddingBottom: () => 6 }, unbreakable: true };
}

function orderSummary(order: Sale): Node {
  const totals = getGroupedInvoiceTotals([order]);
  const parts = [
    ...(totals.shipping ? [{ text: `Frete: ${money(totals.shipping)}` }] : []),
    ...(totals.discount ? [{ text: `Total antes do desconto: ${money(Math.round((totals.subtotal + totals.shipping) * 100) / 100)}`, bold: true }, { text: `Desconto: -${money(totals.discount)}`, color: '#315c42', bold: true }] : []),
    ...(totals.returns ? [{ text: `Devoluções compensadas: -${money(totals.returns)}` }] : []),
    { text: `Total do pedido: ${money(totals.total)}`, bold: true },
    { text: `Valor pago: ${money(totals.paid)}` }, { text: `Saldo: ${money(totals.balance)}`, bold: true },
  ];
  return { text: parts.flatMap((part, index) => index ? [{ text: '   |   ' }, part] : [part]), fontSize: 8, lineHeight: 1.4, margin: [0, 0, 0, 14] };
}

export function buildInvoicePdfDefinition(orders: Sale[], settings: AtelierSettings, customers: Customer[], products: Product[], grouped = orders.length > 1) {
  if (!orders.length) throw new Error('Selecione um pedido para gerar a fatura.');
  if (grouped) { const error = getInvoiceSelectionError(orders, customers); if (error) throw new Error(error); }
  const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date) || (a.orderNumber || 0) - (b.orderNumber || 0) || a.id.localeCompare(b.id));
  const sale = sorted[0], customerKey = getInvoiceCustomerKey(sale, customers);
  const customer = customers.find(value => `id:${value.id}` === customerKey);
  const groupedTotals = grouped ? getGroupedInvoiceTotals(sorted) : null;
  const totals = groupedTotals || getInvoiceTotals(sale);
  const title = grouped ? getGroupedInvoiceDocumentTitle(sorted) : getInvoiceDocumentTitle(sale);
  const delivery = (order: Sale) => [muted(`Entrega ${order.deliveryStatus === 'entregue' ? 'realizada' : 'prevista'}: ${date(order.deliveryActualDate || order.deliveryScheduledDate)}`), muted(`Status: ${order.deliveryStatus === 'entregue' ? 'Entregue' : order.deliveryStatus === 'parcial' ? 'Entrega parcial' : 'Aguardando entrega'}`), ...(order.paymentMethod ? [muted(`Pagamento: ${order.paymentMethod}`)] : [])];
  const content: Node[] = [
    { columns: [
      { width: '*', stack: [{ text: 'LIARE', font: 'Times', fontSize: 43, color: '#a17a2c', characterSpacing: 2, margin: [0, 0, 0, 10] }, { text: text(settings.atelierName), bold: true }, ...(settings.invoiceContact ? [muted(settings.invoiceContact)] : []), ...(settings.invoiceAddress ? [muted(settings.invoiceAddress)] : [])] },
      { width: 200, alignment: 'right', stack: [{ text: grouped ? 'Fatura conjunta' : `Fatura nº ${formatOrderNumber(sale.orderNumber)}`, fontSize: 16, bold: true, margin: [0, 4, 0, 8] }, muted(grouped ? `${sorted.length} pedidos selecionados` : `Pedido nº ${formatOrderNumber(sale.orderNumber)}`), ...(!grouped ? [muted(`Data do pedido: ${date(sale.date)}`)] : []), muted(`Emissão: ${date(localDateString())}`), ...(!grouped && sale.paymentScheduledDate ? [muted(`Vencimento: ${date(sale.paymentScheduledDate)}`)] : [])] },
    ], columnGap: 20 }, rule(),
    { columns: [
      { width: '*', stack: [muted('Fatura para:'), { text: text(sale.customerName || customer?.name || 'Cliente não informado'), bold: true, margin: [0, 4, 0, 0] }, ...(sale.customerContact || customer?.phone ? [muted(`Telefone: ${sale.customerContact || customer?.phone}`)] : []), ...(customer?.email ? [muted(customer.email)] : [])] },
      { width: '*', stack: [muted(grouped ? 'Pedidos incluídos:' : 'Informações da encomenda:'), ...(grouped ? [{ text: sorted.map(order => `#${formatOrderNumber(order.orderNumber)}`).join(', '), margin: [0, 4, 0, 0] }, muted('Os valores pagos já foram descontados do saldo de cada pedido.')] : delivery(sale))] },
    ], columnGap: 24, margin: [0, 0, 0, 10] },
  ];
  for (const order of sorted) {
    if (grouped) content.push({ stack: [{ text: `Pedido nº ${formatOrderNumber(order.orderNumber)}`, bold: true, fontSize: 12 }, muted(`Data do pedido: ${date(order.date)}`), ...(order.paymentScheduledDate ? [muted(`Vencimento: ${date(order.paymentScheduledDate)}`)] : []), ...delivery(order)], margin: [0, 14, 0, 4] });
    content.push(itemsTable(order, products));
    if (grouped) content.push(orderSummary(order));
    if (grouped && order.notes) content.push({ text: [{ text: 'Observações: ', bold: true }, text(order.notes)], margin: [0, 0, 0, 12] });
  }
  const payment: Node[] = settings.pixKey ? [{ text: 'Pagamento via Pix', bold: true, margin: [0, 0, 0, 6] }, { text: `Chave Pix: ${settings.pixKey}` }, ...(settings.pixHolder ? [{ text: `Titular: ${settings.pixHolder}` }] : []), muted('Envie o comprovante após o pagamento.'), muted('Para pagar com cartão, solicite o link pelo WhatsApp do ateliê.')] : [];
  content.push({ columns: [{ width: '*', stack: payment }, { width: 280, ...totalsTable(totals, groupedTotals ? groupedTotals.shipping : sale.shippingCharged || 0, groupedTotals ? groupedTotals.returns : (sale.returnAdjustmentCents || 0) / 100, grouped) }], columnGap: 20, margin: [0, 14, 0, 16], unbreakable: true });
  if (!grouped && sale.notes) content.push({ text: [{ text: 'Observações da encomenda\n', bold: true }, text(sale.notes)], margin: [0, 10, 0, 12] });
  return { info: { title, author: 'LIARE', subject: 'Fatura da encomenda' }, pageSize: 'A4', pageMargins: [45, 45, 45, 54], defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111830', lineHeight: 1.2 }, content,
    footer: (page: number, count: number) => ({ stack: [{ text: 'Obrigada por escolher a LIARE!', bold: true }, { text: `Documento de cobrança, sem valor fiscal.  |  ${page} / ${count}`, color: '#69758c' }], fontSize: 8, alignment: 'center', margin: [45, 10, 45, 0] }),
  };
}

let enginePromise: Promise<any> | undefined;
function pdfEngine() {
  if (!enginePromise) enginePromise = Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), import('pdfmake/build/standard-fonts/Times')]).then(([engine, fonts, times]) => {
    const pdf = engine.default || engine;
    pdf.addVirtualFileSystem(fonts.default || fonts);
    pdf.addFontContainer(times.default || times);
    return pdf;
  }).catch(error => { enginePromise = undefined; throw error; });
  return enginePromise;
}

export async function createInvoicePdfFile(orders: Sale[], settings: AtelierSettings, customers: Customer[], products: Product[], grouped = orders.length > 1): Promise<File> {
  const definition = buildInvoicePdfDefinition(orders, settings, customers, products, grouped);
  const pdf = await pdfEngine();
  const blob: Blob = await pdf.createPdf(definition).getBlob();
  const name = grouped ? 'LIARE-Fatura-Conjunta.pdf' : `LIARE-Pedido-${formatOrderNumber(orders[0].orderNumber).replace(/[^\w-]/g, '-')}.pdf`;
  return new File([blob], name, { type: 'application/pdf' });
}
