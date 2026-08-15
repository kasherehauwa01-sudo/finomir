import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Expense, Page } from '../types';

export function useExpenses(search: string, page: number, revision = 0) {
  const [data, setData] = useState<Page<Expense>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setError('');
    api<Page<Expense>>(`/expenses?page=${page}&page_size=25&search=${encodeURIComponent(search)}`)
      .then(setData).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [search, page, revision]);
  return { data, error, loading };
}
