import logging
import mimetypes
import smtplib
from email.message import EmailMessage
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session,selectinload
from app.models import Allocation,Document,Expense,Invoice,NotificationLog,NotificationScenario,SMTPSetting
from app.services.email import load_attachment,send_email
from app.config import Settings

logger=logging.getLogger(__name__)
DEFAULT_SUBJECT="В бухгалтерию. Счет на оплату. {{invoice_amount}} ₽"
DEFAULT_BODY="""Прошу переслать счет в бухгалтерию.\n\nУслуга: {{service_name}}\nСумма счета: {{invoice_amount}} ₽\n\nПлатеж относится к магазинам:\n\n{{stores}}\n\nСчет на оплату прикреплен к письму."""
VARIABLES=["invoice_amount","invoice_number","invoice_date","service_name","counterparty","partner","stores"]
def ensure_scenario(db:Session)->NotificationScenario:
 item=db.scalar(select(NotificationScenario).where(NotificationScenario.code=="new_invoice"))
 if not item: item=NotificationScenario(code="new_invoice",name="Отправка уведомления о новом счете",enabled=False,subject_template=DEFAULT_SUBJECT,body_template=DEFAULT_BODY,recipients=[]); db.add(item); db.commit(); db.refresh(item)
 return item
def render(template:str,values:dict)->str:
 for key,value in values.items(): template=template.replace("{{"+key+"}}",str(value))
 return template
def money(value:Decimal)->str:return f"{value:,.2f}".replace(","," ").replace(".",",")
def notify_new_invoice(document_id:UUID,db:Session)->dict:
 existing=db.scalar(select(NotificationLog).where(NotificationLog.notification_type=="new_invoice",NotificationLog.document_id==document_id))
 if existing and existing.status=="sent": return {"status":"sent","reason":"already_sent"}
 document=db.get(Document,document_id); scenario=ensure_scenario(db)
 if not document or document.document_type!="invoice" or not document.expense_id:return {"status":"skipped","reason":"invoice_document_missing"}
 if not scenario.enabled:return {"status":"skipped","reason":"scenario_disabled"}
 expense=db.scalar(select(Expense).where(Expense.id==document.expense_id).options(selectinload(Expense.allocations).selectinload(Allocation.store),selectinload(Expense.partner),selectinload(Expense.counterparty),selectinload(Expense.invoices)))
 invoice=next((item for item in sorted(expense.invoices,key=lambda x:x.created_at,reverse=True) if not item.deleted_at),None); recipients=list(scenario.recipients or []); amount=invoice.amount if invoice else Decimal(0)
 stores=[item.store.name for item in expense.allocations]; stores_text='\n'.join(f"- {name}{';' if index<len(stores)-1 else '.'}" for index,name in enumerate(stores)) or "- Магазины не указаны."
 values={"invoice_amount":money(amount),"invoice_number":invoice.invoice_number if invoice else "","invoice_date":invoice.invoice_date.strftime("%d.%m.%Y") if invoice else "","service_name":expense.service_name,"counterparty":expense.counterparty.full_name,"partner":expense.partner.name,"stores":stores_text}; subject=render(scenario.subject_template,values); body=render(scenario.body_template,values)
 log=existing or NotificationLog(notification_type="new_invoice",document_id=document.id)
 log.status="error"; log.recipients=recipients; log.subject=subject; log.body=body; log.expense_id=expense.id; log.invoice_id=invoice.id if invoice else None; log.original_filename=document.original_filename; log.attachment_present=False; log.attachment_size=document.file_size; log.created_at=datetime.now(timezone.utc); log.error=None
 if not existing: db.add(log)
 settings=None; smtp_attempted=False
 try:
  if not recipients: raise ValueError("В сценарии не указаны адресаты")
  settings=db.scalar(select(SMTPSetting).order_by(SMTPSetting.updated_at.desc()))
  if not settings: raise ValueError("SMTP не настроен")
  attachment=load_attachment(document.storage_path,document.original_filename,document.mime_type); log.attachment_present=True; smtp_attempted=True; send_email(settings,recipients,subject,body,[attachment]); log.status="sent"; log.error=None; settings.status="configured"; settings.last_error=None
 except Exception as error:
  log.error=str(error); logger.exception("New invoice notification failed for document %s",document_id)
  if settings and smtp_attempted: settings.status="error"; settings.last_error=str(error)
 db.commit()
 return {"status":log.status,"reason":None if log.status=="sent" else "delivery_failed"}
