// Обычный и Stable-маршруты используют один рабочий реестр. Это исключает
// повторное появление потерянных helper-функций после merge.
export { Expenses } from './ExpensesStable';

export const expenseColumns = [
  ['invoice_date', 'Дата счета'], ['invoice_number', 'Номер счета'],
  ['period', 'Период'], ['partner', 'Партнер'], ['counterparty', 'Контрагент'],
  ['stores', 'Магазины'], ['tags', 'Тег'], ['service_name', 'Услуга'],
  ['invoice_total', 'Сумма счетов'], ['paid_total', 'Оплачено'],
  ['remaining_total', 'Остаток'], ['has_invoice_document', 'Счет'],
  ['has_closing_document', 'Акт'],
] as const;

export const defaultExpenseColumns = expenseColumns
  .map(([key]) => key)
  .filter((key) => key !== 'invoice_number' && key !== 'invoice_date');
export const showGlobalSelection = (allPageSelected: boolean, selected: number, total: number) => allPageSelected && selected < total;
export const globalSelectionLabel = (total: number) => `Выбрать все: ${total}`;
