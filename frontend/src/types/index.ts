export type Expense={id:string;period:string;partner:string;counterparty:string;service_name:string;invoice_total:string;paid_total:string;remaining_total:string;updated_at:string};
export type Page<T>={items:T[];total:number;page:number;page_size:number};
