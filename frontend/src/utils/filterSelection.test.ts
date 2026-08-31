import { describe, expect, it } from 'vitest';
import { compatibleCounterpartyIds, toggleSelectedId } from './filterSelection';

describe('множественные фильтры', () => {
  it('добавляет значение и удаляет его повторным нажатием', () => {
    expect(toggleSelectedId(['one'], 'two')).toEqual(['one', 'two']);
    expect(toggleSelectedId(['one', 'two'], 'one')).toEqual(['two']);
  });

  it('удаляет контрагентов, не связанных с выбранными партнерами', () => {
    const counterparties = [
      { id: 'counterparty-1', partner_id: 'partner-1' },
      { id: 'counterparty-2', partner_id: 'partner-2' },
    ];
    expect(compatibleCounterpartyIds(['counterparty-1', 'counterparty-2'], ['partner-2'], counterparties)).toEqual(['counterparty-2']);
    expect(compatibleCounterpartyIds(['counterparty-1', 'counterparty-2'], [], counterparties)).toEqual(['counterparty-1', 'counterparty-2']);
  });
});
