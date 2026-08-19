import { describe, expect, it } from 'vitest';
import { filterExpenseCounterparties, filterExpensePartners, invoiceAmountForSubmission } from './ExpenseModal';

describe('ручное добавление расхода', () => {
  it('для оплаты по счету использует сумму счета', () => {
    expect(invoiceAmountForSubmission(true, '1500.00', '1000.00')).toBe('1500.00');
  });

  it('для наличных создает счет на сумму платежа', () => {
    expect(invoiceAmountForSubmission(false, '', '785.00')).toBe('785.00');
  });

  it('ищет партнеров и сохраняет выбранного в результатах', () => {
    const items=[{id:'p1',name:'Альфа'},{id:'p2',name:'Бета'}];
    expect(filterExpensePartners(items,'бет','').map(item=>item.id)).toEqual(['p2']);
    expect(filterExpensePartners(items,'нет','p1').map(item=>item.id)).toEqual(['p1']);
  });

  it('ищет контрагентов выбранного партнера по названию и ИНН', () => {
    const items=[{id:'c1',partner_id:'p1',full_name:'ООО Альфа',entity_type:'company',inn:'123'},{id:'c2',partner_id:'p2',full_name:'ООО Бета',entity_type:'company',inn:'456'}];
    expect(filterExpenseCounterparties(items,'p1','123','').map(item=>item.id)).toEqual(['c1']);
    expect(filterExpenseCounterparties(items,'p1','бета','')).toEqual([]);
  });
});
