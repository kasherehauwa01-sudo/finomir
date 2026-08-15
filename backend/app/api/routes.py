from datetime import date,datetime,timezone
from decimal import Decimal
from io import BytesIO
from uuid import UUID
from fastapi import APIRouter,Depends,File,HTTPException,Query,UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel,Field
from sqlalchemy import func,select,text
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models import *
from app.repositories.expenses import ExpenseRepository
from app.services.finance import expense_totals,invoice_totals
from app.services.ocr import get_provider
from app.services.storage import save_bytes
router=APIRouter()
class PartnerIn(BaseModel): name:str=Field(min_length=1,max_length=255); comment:str|None=None
class CounterpartyIn(BaseModel): partner_id:UUID; full_name:str; short_name:str|None=None; entity_type:str; inn:str|None=None; kpp:str|None=None; comment:str|None=None
class AllocationIn(BaseModel): store_id:UUID; amount:Decimal=Field(gt=0)
class ExpenseIn(BaseModel): partner_id:UUID; counterparty_id:UUID; service_name:str; expense_month:int=Field(ge=1,le=12); expense_year:int=Field(ge=2000,le=2200); contract_number:str|None=None; contract_date:date|None=None; comment:str|None=None; allocations:list[AllocationIn]=Field(default_factory=list)
class InvoiceIn(BaseModel): invoice_number:str; invoice_date:date; amount:Decimal=Field(ge=0); vat_amount:Decimal|None=Field(default=None,ge=0); comment:str|None=None; allow_duplicate:bool=False
class PaymentIn(BaseModel): payment_date:date; amount:Decimal=Field(ge=0); comment:str|None=None
class StoreIn(BaseModel): name:str=Field(min_length=1,max_length=255); address:str|None=None; comment:str|None=None
class TagIn(BaseModel): name:str=Field(min_length=1,max_length=100)
@router.get("/health")
def health(db:Session=Depends(get_db)): db.execute(text("select 1")); return {"status":"ok","database":"ok"}
@router.get("/partners")
def partners(search:str|None=None,db:Session=Depends(get_db)):
 q=select(Partner).where(Partner.deleted_at.is_(None)); q=q.where(Partner.name.ilike(f"%{search}%")) if search else q
 return db.scalars(q.order_by(Partner.name)).all()
@router.post("/partners",status_code=201)
def create_partner(data:PartnerIn,db:Session=Depends(get_db)):
 x=Partner(**data.model_dump()); db.add(x); db.commit(); return x
@router.delete("/partners/{item_id}",status_code=204)
def archive_partner(item_id:UUID,db:Session=Depends(get_db)):
 x=db.get(Partner,item_id)
 if not x: raise HTTPException(404,"Партнер не найден")
 x.deleted_at=datetime.now(timezone.utc); db.commit()
@router.get("/counterparties")
def counterparties(search:str|None=None,inn:str|None=None,db:Session=Depends(get_db)):
 q=select(Counterparty).where(Counterparty.deleted_at.is_(None)); q=q.where(Counterparty.inn==inn) if inn else q; q=q.where(Counterparty.full_name.ilike(f"%{search}%")) if search else q; return db.scalars(q).all()
@router.post("/counterparties",status_code=201)
def create_counterparty(data:CounterpartyIn,db:Session=Depends(get_db)):
 if not db.get(Partner,data.partner_id): raise HTTPException(422,"Партнер не найден")
 x=Counterparty(**data.model_dump()); db.add(x); db.commit(); return x
@router.get("/stores")
def stores(db:Session=Depends(get_db)):
 return db.scalars(select(Store).where(Store.is_active.is_(True)).order_by(Store.name)).all()
@router.post("/stores",status_code=201)
def create_store(data:StoreIn,db:Session=Depends(get_db)):
 x=Store(**data.model_dump()); db.add(x); db.commit(); return x
@router.get("/tags")
def tags(db:Session=Depends(get_db)):
 return db.scalars(select(Tag).order_by(Tag.name)).all()
@router.post("/tags",status_code=201)
def create_tag(data:TagIn,db:Session=Depends(get_db)):
 x=Tag(**data.model_dump()); db.add(x); db.commit(); return x
@router.get("/expenses")
def expenses(page:int=Query(1,ge=1),page_size:int=Query(25,ge=25,le=100),search:str|None=None,db:Session=Depends(get_db)):
 items,total=ExpenseRepository(db).list(page,page_size,search); out=[]
 for x in items:
  it,paid,remaining=expense_totals([(i.amount,[p.amount for p in i.payments if not p.deleted_at]) for i in x.invoices if not i.deleted_at]); out.append({"id":x.id,"partner":x.partner.name,"counterparty":x.counterparty.full_name,"stores":[a.store.name for a in x.allocations],"service_name":x.service_name,"period":f"{x.expense_month:02d}.{x.expense_year}","invoice_total":it,"paid_total":paid,"remaining_total":remaining,"updated_at":x.updated_at})
 return {"items":out,"total":total,"page":page,"page_size":page_size}
@router.post("/expenses",status_code=201)
def create_expense(data:ExpenseIn,db:Session=Depends(get_db)):
 if not db.get(Partner,data.partner_id) or not db.get(Counterparty,data.counterparty_id): raise HTTPException(422,"Партнер или контрагент не найден")
 if any(not db.get(Store,item.store_id) for item in data.allocations): raise HTTPException(422,"Магазин не найден")
 values=data.model_dump(exclude={"allocations"}); x=Expense(**values); db.add(x); db.flush()
 for item in data.allocations: db.add(Allocation(expense_id=x.id,**item.model_dump()))
 db.add(AuditLog(entity_type="expense",entity_id=x.id,action="created",metadata_={},created_at=datetime.now(timezone.utc))); db.commit(); return {"id":x.id}
@router.post("/expenses/{expense_id}/invoices",status_code=201)
def add_invoice(expense_id:UUID,data:InvoiceIn,db:Session=Depends(get_db)):
 exp=db.get(Expense,expense_id)
 if not exp or exp.deleted_at: raise HTTPException(404,"Расход не найден")
 dup=db.scalar(select(Invoice).join(Expense).join(Counterparty).where(Counterparty.inn==exp.counterparty.inn,func.lower(Invoice.invoice_number)==data.invoice_number.lower(),Invoice.invoice_date==data.invoice_date,Invoice.amount==data.amount,Invoice.deleted_at.is_(None)))
 if dup and not data.allow_duplicate: raise HTTPException(409,detail={"message":"Возможно, этот счет уже существует","invoice_id":str(dup.id),"expense_id":str(dup.expense_id)})
 x=Invoice(expense_id=expense_id,**data.model_dump(exclude={"allow_duplicate"})); db.add(x); db.flush(); db.add(AuditLog(entity_type="invoice",entity_id=x.id,action="created",metadata_={},created_at=datetime.now(timezone.utc))); db.commit(); return {"id":x.id}
@router.post("/invoices/{invoice_id}/payments",status_code=201)
def add_payment(invoice_id:UUID,data:PaymentIn,db:Session=Depends(get_db)):
 inv=db.get(Invoice,invoice_id)
 if not inv or inv.deleted_at: raise HTTPException(404,"Счет не найден")
 x=Payment(invoice_id=invoice_id,**data.model_dump()); db.add(x); db.flush(); db.add(AuditLog(entity_type="payment",entity_id=x.id,action="created",metadata_={},created_at=datetime.now(timezone.utc))); db.commit(); paid,remaining=invoice_totals(inv.amount,[p.amount for p in inv.payments if not p.deleted_at]); return {"id":x.id,"paid_amount":paid,"remaining_amount":remaining}
@router.post("/ocr")
async def ocr(file:UploadFile=File(...)):
 data=await file.read(); s=get_settings()
 try: stored,path,sha=save_bytes(data,file.filename or "document",file.content_type or "",s.upload_dir,s.max_upload_size_mb)
 except ValueError as e: raise HTTPException(422,str(e))
 result=get_provider(s.ocr_provider).recognize(path,file.content_type or ""); return {"document":{"stored_filename":stored,"sha256":sha},"result":result.__dict__,"needs_review":True,"message":"Проверьте распознанные данные. OCR не является окончательным источником."}
@router.get("/export")
def export(db:Session=Depends(get_db)):
 items,_=ExpenseRepository(db).list(1,100,None); wb=Workbook(); ws=wb.active; ws.title="Расходы"; ws.append(["Период","Партнер","Контрагент","ИНН","Услуга","Договор","Счет","Дата счета","Сумма","Оплачено","Остаток"])
 for e in items:
  for i in e.invoices or [None]:
   paid,remain=invoice_totals(i.amount,[p.amount for p in i.payments if not p.deleted_at]) if i else (Decimal(0),Decimal(0)); ws.append([f"{e.expense_month:02d}.{e.expense_year}",e.partner.name,e.counterparty.full_name,e.counterparty.inn,e.service_name,e.contract_number,i.invoice_number if i else "",i.invoice_date if i else "",i.amount if i else 0,paid,remain])
 stream=BytesIO(); wb.save(stream); stream.seek(0); return StreamingResponse(stream,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":"attachment; filename=expenses.xlsx"})
