export type Expense = { id: string; period: string; partner: string; counterparty: string; service_name: string; invoice_total: string; paid_total: string; remaining_total: string; updated_at: string };
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type Partner = { id: string; name: string; comment?: string };
export type Counterparty = { id: string; partner_id: string; full_name: string; short_name?: string; entity_type: string; inn?: string; kpp?: string };
export type Store = { id: string; name: string; address?: string; is_active: boolean };
export type Tag = { id: string; name: string };
export type OCRResponse = {
  result: { counterparty_name?: string; inn?: string; invoice_number?: string; invoice_date?: string; invoice_amount?: string; service_name?: string; service_period?: { month?: number; year?: number } };
  message: string;
};
