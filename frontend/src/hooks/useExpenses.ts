import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Expense, Page } from '../types';

export function buildExpenseRegistryQuery(search: string, page: number): string {
  const query = new URLSearchParams({
    page: String(page),
    page_size: '25',
    search,
  });
  return `/expenses?${query.toString()}`;
}

/**
 * Контракт активного стабильного реестра расходов.
 * Отдельное имя не позволяет случайно подменить строковый поиск объектом
 * фильтров из экспериментальной страницы при разрешении merge-конфликта.
 */
export function useExpenseRegistry(search: string, page: number, revision = 0) {
  const [data, setData] = useState<Page<Expense>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setError('');
    api<Page<Expense>>(buildExpenseRegistryQuery(search, page))
      .then(setData).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [search, page, revision]);
  return { data, error, loading };
}

// Сохраняем прежнее публичное имя для страниц, которые ещё используют его.
export const useExpenses = useExpenseRegistry;
