import { describe, expect, it } from 'vitest';
import { filterCheckboxOptions } from './SearchCheckboxFilter';

describe('поиск в раскрывающемся фильтре', () => {
  const options = [
    { id: 'one', name: 'ООО Альфа', search: 'ООО Альфа 123456' },
    { id: 'two', name: 'ООО Бета', search: 'ООО Бета 987654' },
  ];

  it('ищет без учета регистра по названию и дополнительным данным', () => {
    expect(filterCheckboxOptions(options, 'АЛЬФА').map((item) => item.id)).toEqual(['one']);
    expect(filterCheckboxOptions(options, '987654').map((item) => item.id)).toEqual(['two']);
  });

  it('показывает все значения при пустом поиске', () => {
    expect(filterCheckboxOptions(options, '')).toEqual(options);
  });
});
