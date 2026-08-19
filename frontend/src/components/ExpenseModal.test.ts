import { describe, expect, it } from 'vitest';
import { invoiceAmountForSubmission } from './ExpenseModal';

describe('ручное добавление расхода', () => {
  it('для оплаты по счету использует сумму счета', () => {
    expect(invoiceAmountForSubmission(true, '1500.00', '1000.00')).toBe('1500.00');
  });

  it('для наличных создает счет на сумму платежа', () => {
    expect(invoiceAmountForSubmission(false, '', '785.00')).toBe('785.00');
  });
});
