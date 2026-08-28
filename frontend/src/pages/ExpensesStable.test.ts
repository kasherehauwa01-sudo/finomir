import { describe, expect, it } from 'vitest';
import { selectAllRowsLabel } from './ExpensesStable';

describe('множественный выбор расходов', () => {
  it('показывает общее количество строк реестра', () => {
    expect(selectAllRowsLabel(147)).toBe('Выделить все строки (147)');
  });
});
