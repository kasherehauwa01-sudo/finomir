import { describe, expect, it } from 'vitest';
import { defaultExpenseColumns, expenseColumns, globalSelectionLabel, showGlobalSelection } from './Expenses';

describe('настройка колонок расходов', () => {
  it('предлагает номер и дату счета, но скрывает их по умолчанию', () => {
    const available = expenseColumns.map(([key]) => key);
    expect(available).toContain('invoice_number');
    expect(available).toContain('invoice_date');
    expect(defaultExpenseColumns).not.toContain('invoice_number');
    expect(defaultExpenseColumns).not.toContain('invoice_date');
  });

  it('предлагает выбрать весь список только после выбора текущей страницы', () => {
    expect(showGlobalSelection(false, 0, 1247)).toBe(false);
    expect(showGlobalSelection(true, 25, 1247)).toBe(true);
    expect(globalSelectionLabel(1247)).toBe('Выбрать все: 1247');
  });
});
