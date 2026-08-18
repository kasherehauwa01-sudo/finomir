export type Expense = { id: string; period: string; partner: string; counterparty: string; stores: string[]; tags: string[]; has_invoice_document: boolean; has_closing_document: boolean; service_name: string; invoice_total: string; paid_total: string; remaining_total: string; updated_at: string };
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type DashboardSummary = { invoice_total: string; paid_total: string; remaining_total: string; expense_count: number; period: 'month' | 'quarter' | 'year'; tag_totals: { tag: string; amount: string; expense_count: number }[] };
export type Partner = { id: string; name: string; comment?: string | null };
export type Counterparty = { id: string; partner_id: string | null; full_name: string; short_name?: string | null; entity_type: string; inn?: string | null; kpp?: string | null; comment?: string | null };
export type Store = { id: string; name: string; address?: string; is_active: boolean };
export type Tag = { id: string; name: string };
export type OCRResponse = {
  status: 'success'; document_id: string;
  fields: { invoice_number: OCRField; invoice_date: OCRField; amount: OCRField; recipient: OCRField; inn: OCRField; kpp: OCRField };
  counterparty: { matched: boolean; id: string | null; name: string | null }; raw_text: string;
};
export type OCRField = { value: string | null; confidence: number };
export type PartnerDetail = Partner & { counterparties: Pick<Counterparty, 'id' | 'full_name' | 'inn' | 'kpp'>[] };

export type ExpenseAllocation = { store_id: string; store: string; amount: string };
export type ExpenseTag = { id: string; name: string };
export type ExpensePayment = { id: string; payment_date: string; amount: string; comment: string | null };
export type ExpenseInvoice = { id: string; invoice_number: string; invoice_date: string; amount: string; payments: ExpensePayment[] };
export type ExpenseDocument = { id: string; document_type: 'invoice' | 'closing'; original_filename: string; mime_type: string; created_at: string };

/** Точное представление ответа GET /expenses/{expense_id}. */
export type ExpenseDetail = {
  id: string;
  partner_id: string;
  counterparty_id: string;
  service_name: string;
  expense_month: number;
  expense_year: number;
  contract_number: string | null;
  contract_date: string | null;
  comment: string | null;
  allocations: ExpenseAllocation[];
  tags: ExpenseTag[];
  invoices: ExpenseInvoice[];
  documents: ExpenseDocument[];
};
