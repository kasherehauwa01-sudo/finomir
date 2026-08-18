import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Expense, Page } from '../types';

export type ExpenseFilters = {
  search: string; period: string; payment_status: string; partner_ids: string[]; counterparty_ids: string[];
  store_ids: string[]; tag_ids: string[]; amount_from: string; amount_to: string;
  invoice_document: string; closing_document: string;
};

export function buildExpenseQuery(filters: ExpenseFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: '25' });
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) { value.forEach((item) => params.append(key, item)); return; }
    if (!value || value === 'all' || (key === 'period' && !/^(0[1-9]|1[0-2])\.(20\d{2}|21\d{2})$/.test(value))) return;
    params.set(key, value);
  });
  return params.toString();
}

export function useExpenses(filters: ExpenseFilters, page: number, revision = 0) {
  const [data, setData] = useState<Page<Expense>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setError('');
    api<Page<Expense>>(`/expenses?${buildExpenseQuery(filters, page)}`)
      .then(setData).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [filters, page, revision]);
  return { data, error, loading };
}
