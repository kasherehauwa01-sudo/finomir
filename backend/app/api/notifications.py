import logging
from datetime import datetime,timezone
from typing import Literal
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field,field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NotificationLog,NotificationScenario,SMTPSetting
from app.services.email import encrypt_password,send_email
from app.services.notifications import VARIABLES,ensure_scenario

router=APIRouter(); logger=logging.getLogger(__name__)
def valid_email(value:str)->str:
 value=value.strip()
 if "@" not in value or value.startswith("@") or value.endswith("@"): raise ValueError("Некорректный email")
 return value
class SMTPIn(BaseModel):
 host:str=Field(min_length=1,max_length=255); port:int=Field(ge=1,le=65535); security:Literal["ssl","starttls","none"]; username:str|None=None; password:str|None=None; from_email:str; from_name:str|None=None
 _email=field_validator("from_email")(valid_email)
class TestEmailIn(BaseModel):
 recipient:str
 _email=field_validator("recipient")(valid_email)
class ScenarioIn(BaseModel):
 enabled:bool; subject_template:str=Field(min_length=1,max_length=500); body_template:str=Field(min_length=1); recipients:list[str]
 @field_validator("recipients")
 @classmethod
 def emails(cls,values): return [valid_email(value) for value in values]
def smtp_out(item): return {"host":item.host,"port":item.port,"security":item.security,"username":item.username,"from_email":item.from_email,"from_name":item.from_name,"password_set":bool(item.password_encrypted),"status":item.status,"last_error":item.last_error}
@router.get("/settings/smtp")
def get_smtp(db:Session=Depends(get_db)):
 item=db.scalar(select(SMTPSetting).order_by(SMTPSetting.updated_at.desc())); return smtp_out(item) if item else {"status":"not_configured","password_set":False}
@router.put("/settings/smtp")
def put_smtp(data:SMTPIn,db:Session=Depends(get_db)):
 item=db.scalar(select(SMTPSetting).order_by(SMTPSetting.updated_at.desc()))
 if not item: item=SMTPSetting(); db.add(item)
 for key,value in data.model_dump(exclude={"password"}).items(): setattr(item,key,value)
 if data.password: item.password_encrypted=encrypt_password(data.password)
 item.status="configured"; item.last_error=None; db.commit(); db.refresh(item); return smtp_out(item)
@router.post("/settings/smtp/test")
def test_smtp(data:TestEmailIn,db:Session=Depends(get_db)):
 item=db.scalar(select(SMTPSetting).order_by(SMTPSetting.updated_at.desc())); subject="Finomir - проверка SMTP"; body="SMTP настроен успешно. Это тестовое сообщение Finomir."; log=NotificationLog(notification_type="test",status="error",recipients=[data.recipient],subject=subject,body=body,attachment_present=False,created_at=datetime.now(timezone.utc)); db.add(log)
 try:
  if not item: raise ValueError("SMTP не настроен")
  send_email(item,[data.recipient],subject,body); log.status="sent"; item.status="configured"; item.last_error=None
 except Exception as error:
  log.error=str(error); logger.exception("SMTP test failed");
  if item: item.status="error"; item.last_error=str(error)
  db.commit(); raise HTTPException(502,"Не удалось отправить тестовое письмо") from error
 db.commit(); return {"message":"Тестовое письмо успешно отправлено"}
@router.get("/settings/scenarios")
def scenarios(db:Session=Depends(get_db)):
 item=ensure_scenario(db); return [{"id":item.id,"code":item.code,"name":item.name,"enabled":item.enabled}]
@router.get("/settings/scenarios/{scenario_id}")
def scenario(scenario_id:UUID,db:Session=Depends(get_db)):
 item=db.get(NotificationScenario,scenario_id)
 if not item: raise HTTPException(404,"Сценарий не найден")
 return {"id":item.id,"code":item.code,"name":item.name,"enabled":item.enabled,"subject_template":item.subject_template,"body_template":item.body_template,"recipients":item.recipients,"variables":VARIABLES}
@router.put("/settings/scenarios/{scenario_id}")
def update_scenario(scenario_id:UUID,data:ScenarioIn,db:Session=Depends(get_db)):
 item=db.get(NotificationScenario,scenario_id)
 if not item: raise HTTPException(404,"Сценарий не найден")
 for key,value in data.model_dump().items():setattr(item,key,value)
 db.commit(); return {"id":item.id}
@router.get("/notifications")
def notifications(page:int=Query(1,ge=1),db:Session=Depends(get_db)):
 items=db.scalars(select(NotificationLog).order_by(NotificationLog.created_at.desc()).offset((page-1)*50).limit(50)).all(); return [{"id":x.id,"created_at":x.created_at,"recipients":x.recipients,"subject":x.subject,"body":x.body,"status":x.status,"notification_type":x.notification_type,"original_filename":x.original_filename,"attachment_present":x.attachment_present} for x in items]
@router.get("/notifications/{item_id}")
def notification(item_id:UUID,db:Session=Depends(get_db)):
 x=db.get(NotificationLog,item_id)
 if not x: raise HTTPException(404,"Уведомление не найдено")
 return {"id":x.id,"error":x.error,"expense_id":x.expense_id,"document_id":x.document_id,"invoice_id":x.invoice_id,"attachment_size":x.attachment_size}
