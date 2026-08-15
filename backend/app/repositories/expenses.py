from sqlalchemy import Select,func,or_,select
from sqlalchemy.orm import Session,selectinload
from app.models import Counterparty,Expense,Invoice,Partner
class ExpenseRepository:
 def __init__(self,db:Session): self.db=db
 def list(self,page:int,page_size:int,search:str|None):
  q=select(Expense).join(Partner).join(Counterparty).where(Expense.deleted_at.is_(None)).options(selectinload(Expense.invoices).selectinload(Invoice.payments),selectinload(Expense.tags),selectinload(Expense.allocations))
  if search: q=q.where(or_(Expense.service_name.ilike(f"%{search}%"),Expense.contract_number.ilike(f"%{search}%"),Partner.name.ilike(f"%{search}%"),Counterparty.full_name.ilike(f"%{search}%"),Counterparty.inn.ilike(f"%{search}%"),Expense.invoices.any(Invoice.invoice_number.ilike(f"%{search}%"))))
  total=self.db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
  return self.db.scalars(q.order_by(Expense.updated_at.desc()).offset((page-1)*page_size).limit(page_size)).unique().all(),total
