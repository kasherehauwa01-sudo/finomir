import { describe, expect, it } from 'vitest';
import { filterCheckboxOptions } from './SearchableCheckboxFilter';

const options = [
  { id: '1', name: 'Альфа' },
  { id: '2', name: 'Бета', search: 'ИНН 123456' },
];

describe('поиск в выпадающем фильтре', () => {
  it('ищет без учета регистра и пробелов по краям', () => {
    expect(filterCheckboxOptions(options, '  АЛЬФ  ').map((item) => item.id)).toEqual(['1']);
  });

  it('учитывает дополнительную поисковую строку значения', () => {
    expect(filterCheckboxOptions(options, '123456').map((item) => item.id)).toEqual(['2']);
  });
});
