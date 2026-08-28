from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_,func,or_,select
from sqlalchemy.orm import Session,selectinload
from app.models import Allocation,Counterparty,Expense,Invoice,Partner
class ExpenseRepository:
 def __init__(self,db:Session): self.db=db
 def list(self,page:int,page_size:int,search:str|None):
  q=select(Expense).join(Partner).join(Counterparty).where(Expense.deleted_at.is_(None)).options(selectinload(Expense.invoices).selectinload(Invoice.payments),selectinload(Expense.tags),selectinload(Expense.allocations).selectinload(Allocation.store))
  if search: q=q.where(or_(Expense.service_name.ilike(f"%{search}%"),Expense.contract_number.ilike(f"%{search}%"),Partner.name.ilike(f"%{search}%"),Counterparty.full_name.ilike(f"%{search}%"),Counterparty.inn.ilike(f"%{search}%"),Expense.invoices.any(Invoice.invoice_number.ilike(f"%{search}%"))))
  total=self.db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
  q=q.options(selectinload(Expense.invoices).selectinload(Invoice.payments),selectinload(Expense.tags),selectinload(Expense.allocations).selectinload(Allocation.store))
  invoice_total=select(func.coalesce(func.sum(Invoice.amount),0)).where(Invoice.expense_id==Expense.id,Invoice.deleted_at.is_(None)).correlate(Expense).scalar_subquery()
  paid_total=select(func.coalesce(func.sum(Payment.amount),0)).join(Invoice,Payment.invoice_id==Invoice.id).where(Invoice.expense_id==Expense.id,Invoice.deleted_at.is_(None),Payment.deleted_at.is_(None)).correlate(Expense).scalar_subquery()
  first_tag=select(func.min(func.lower(Tag.name))).join(ExpenseTag,ExpenseTag.tag_id==Tag.id).where(ExpenseTag.expense_id==Expense.id).correlate(Expense).scalar_subquery()
  latest_invoice_date=select(func.max(Invoice.invoice_date)).where(Invoice.expense_id==Expense.id,Invoice.deleted_at.is_(None)).correlate(Expense).scalar_subquery()
  sort_columns={"invoice_date":(latest_invoice_date,),"period":(Expense.expense_year,Expense.expense_month),"partner":(func.lower(Partner.name),),"counterparty":(func.lower(Counterparty.full_name),),"tags":(first_tag,),"invoice_total":(invoice_total,),"paid_total":(paid_total,),"remaining_total":(invoice_total-paid_total,)}
  direction="asc" if sort_order=="asc" else "desc"
  order=[getattr(column,direction)().nulls_last() for column in sort_columns.get(sort_by,sort_columns["invoice_date"])]
  return self.db.scalars(q.order_by(*order,Expense.id.asc()).offset((page-1)*page_size).limit(page_size)).unique().all(),total
 def ids(self,filters:ExpenseFilters|None=None):
  q=self._filtered_query(filters or ExpenseFilters()).with_only_columns(Expense.id).order_by(None)
  return self.db.scalars(q).all()
