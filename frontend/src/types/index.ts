export type ExpenseNotification = { created_at: string; recipients: string[]; status: string };
export type Expense = { id: string; period: string; partner: string; counterparty: string; stores: string[]; tags: string[]; has_invoice_document: boolean; is_cash_payment: boolean; notification: ExpenseNotification | null; has_closing_document: boolean; service_name: string; invoice_total: string; paid_total: string; remaining_total: string; updated_at: string };
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type DashboardSummary = { invoice_total: string; paid_total: string; remaining_total: string; expense_count: number; period: 'month' | 'quarter' | 'year'; tag_totals: { tag: string; amount: string; expense_count: number }[] };
export type Partner = { id: string; name: string; comment?: string | null };
export type Counterparty = { id: string; partner_id: string | null; full_name: string; short_name?: string | null; entity_type: string; inn?: string | null; kpp?: string | null; comment?: string | null };
export type Store = { id: string; name: string; address?: string; is_active: boolean };
export type StorePreset = { id: string; name: string; store_ids: string[]; stores: string[] };
export type Tag = { id: string; name: string };
export type ExpenseImportResult = { loaded: number; errors_count: number; errors: { row: number; message: string }[] };
export type OCRResponse = {
  status: 'success'; document_id: string;
  fields: { invoice_number: OCRField; invoice_date: OCRField; amount: OCRField; recipient: OCRField; inn: OCRField; kpp: OCRField; service_name: OCRField };
  partner: OCRDirectoryMatch; counterparty: OCRDirectoryMatch;
  ai_fallback: { used: boolean; log_id: string | null; status: 'not_needed' | 'success' | 'partial'; error: string | null };
  raw_text: string;
};
export type OCRSource = 'original' | 'ai' | 'manual';
export type OCRField = { value: string | null; confidence: number; source?: OCRSource };
export type OCRDirectoryMatch = { matched: boolean; id: string | null; name: string | null; suggestion: string | null; source: OCRSource };
export type AISettings = { enabled: boolean; model: string; api_key_saved: boolean; connection_status: 'not_checked' | 'connected' | 'error'; connection_error: string | null; checked_at: string | null };
export type RecognitionJournalItem = { id:string; document_id:string; expense_id:string|null; created_at:string; invoice_number:string|null; invoice_date:string|null; counterparty:string|null; missing_fields:string[]; missing_labels:string[]; reason:string; supplemented_fields:string[]; success:boolean; status:string; model:string; duration_ms:number; error:string|null; filename:string|null };
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
  notification: ExpenseNotification | null;
};
