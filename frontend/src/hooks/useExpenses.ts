import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Expense, Page } from '../types';

export type ExpenseFilters = {
  search: string; period: string; payment_status: string; partner_ids: string[]; counterparty_ids: string[];
  store_ids: string[]; tag_ids: string[]; amount_from: string; amount_to: string; invoice_date_from: string; invoice_date_to: string;
  invoice_document: string; closing_document: string;
};
export type ExpenseSort = { by: 'invoice_date' | 'period' | 'partner' | 'counterparty' | 'tags' | 'invoice_total' | 'paid_total' | 'remaining_total'; order: 'asc' | 'desc' };
export const EXPENSES_PAGE_SIZE = 100;

export function buildExpenseQuery(filters: ExpenseFilters, page: number, sort: ExpenseSort = { by: 'invoice_date', order: 'desc' }): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(EXPENSES_PAGE_SIZE) });
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) { value.forEach((item) => params.append(key, item)); return; }
    if (!value || value === 'all' || (key === 'period' && !/^(0[1-9]|1[0-2])\.(20\d{2}|21\d{2})$/.test(value))) return;
    params.set(key, value);
  });
  params.set('sort_by', sort.by); params.set('sort_order', sort.order);
  return params.toString();
}

export function buildExpenseIdsQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams(buildExpenseQuery(filters, 1));
  params.delete('page');
  params.delete('page_size');
  params.delete('sort_by');
  params.delete('sort_order');
  return params.toString();
}

const DEFAULT_EXPENSE_SORT: ExpenseSort = { by: 'invoice_date', order: 'desc' };

export function useExpenses(filters: ExpenseFilters, page: number, revision = 0, sort: ExpenseSort = DEFAULT_EXPENSE_SORT) {
  const [data, setData] = useState<Page<Expense>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Page<Expense>>(`/expenses?${buildExpenseQuery(filters, page, sort)}`)
      .then((result) => { if (active) setData(result); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    // При массовом сохранении revision меняется сразу после ответа API. Старый
    // запрос списка может завершиться позже нового и вернуть прежние значения,
    // поэтому его результат больше не применяем к состоянию страницы.
    return () => { active = false; };
  }, [filters, page, revision, sort]);
  return { data, error, loading };
}
