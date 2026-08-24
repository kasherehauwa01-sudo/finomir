import { describe, expect, it } from 'vitest';
import { filterSearchOptions, invoiceAmountForSubmission, singleExpenseTag } from './ExpenseModalStable';

describe('поиск в списках расхода', () => {
  const options = [
    { id: 'one', label: 'ООО Альфа', search: 'ООО Альфа 123456' },
    { id: 'two', label: 'ООО Бета', search: 'ООО Бета 987654' },
  ];

  it('ищет по названию и ИНН, сохраняя выбранный пункт в выдаче', () => {
    expect(filterSearchOptions(options, '987654', '').map((item) => item.id)).toEqual(['two']);
    expect(filterSearchOptions(options, 'нет совпадений', 'one').map((item) => item.id)).toEqual(['one']);
  });
});

describe('выбор тега расхода', () => {
  it('заменяет предыдущий тег новым', () => {
    expect(singleExpenseTag(['tag-1'], 'tag-2')).toEqual(['tag-2']);
  });
});

describe('тип оплаты расхода', () => {
  it('для счета использует сумму счета, а для оплаты без счета — сумму платежа', () => {
    expect(invoiceAmountForSubmission(true, '1500', '1000')).toBe('1500');
    expect(invoiceAmountForSubmission(false, '', '1000')).toBe('1000');
  });
});
