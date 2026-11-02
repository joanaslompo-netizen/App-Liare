import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { applyFinanceCommand, emptyFinance, orderBalance, cashEffect } from '../src/utils/financeLedger';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../src/utils/storage';
import { formatCurrency } from '../src/utils/formatters';
import type { Sale } from '../src/types';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, alert: (text: string) => { throw Error(text); } });
const { createRoot } = await import('react-dom/client');
const { FinanceView, OrderWorkflowModal } = await import('../src/components/FinanceView');
const root = createRoot(document.querySelector('#root')!);
const sale = (id: string): Sale => ({ id, date: '2026-11-02', createdAt: '2026-11-02', productId: 'p', productName: 'Vela de teste', quantity: 1,
  unitPrice: 100, unitCost: 20, totalRevenue: 100, totalCost: 20, totalProfit: 80, marginPercent: 80, customerId: 'c', commercialStatus: 'confirmed', financialTracking: true,
  legacyPaidCents: 0, items: [{ id: `line-${id}`, productId: 'p', productName: 'Vela de teste', quantity: 1, unitPrice: 100, unitCost: 20, totalCost: 20 }] });
let workspace = { sales: [sale('one'), sale('two')], customers: [{ id: 'c', name: 'Cliente de teste', phone: '', createdAt: '2026-11-02' }],
  products: [{ ...DEFAULT_PRODUCTS[0], id: 'p', currentStock: 10 }], settings: DEFAULT_SETTINGS, finance: emptyFinance() };
let screen = 'finance', selected = 'one';
const render = () => root.render(screen === 'finance' ? <FinanceView sales={workspace.sales} customers={workspace.customers} finance={workspace.finance} onAction={action} onOpenOrder={() => {}} onSaveCustomer={() => {}} onSaveCreditOrigins={() => {}} />
  : <OrderWorkflowModal key={selected} sale={workspace.sales.find(sale => sale.id === selected)!} finance={workspace.finance} onAction={action} onClose={() => {}} embedded />);
async function action(command: Parameters<typeof applyFinanceCommand>[1]) { workspace = applyFinanceCommand(workspace, command); render(); return true; }
const button = async (name: string) => {
  const element = [...document.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.trim() === name);
  assert(element, name); await act(async () => element.click());
};
const fill = async (label: string, value: string) => {
  const element = [...document.querySelectorAll('label')].find(element => element.textContent?.startsWith(label))?.querySelector('input,select') as HTMLInputElement;
  assert(element, label);
  await act(async () => { const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value); element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
const summary = () => document.querySelector('[aria-label="Resumo do recebimento"]')!.textContent!;
await act(async () => render());
await button('Taxas da maquininha');
await fill('Taxa no cartão de crédito (%)', '3.5');
assert(summary().includes(formatCurrency(96.5)));
await button('Salvar taxa da maquininha');
assert.equal(workspace.finance.cardReceiptFee!.creditPercent, 3.5);
assert(document.querySelector('[role="status"]')?.textContent?.includes('Taxa salva'));
screen = 'payment'; await act(async () => render());
await fill('Forma de pagamento', 'Cartão de crédito');
assert(document.body.textContent?.includes('Taxa automática no crédito: 3,5%'));
assert(summary().includes(formatCurrency(100)) && summary().includes(formatCurrency(3.5)) && summary().includes(formatCurrency(96.5)));
await fill('Valor recebido agora (R$)', '50');
assert(summary().includes(formatCurrency(1.75)) && summary().includes(formatCurrency(48.25)));
await fill('Valor recebido agora (R$)', '100');
await button('Registrar recebimento');
assert.equal(workspace.finance.entries[0].feeCents, 350);
assert.equal(orderBalance(workspace.sales[0], workspace.finance), 0);
assert.equal(cashEffect(workspace.finance.entries[0], workspace.finance), 9650);

screen = 'finance'; await act(async () => render());
await button('Taxas da maquininha'); await fill('Taxa no cartão de crédito (%)', '6'); await button('Salvar taxa da maquininha');
assert.equal(workspace.finance.entries[0].feeCents, 350);
screen = 'payment'; selected = 'two'; await act(async () => render());
await fill('Forma de pagamento', 'Cartão de crédito');
assert(summary().includes(formatCurrency(94)));
const manual = () => [...document.querySelectorAll('label')].find(label => label.textContent?.trim() === 'Informar uma taxa específica')!.querySelector('input')!;
await act(async () => manual().click());
await fill('Taxa deste recebimento (R$)', '2');
assert(summary().includes(formatCurrency(98)));
await fill('Forma de pagamento', 'PIX');
assert.equal(document.querySelector('[aria-label="Resumo do recebimento"]'), null, 'Switching to PIX clears the card-specific override.');
await fill('Forma de pagamento', 'Cartão de crédito');
assert(summary().includes(formatCurrency(94)));
await act(async () => manual().click()); await fill('Taxa deste recebimento (R$)', '2'); await button('Registrar recebimento');
assert.equal(workspace.finance.entries[1].feeCents, 200);
assert.equal(workspace.finance.entries[1].feeCalculation, 'manual');
assert.equal(orderBalance(workspace.sales[1], workspace.finance), 0);
assert.equal(cashEffect(workspace.finance.entries[1], workspace.finance), 9800);
await act(async () => root.unmount());
console.log('Interface da taxa: configuração percentual, prévia do valor bruto/taxa/líquido, pagamento parcial, alteração sem efeito retroativo, ajuste por recebimento e troca para PIX passaram.');
