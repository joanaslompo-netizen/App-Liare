import React, { useState } from 'react';
import { Building2, CreditCard as CardIcon, Plus, X } from 'lucide-react';
import type { CreditCard, FinancialAccount, FinanceBill, FinanceData } from '../types';
import { accountBalance, billBalance, cents, money, newId, type FinanceCommand } from '../utils/financeLedger';
import { accountName, financialAccounts } from '../utils/bankAccounts';
import { formatCurrency, formatDate } from '../utils/formatters';
import { localDateString } from '../utils/localDate';
import { FinancialAccountSelect } from './FinancialAccountSelect';
import { ModalFrame } from './ModalFrame';

const field = 'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base';
const button = 'rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-xl border bg-white px-3 py-2 text-sm';
type Action = (command: FinanceCommand) => Promise<boolean>;
type Editor = { type: 'account'; account: FinancialAccount; isNew: boolean } | { type: 'card'; card: CreditCard };

export function FinanceAccountsPanel({ finance, onAction, month }: { finance: FinanceData; onAction: Action; month: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [invoiceCard, setInvoiceCard] = useState('');
  const [paying, setPaying] = useState<{ card: CreditCard; bills: FinanceBill[] } | null>(null);
  const invoiceMonth = month === 'all' ? localDateString().slice(0, 7) : month;
  return <div className="space-y-6">
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5" />Contas bancárias</h3><button className={secondary} onClick={() => setEditor({ type: 'account', account: { id: newId(), name: '' }, isNew: true })}><Plus className="mr-1 inline h-4 w-4" />Nova conta</button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{financialAccounts(finance).map(account => <div key={account.id} className="rounded-2xl border bg-white p-4">
        <div className="flex items-start justify-between gap-3"><strong>{account.name}</strong><button className="text-xs underline" aria-label={`Editar conta ${account.name}`} onClick={() => setEditor({ type: 'account', account, isNew: false })}>Editar</button></div>
        <p className="mt-3 text-xs text-stone-500">Saldo registrado até hoje</p><p className="text-xl font-semibold">{formatCurrency(money(accountBalance(finance, account.id)))}</p>
      </div>)}</div>
      <p className="text-xs text-stone-500">Os saldos vêm dos lançamentos do app. Transferências entre contas não entram como receita ou despesa.</p>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><CardIcon className="h-5 w-5" />Cartões de crédito</h3><button className={secondary} onClick={() => setEditor({ type: 'card', card: { id: newId(), name: '', closingDay: 5, dueDay: 12, paymentAccount: 'Principal' } })}><Plus className="mr-1 inline h-4 w-4" />Novo cartão</button></div>
      <p className="text-sm text-stone-500">Faturas com vencimento em {invoiceMonth.slice(5)}/{invoiceMonth.slice(0, 4)}. Use o mês no topo para consultar outra fatura.</p>
      {!finance.cards?.length && <p className="rounded-2xl border border-dashed p-5 text-sm text-stone-500">Cadastre seu cartão para vincular compras e acompanhar as parcelas.</p>}
      {finance.cards?.map(card => {
        const bills = finance.bills.filter(bill => !bill.cancelledAt && bill.cardId === card.id && bill.dueDate.startsWith(invoiceMonth));
        const total = bills.reduce((sum, bill) => sum + bill.amountCents, 0);
        const open = bills.reduce((sum, bill) => sum + billBalance(bill, finance), 0);
        return <div key={card.id} className="rounded-2xl border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{card.name}</h4><p className="mt-1 text-xs text-stone-500">Fecha dia {card.closingDay} · vence dia {card.dueDay}</p><p className="text-xs text-stone-500">Pagamento pela conta {accountName(finance, card.paymentAccount)}</p></div><button className="text-xs underline" aria-label={`Editar cartão ${card.name}`} onClick={() => setEditor({ type: 'card', card })}>Editar</button></div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-stone-500">Falta pagar nesta fatura</p><p className="text-2xl font-semibold">{formatCurrency(money(open))}</p>{total > 0 && <p className="text-xs text-stone-500">Total: {formatCurrency(money(total))} · Pago: {formatCurrency(money(total - open))}</p>}</div><div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setInvoiceCard(invoiceCard === card.id ? '' : card.id)}>{invoiceCard === card.id ? 'Ocultar fatura' : 'Ver fatura'}</button>{open > 0 && <button className={button} onClick={() => setPaying({ card, bills: bills.filter(bill => billBalance(bill, finance) > 0) })}>Registrar pagamento da fatura</button>}</div></div>
          {invoiceCard === card.id && <div className="mt-4 space-y-2 border-t pt-3">{!bills.length ? <p className="text-sm text-stone-500">Nenhuma parcela neste mês.</p> : bills.map(bill => <div key={bill.id} className="flex justify-between gap-3 rounded-xl bg-stone-50 p-3 text-sm"><div><p>{bill.name}</p><p className="text-xs text-stone-500">Vence {formatDate(bill.dueDate)} · {billBalance(bill, finance) === 0 ? 'Pago' : 'A pagar'}</p></div><strong>{formatCurrency(money(billBalance(bill, finance)))}</strong></div>)}</div>}
        </div>;
      })}
    </section>
    {editor && <AccountEditor key={`${editor.type}:${editor.type === 'card' ? editor.card.id : editor.account.id}`} editor={editor} finance={finance} onAction={onAction} onClose={() => setEditor(null)} />}
    {paying && <InvoicePayment key={`${paying.card.id}:${invoiceMonth}`} finance={finance} card={paying.card} bills={paying.bills} month={invoiceMonth} onAction={onAction} onClose={() => setPaying(null)} />}
  </div>;
}

function AccountEditor({ editor, finance, onAction, onClose }: { key?: string; editor: Editor; finance: FinanceData; onAction: Action; onClose: () => void }) {
  const [name, setName] = useState(editor.type === 'account' ? editor.account.name : editor.card.name);
  const [balance, setBalance] = useState('0');
  const [date, setDate] = useState(localDateString());
  const [closing, setClosing] = useState(editor.type === 'card' ? editor.card.closingDay : 5);
  const [due, setDue] = useState(editor.type === 'card' ? editor.card.dueDay : 12);
  const [account, setAccount] = useState(editor.type === 'card' ? editor.card.paymentAccount : 'Principal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const command: FinanceCommand = editor.type === 'card'
        ? { type: 'save_card', card: { ...editor.card, name, closingDay: closing, dueDay: due, paymentAccount: account } }
        : { type: 'save_account', account: { ...editor.account, name }, openingBalanceCents: editor.isNew ? cents(Number(balance)) : undefined, date };
      if (await onAction(command)) onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  return <ModalFrame onClose={() => { if (!busy) onClose(); }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4">
    <form aria-label={editor.type === 'card' ? 'Cadastro de cartão' : 'Cadastro de conta'} onSubmit={submit} className="my-6 w-full max-w-lg space-y-4 rounded-2xl bg-white p-5">
      <div className="flex justify-between gap-3"><h3 className="text-lg font-semibold">{editor.type === 'card' ? 'Cartão de crédito' : 'Conta bancária'}</h3><button type="button" aria-label="Fechar cadastro" disabled={busy} onClick={onClose}><X /></button></div>
      <label className="block text-sm">Nome<input autoFocus required className={field} value={name} onChange={event => setName(event.target.value)} placeholder={editor.type === 'card' ? 'Ex.: Nubank crédito' : 'Ex.: Conta do ateliê'} /></label>
      {editor.type === 'account' && editor.isNew && <><label className="block text-sm">Saldo inicial antes dos lançamentos (R$)<input required type="number" step="0.01" className={field} value={balance} onChange={event => setBalance(event.target.value)} /></label><label className="block text-sm">Data do saldo inicial<input required type="date" className={field} value={date} onChange={event => setDate(event.target.value)} /></label></>}
      {editor.type === 'card' && <><div className="grid grid-cols-2 gap-3"><label className="text-sm">Dia do fechamento<input required type="number" min="1" max="31" className={field} value={closing || ''} onChange={event => setClosing(Number(event.target.value))} /></label><label className="text-sm">Dia do vencimento<input required type="number" min="1" max="31" className={field} value={due || ''} onChange={event => setDue(Number(event.target.value))} /></label></div><label className="block text-sm">Conta para pagar a fatura<FinancialAccountSelect required finance={finance} className={field} value={account} onChange={setAccount} /></label><p className="text-xs text-stone-500">Compras no dia do fechamento entram na próxima fatura. Alterar estes dias vale para novas compras; os vencimentos já registrados permanecem.</p></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className={button}>{busy ? 'Salvando…' : editor.type === 'card' ? 'Salvar cartão' : 'Salvar conta'}</button>
    </form>
  </ModalFrame>;
}

function InvoicePayment({ finance, card, bills, month, onAction, onClose }: { key?: string; finance: FinanceData; card: CreditCard; bills: FinanceBill[]; month: string; onAction: Action; onClose: () => void }) {
  const [account, setAccount] = useState(card.paymentAccount);
  const [date, setDate] = useState(localDateString());
  const [id] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = bills.reduce((sum, bill) => sum + billBalance(bill, finance), 0);
  return <ModalFrame onClose={() => { if (!busy) onClose(); }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4"><form aria-label="Pagar fatura" className="my-6 w-full max-w-lg space-y-4 rounded-2xl bg-white p-5" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { if (await onAction({ type: 'pay_card_invoice', cardId: card.id, month, billIds: bills.map(bill => bill.id), amountCents: amount, account, date, id })) onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível registrar.'); }
    finally { setBusy(false); }
  }}><div className="flex justify-between gap-3"><h3 className="text-lg font-semibold">Pagar fatura · {card.name}</h3><button type="button" disabled={busy} aria-label="Fechar pagamento da fatura" onClick={onClose}><X /></button></div><p className="text-2xl font-semibold">{formatCurrency(money(amount))}</p><label className="block text-sm">Conta de saída<FinancialAccountSelect required className={field} finance={finance} value={account} onChange={setAccount} /></label><label className="block text-sm">Data do pagamento<input required type="date" className={field} value={date} onChange={event => setDate(event.target.value)} /></label><p className="text-xs text-stone-500">Registre depois de pagar pelo banco. O app dá baixa nas parcelas e desconta o valor desta conta.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy || amount <= 0} className={button}>{busy ? 'Registrando…' : 'Confirmar pagamento da fatura'}</button></form></ModalFrame>;
}
