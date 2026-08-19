import { describe, expect, it } from 'vitest';
import { buildExpenseQuery, type ExpenseFilters } from './useExpenses';

const filters: ExpenseFilters = {
  search: 'реклама', period: '08.2026', payment_status: 'unpaid', partner_ids: ['partner-1', 'partner-2'], counterparty_ids: ['counterparty'],
  store_ids: ['store'], tag_ids: ['tag-1', 'tag-2'], amount_from: '10000', amount_to: '50000', invoice_document: 'yes', closing_document: 'no',
};

describe('expense filters query', () => {
  it('передает все совместные фильтры и страницу на backend', () => {
    const params = new URLSearchParams(buildExpenseQuery(filters, 3));
    expect(params.get('page')).toBe('3');
    expect(params.getAll('partner_ids')).toEqual(filters.partner_ids);
    expect(params.getAll('tag_ids')).toEqual(filters.tag_ids);
    expect(params.get('amount_from')).toBe('10000');
    expect(params.get('sort_by')).toBe('period');
    expect(params.get('sort_order')).toBe('desc');
  });

  it('передает выбранную сортировку', () => {
    const params = new URLSearchParams(buildExpenseQuery(filters, 1, { by: 'invoice_total', order: 'asc' }));
    expect(params.get('sort_by')).toBe('invoice_total');
    expect(params.get('sort_order')).toBe('asc');
  });

  it('не отправляет пустые, all и незавершенный период', () => {
    const params = new URLSearchParams(buildExpenseQuery({ ...filters, search: '', period: '08.', payment_status: 'all', invoice_document: 'all' }, 1));
    expect(params.has('search')).toBe(false);
    expect(params.has('period')).toBe(false);
    expect(params.has('payment_status')).toBe(false);
    expect(params.has('invoice_document')).toBe(false);
  });
});
