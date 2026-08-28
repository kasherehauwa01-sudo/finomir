import { describe, expect, it } from 'vitest';
import { buildExpenseRegistryQuery } from './useExpenses';

describe('buildExpenseRegistryQuery', () => {
  it('формирует запрос стабильного реестра без экспериментальных фильтров', () => {
    expect(buildExpenseRegistryQuery('ООО Ромашка & партнер', 3))
      .toBe('/expenses?page=3&page_size=25&search=%D0%9E%D0%9E%D0%9E+%D0%A0%D0%BE%D0%BC%D0%B0%D1%88%D0%BA%D0%B0+%26+%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D0%B5%D1%80');
  });
});
