from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_,func,or_,select
from sqlalchemy.orm import Session,selectinload
from app.models import Allocation,Counterparty,Document,Expense,Invoice,Partner,Payment,Tag

@dataclass
class ExpenseFilters:
 search:str|None=None
 expense_month:int|None=None
 expense_year:int|None=None
 payment_status:str="all"
 partner_ids:tuple[UUID,...]=()
 counterparty_ids:tuple[UUID,...]=()
 store_ids:tuple[UUID,...]=()
 tag_ids:tuple[UUID,...]=()
 amount_from:Decimal|None=None
 amount_to:Decimal|None=None
 invoice_document:str="all"
 closing_document:str="all"

class ExpenseRepository:
 def __init__(self,db:Session): self.db=db
 def list(self,page:int,page_size:int,filters:ExpenseFilters|None=None):
  filters=filters or ExpenseFilters()
  q=select(Expense).join(Partner).join(Counterparty).where(Expense.deleted_at.is_(None)).options(selectinload(Expense.invoices).selectinload(Invoice.payments),selectinload(Expense.tags),selectinload(Expense.allocations).selectinload(Allocation.store))
  invoice_total=select(func.coalesce(func.sum(Invoice.amount),0)).where(Invoice.expense_id==Expense.id,Invoice.deleted_at.is_(None)).correlate(Expense).scalar_subquery()
  paid_total=select(func.coalesce(func.sum(Payment.amount),0)).join(Invoice,Payment.invoice_id==Invoice.id).where(Invoice.expense_id==Expense.id,Invoice.deleted_at.is_(None),Payment.deleted_at.is_(None)).correlate(Expense).scalar_subquery()
  if filters.search: q=q.where(or_(Expense.service_name.ilike(f"%{filters.search}%"),Expense.contract_number.ilike(f"%{filters.search}%"),Partner.name.ilike(f"%{filters.search}%"),Counterparty.full_name.ilike(f"%{filters.search}%"),Counterparty.inn.ilike(f"%{filters.search}%"),Expense.invoices.any(Invoice.invoice_number.ilike(f"%{filters.search}%"))))
  if filters.expense_month: q=q.where(Expense.expense_month==filters.expense_month)
  if filters.expense_year: q=q.where(Expense.expense_year==filters.expense_year)
  if filters.payment_status=="paid": q=q.where(invoice_total-paid_total<=0)
  elif filters.payment_status=="unpaid": q=q.where(invoice_total-paid_total>0)
  if filters.partner_ids: q=q.where(Expense.partner_id.in_(filters.partner_ids))
  if filters.counterparty_ids: q=q.where(Expense.counterparty_id.in_(filters.counterparty_ids))
  if filters.store_ids: q=q.where(Expense.allocations.any(Allocation.store_id.in_(filters.store_ids)))
  if filters.tag_ids: q=q.where(Expense.tags.any(Tag.id.in_(filters.tag_ids)))
  if filters.amount_from is not None: q=q.where(invoice_total>=filters.amount_from)
  if filters.amount_to is not None: q=q.where(invoice_total<=filters.amount_to)
  for document_type,status in (("invoice",filters.invoice_document),("closing",filters.closing_document)):
   if document_type=="invoice" and status=="cash": q=q.where(Expense.invoices.any(and_(Invoice.invoice_number.ilike("Наличные"),Invoice.deleted_at.is_(None))))
   elif status!="all":
    has_document=Expense.id.in_(select(Document.expense_id).where(Document.document_type==document_type,Document.deleted_at.is_(None),Document.expense_id.is_not(None)))
    q=q.where(has_document if status=="yes" else ~has_document)
  total=self.db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
  return self.db.scalars(q.order_by(Expense.updated_at.desc()).offset((page-1)*page_size).limit(page_size)).unique().all(),total
