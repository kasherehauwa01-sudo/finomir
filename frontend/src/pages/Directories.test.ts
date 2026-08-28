import { describe, expect, it } from 'vitest';
import { filterLinkedCounterparties, filterPartners } from './Directories';

describe('поиск в связях справочников', () => {
  const partners = [{ id: 'p1', name: 'Первый партнер' }, { id: 'p2', name: 'Второй партнер' }];
  const counterparties = [{ id: 'c1', partner_id: 'p1', full_name: 'ООО Альфа', entity_type: 'company', inn: '123' }, { id: 'c2', partner_id: null, full_name: 'ООО Бета', entity_type: 'company', inn: '456' }];

  it('ищет связанных контрагентов по названию и ИНН', () => {
    expect(filterLinkedCounterparties(counterparties, 'альфа').map(item=>item.id)).toEqual(['c1']);
    expect(filterLinkedCounterparties(counterparties, '456').map(item=>item.id)).toEqual(['c2']);
  });

  it('ищет партнеров по названию и сохраняет выбранного в списке', () => {
    expect(filterPartners(partners, 'второй').map(item=>item.id)).toEqual(['p2']);
    expect(filterPartners(partners, 'нет совпадений', 'p1').map(item=>item.id)).toEqual(['p1']);
  });
});
