import type { CreditCard, FinanceData, FinancialAccount } from '../types';

/** Existing account keys remain valid; renaming a registered account keeps its ID. */
export function financialAccounts(finance: FinanceData): FinancialAccount[] {
  const accounts = new Map((finance.accounts || []).map(account => [account.id, account]));
  for (const key of ['Principal', ...finance.entries.flatMap(entry => [entry.account, entry.targetAccount])]) {
    if (key && !accounts.has(key)) accounts.set(key, { id: key, name: key });
  }
  return [...accounts.values()];
}
export const accountName = (finance: FinanceData, id?: string) => financialAccounts(finance).find(account => account.id === id)?.name || id || 'Principal';

/** Calendar arithmetic preserves the intended day through February and short months. */
export function monthlyDueDate(firstDate: string, offset: number, day = Number(firstDate.slice(8, 10))): string {
  const [year, month] = firstDate.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
export function cardFirstDueDate(purchaseDate: string, card: Pick<CreditCard, 'closingDay' | 'dueDay'>): string {
  let closing = monthlyDueDate(purchaseDate, 0, card.closingDay);
  // The closing day itself starts the next invoice, consistently in UI and ledger.
  if (purchaseDate >= closing) closing = monthlyDueDate(purchaseDate, 1, card.closingDay);
  const candidate = monthlyDueDate(closing, 0, card.dueDay);
  return candidate > closing ? candidate : monthlyDueDate(closing, 1, card.dueDay);
}
