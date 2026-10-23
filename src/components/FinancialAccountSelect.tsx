import React from 'react';
import type { FinanceData } from '../types';
import { financialAccounts } from '../utils/bankAccounts';

export function FinancialAccountSelect({ finance, value, onChange, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { finance: FinanceData; value: string; onChange: (value: string) => void }) {
  return <select {...props} value={value} onChange={event => onChange(event.target.value)}>
    {!value && <option value="">Selecione a conta</option>}
    {financialAccounts(finance).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
  </select>;
}
