export type Expense = { id: string; period: string; partner: string; counterparty: string; stores: string[]; tags: string[]; service_name: string; invoice_total: string; paid_total: string; remaining_total: string; updated_at: string };
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type Partner = { id: string; name: string; comment?: string };
export type Counterparty = { id: string; partner_id: string; full_name: string; short_name?: string; entity_type: string; inn?: string; kpp?: string };
export type Store = { id: string; name: string; address?: string; is_active: boolean };
export type Tag = { id: string; name: string };
export type OCRResponse = {
  result: { counterparty_name?: string; inn?: string; invoice_number?: string; invoice_date?: string; invoice_amount?: string; service_name?: string; service_period?: { month?: number; year?: number } };
  message: string;
};
export type ExpenseDetail = { id:string; partner_id:string; counterparty_id:string; service_name:string; expense_month:number; expense_year:number; contract_number?:string; contract_date?:string; comment?:string; allocations:{store_id:string;store:string;amount:string}[]; tags:{id:string;name:string}[]; invoices:{id:string;invoice_number:string;invoice_date:string;amount:string;payments:{id:string;payment_date:string;amount:string;comment?:string}[]}[]; documents:{id:string;document_type:'invoice'|'closing';original_filename:string;created_at:string}[] };
