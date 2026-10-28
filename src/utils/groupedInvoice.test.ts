import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildGroupedInvoiceHtml, getGroupedInvoiceTotals, getInvoiceCustomerKey, getInvoiceSelectionError } from './invoice';
import { DEFAULT_SETTINGS } from './storage';
import { formatCurrency } from './formatters';
import type { Customer, Sale } from '../types';

const customer: Customer = { id: 'customer', name: 'Cliente Fictícia', phone: '41999990000', email: 'teste@example.com', createdAt: '2026-01-01' };
const first = { id: 'first', orderNumber: 11, date: '2026-10-01', customerId: customer.id, customerName: customer.name,
  productId: '', productName: 'Vela personalizada', quantity: 2, unitPrice: 50, totalRevenue: 100,
  discountAmount: 10, shippingCharged: 10, returnAdjustmentCents: 1000, amountPaid: 30, paymentStatus: 'pendente_pagamento',
  notes: 'Entregar com laço', paymentScheduledDate: '2026-11-01' } as Sale;
const second = { ...first, id: 'second', orderNumber: 12, date: '2026-10-10', productName: 'Difusor', quantity: 1,
  unitPrice: 80, totalRevenue: 80, discountAmount: 0, shippingCharged: 0, returnAdjustmentCents: 0, amountPaid: 0, notes: '' };
const orders = [second, first];
const original = JSON.stringify(orders);
assert.deepEqual(getGroupedInvoiceTotals(orders), { subtotal: 180, discount: 10, shipping: 10, returns: 10, total: 170, paid: 30, balance: 140 });
const document = new JSDOM(buildGroupedInvoiceHtml(orders, { ...DEFAULT_SETTINGS, pixKey: 'pix-ficticio' }, [customer], [])).window.document;
assert.equal(document.querySelectorAll('.order').length, 2);
assert.deepEqual([...document.querySelectorAll('.order h2')].map(node => node.textContent), ['Pedido nº 000011', 'Pedido nº 000012']);
assert(document.querySelector('.summary .balance')?.textContent?.includes(formatCurrency(140)));
assert(document.body.textContent?.includes('Vela personalizada'));
assert(document.body.textContent?.includes('Difusor'));
assert(document.body.textContent?.includes('pix-ficticio'));
assert(document.body.textContent?.includes('teste@example.com'));
assert(document.body.textContent?.includes('Entregar com laço'));
assert(document.body.textContent?.includes('Vencimento:'));
assert.equal(JSON.stringify(orders), original, 'Gerar e ordenar a fatura não muda os pedidos');

// Paid orders and excess receipts cannot hide another order's unpaid balance.
assert.deepEqual(getGroupedInvoiceTotals([{ ...second, totalRevenue: 80, amountPaid: 100 }, { ...second, id: 'other', totalRevenue: 20, amountPaid: 0 }]),
  { subtotal: 100, discount: 0, shipping: 0, returns: 0, total: 100, paid: 80, balance: 20 });
assert.equal(getGroupedInvoiceTotals([{ ...second, amountPaid: undefined, paymentStatus: 'pago' }]).balance, 0);
assert.equal(getGroupedInvoiceTotals([{ ...second, totalRevenue: 0.1 }, { ...second, id: 'decimal', totalRevenue: 0.2 }]).balance, 0.3);

assert.equal(getInvoiceSelectionError(orders, [customer]), null);
assert(getInvoiceSelectionError([], [customer]));
assert(getInvoiceSelectionError([first, first], [customer]));
assert(getInvoiceSelectionError([first, { ...second, commercialStatus: 'cancelled' }], [customer]));
assert(getInvoiceSelectionError([first, { ...second, commercialStatus: 'draft' }], [customer]));
assert(getInvoiceSelectionError([first, { ...second, customerId: 'namesake' }], [customer]));
assert(getInvoiceSelectionError([{ ...first, customerId: undefined, customerName: undefined }], []));
assert.throws(() => buildGroupedInvoiceHtml([first, { ...second, customerId: 'other' }], DEFAULT_SETTINGS, [customer], []), /mesma pessoa/);

const legacy = { ...second, customerId: undefined, customerName: '  CLIENTE FICTICIA ', customerContact: '(41) 99999-0000' };
assert.equal(getInvoiceCustomerKey(legacy, [customer]), `id:${customer.id}`);
assert.equal(getInvoiceSelectionError([first, legacy], [customer]), null);
assert.equal(getInvoiceSelectionError([{ ...first, customerId: undefined, customerContact: legacy.customerContact }, legacy], []), null);
assert(getInvoiceSelectionError([first, { ...legacy, customerContact: '11988887777' }], [customer]));
assert(getInvoiceSelectionError([first, { ...legacy, customerContact: undefined }], [customer, { ...customer, id: 'namesake' }]));

const malicious = '</title><script>alert(1)</script>';
const unsafe = { ...first, customerName: malicious, notes: malicious, productName: malicious };
const escaped = new JSDOM(buildGroupedInvoiceHtml([unsafe], { ...DEFAULT_SETTINGS, pixKey: malicious }, [], [])).window.document;
assert.equal(escaped.querySelectorAll('script').length, 0);
assert(escaped.body.textContent?.includes(malicious));
console.log('Fatura conjunta: itens por pedido, frete/descontos/devoluções, saldos parciais, arredondamento, identidade do cliente, escape e dados originais preservados.');
