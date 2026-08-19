import logging
import mimetypes
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from app.config import get_settings
from app.models import SMTPSetting

logger=logging.getLogger(__name__)
@dataclass
class EmailAttachment: filename:str; mime_type:str; data:bytes

def encrypt_password(value:str)->str:
 from cryptography.fernet import Fernet
 key=get_settings().smtp_encryption_key
 if not key: raise ValueError("Не задан SMTP_ENCRYPTION_KEY")
 return Fernet(key.encode()).encrypt(value.encode()).decode()
def decrypt_password(value:str|None)->str|None:
 if not value:return None
 from cryptography.fernet import Fernet
 key=get_settings().smtp_encryption_key
 if not key: raise ValueError("Не задан SMTP_ENCRYPTION_KEY")
 return Fernet(key.encode()).decrypt(value.encode()).decode()
def load_attachment(path:str,filename:str,mime_type:str|None)->EmailAttachment:
 data=Path(path).read_bytes(); return EmailAttachment(filename,mime_type or mimetypes.guess_type(filename)[0] or "application/octet-stream",data)
def send_email(settings:SMTPSetting,recipients:list[str],subject:str,body:str,attachments:list[EmailAttachment]|None=None)->None:
 message=EmailMessage(); message["From"]=formataddr((settings.from_name or "",settings.from_email)); message["To"]=', '.join(recipients); message["Subject"]=subject; message.set_content(body)
 for attachment in attachments or []:
  main,sub=attachment.mime_type.split('/',1) if '/' in attachment.mime_type else ("application","octet-stream"); message.add_attachment(attachment.data,maintype=main,subtype=sub,filename=attachment.filename)
 password=decrypt_password(settings.password_encrypted)
 connection=smtplib.SMTP_SSL(settings.host,settings.port,timeout=20) if settings.security=="ssl" else smtplib.SMTP(settings.host,settings.port,timeout=20)
 try:
  if settings.security=="starttls": connection.starttls()
  if settings.username: connection.login(settings.username,password or "")
  connection.send_message(message,to_addrs=recipients)
 finally: connection.quit()
