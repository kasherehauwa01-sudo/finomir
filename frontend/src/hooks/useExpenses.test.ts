import { describe, expect, it } from 'vitest';
import { buildExpenseQuery, type ExpenseFilters } from './useExpenses';

const filters: ExpenseFilters = {
  search: 'реклама', period: '08.2026', payment_status: 'unpaid', partner_id: 'partner', counterparty_id: 'counterparty',
  store_id: 'store', tag_id: 'tag', amount_from: '10000', amount_to: '50000', invoice_document: 'yes', closing_document: 'no',
};

describe('expense filters query', () => {
  it('передает все совместные фильтры и страницу на backend', () => {
    const params = new URLSearchParams(buildExpenseQuery(filters, 3));
    expect(Object.fromEntries(params)).toEqual({ page: '3', page_size: '25', ...filters });
  });

  it('не отправляет пустые, all и незавершенный период', () => {
    const params = new URLSearchParams(buildExpenseQuery({ ...filters, search: '', period: '08.', payment_status: 'all', invoice_document: 'all' }, 1));
    expect(params.has('search')).toBe(false);
    expect(params.has('period')).toBe(false);
    expect(params.has('payment_status')).toBe(false);
    expect(params.has('invoice_document')).toBe(false);
  });
});
