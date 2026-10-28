import { workspaceStorage } from '../src/utils/workspaceStorage';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from '../src/utils/storage';
import { emptyFinance, makeEntry } from '../src/utils/financeLedger';
import { formatCurrency } from '../src/utils/formatters';
import type { Sale } from '../src/types';

const dom = new JSDOM('<!doctype html><title>App LIARE</title><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const alerts: string[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (message: string) => alerts.push(message), confirm: () => true,
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};dom.window.scrollTo = () => {};
const base: Sale = { id: 's1', orderNumber: 11, date: '2026-10-01', productId: 'p', productName: 'Vela fictícia', quantity: 2, unitPrice: 50,
  unitCost: 10, totalRevenue: 100, totalCost: 20, totalProfit: 80, marginPercent: 80, customerId: 'c', customerName: 'Cliente fictícia',
  discountAmount: 10, shippingCharged: 10, returnAdjustmentCents: 1000, financialTracking: true, legacyPaidCents: 0, deliveryStatus: 'entregue', createdAt: '2026-10-01' };
const finance = emptyFinance();
finance.entries.push(makeEntry('receipt', 30, { id: 'receipt1', saleId: 's1', customerId: 'c', date: '2026-10-02', method: 'Pix', account: 'Principal', allocatedCents: 3000 }));
finance.entries.push(makeEntry('receipt', 20, { id: 'receipt3', saleId: 's3', customerId: 'c', date: '2026-10-15', method: 'Pix', account: 'Principal', allocatedCents: 2000 }));
const fixture = { materials: [], products: [{ ...DEFAULT_PRODUCTS[0], id: 'p', currentStock: 10 }], purchases: [], productions: [],
  sales: [base, { ...base, id: 's2', orderNumber: 12, date: '2026-10-10', productName: 'Difusor fictício', quantity: 1, unitPrice: 80,
    totalRevenue: 80, discountAmount: 0, shippingCharged: 0, returnAdjustmentCents: 0, deliveryStatus: 'pendente_entrega' },
    { ...base, id: 's3', orderNumber: 13, totalRevenue: 20, discountAmount: 0, shippingCharged: 0, returnAdjustmentCents: 0 },
    { ...base, id: 'other', orderNumber: 14, customerId: 'other', customerName: 'Outra pessoa' },
    { ...base, id: 'cancelled', orderNumber: 15, commercialStatus: 'cancelled' },
    { ...base, id: 'draft', orderNumber: 16, commercialStatus: 'draft' },
    { ...base, id: 'anonymous', orderNumber: 17, customerId: undefined, customerName: undefined }],
  customers: [{ id: 'c', name: 'Cliente fictícia', phone: '41999990000', createdAt: '2026-01-01' }],
  paymentMethods: ['Pix'], suppliers: [], todos: [], projects: [], settings: { ...DEFAULT_SETTINGS, pixKey: 'pix-ficticio' }, finance, stockMovements: [] };
workspaceStorage.setItem('atelie_workspace_finance_v1', JSON.stringify(fixture));
const saved = () => workspaceStorage.getItem('atelie_workspace_finance_v1')!;
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');
let root = createRoot(document.querySelector('#root')!);
async function button(text: string) { const element = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === text);assert(element, text);await act(async () => element.click()); }
const checkbox = (number: number) => document.querySelector<HTMLInputElement>(`[aria-label="Selecionar pedido ${String(number).padStart(6, '0')} para fatura"]`)!;
async function select(number: number) { const element = checkbox(number);assert(element);await act(async () => element.click()); }
async function search(value: string) { const input = document.querySelector<HTMLInputElement>('input[placeholder^="Buscar por cliente"]')!;assert(input);
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); }
const invoiceDocument = () => { const frame = document.querySelector<HTMLIFrameElement>('iframe');assert(frame);return new JSDOM(frame.srcdoc).window.document; };
await act(async () => root.render(<App />));await button('Pedidos');
const before = saved();
assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 0);
await button('Fatura conjunta');
assert([...document.querySelectorAll('button')].find(node => node.textContent?.trim() === 'Gerar fatura única')?.disabled);
assert(checkbox(15).disabled);assert(checkbox(16).disabled);assert(checkbox(17).disabled);
await select(11);assert(checkbox(14).disabled, 'Cliente diferente não entra na fatura');
await search('Difusor fictício');await select(12);
assert(document.querySelector('[aria-label="Selecionar pedidos para fatura conjunta"]')?.textContent?.includes(formatCurrency(140)), 'A seleção inclui o pedido oculto pela busca e desconta o recebimento real');
await button('Gerar fatura única');
let invoice = invoiceDocument();assert.equal(invoice.querySelectorAll('.order').length, 2);
assert(invoice.body.textContent?.includes('000011'));assert(invoice.body.textContent?.includes('000012'));assert(!invoice.body.textContent?.includes('000014'));
assert(invoice.querySelector('.summary .balance')?.textContent?.includes(formatCurrency(140)));
assert(document.title.includes('Fatura conjunta'));
let prints = 0;const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
frame.contentWindow!.focus = () => {};frame.contentWindow!.print = () => { prints += 1; };
await button('Salvar PDF / Imprimir');assert.equal(prints, 1);
await act(async () => (document.querySelector('[aria-label="Fechar fatura"]') as HTMLButtonElement).click());
assert.equal(document.title, 'App LIARE');assert(checkbox(12).checked, 'Fechar permite revisar a seleção');
await search('');assert(checkbox(11).checked);await select(12);await select(13);await button('Gerar fatura única');
invoice = invoiceDocument();assert(invoice.querySelector('.summary .balance')?.textContent?.includes(formatCurrency(60)), 'Pedido quitado não volta a ser cobrado');
await act(async () => (document.querySelector('[aria-label="Fechar fatura"]') as HTMLButtonElement).click());
await button('Cancelar seleção');assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 0);
assert.equal(saved(), before, 'Selecionar, imprimir e fechar não altera pedidos, recebimentos, estoque ou produção');
// The existing individual invoice remains available.
const single = document.querySelector<HTMLButtonElement>('[aria-label="Gerar fatura"]')!;assert(single);await act(async () => single.click());
assert.equal(document.querySelector('#invoice-title')?.textContent, 'Fatura da encomenda');
await act(async () => (document.querySelector('[aria-label="Fechar fatura"]') as HTMLButtonElement).click());
await act(async () => root.unmount());root = createRoot(document.querySelector('#root')!);await act(async () => root.render(<App />));
assert.equal(saved(), before, 'Reabrir preserva os pedidos separados e seus pagamentos');
assert.equal(alerts.length, 0, alerts.join('; '));await act(async () => root.unmount());
console.log('Fatura conjunta no app: seleção com busca, mesmo cliente, recebimento parcial real, pedido quitado, documento/PDF, revisão, cancelamento e reabertura sem mudanças nos dados passaram.');
process.exit(0);
