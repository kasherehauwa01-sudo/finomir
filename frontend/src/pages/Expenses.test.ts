import { describe, expect, it } from 'vitest';
import { defaultExpenseColumns, expenseColumns } from './Expenses';

describe('настройка колонок расходов', () => {
  it('предлагает номер и дату счета, но скрывает их по умолчанию', () => {
    const available = expenseColumns.map(([key]) => key);
    expect(available).toContain('invoice_number');
    expect(available).toContain('invoice_date');
    expect(defaultExpenseColumns).not.toContain('invoice_number');
    expect(defaultExpenseColumns).not.toContain('invoice_date');
  });
});
