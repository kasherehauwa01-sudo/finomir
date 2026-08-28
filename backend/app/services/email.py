import logging
import mimetypes
import smtplib
import base64
import hashlib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from app.config import get_settings
from app.models import SMTPSetting

logger=logging.getLogger(__name__)
@dataclass
class EmailAttachment: filename:str; mime_type:str; data:bytes

def _encryption_key()->bytes:
 from cryptography.fernet import Fernet
 settings=get_settings()
 if settings.smtp_encryption_key:
  configured=settings.smtp_encryption_key.encode()
  try:Fernet(configured); return configured
  except ValueError:
   # Поддерживаем также обычную секретную строку из старых .env.
   return base64.urlsafe_b64encode(hashlib.sha256(configured).digest())
 # Каталог uploads подключен как постоянный Docker volume, поэтому ключ не
 # теряется при пересборке или перезапуске backend-контейнера.
 path=settings.upload_dir/".smtp_encryption_key"
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():return path.read_bytes().strip()
 key=Fernet.generate_key(); path.write_bytes(key); path.chmod(0o600); return key

def encrypt_password(value:str)->str:
 from cryptography.fernet import Fernet
 return Fernet(_encryption_key()).encrypt(value.encode()).decode()
def decrypt_password(value:str|None)->str|None:
 if not value:return None
 from cryptography.fernet import Fernet
 return Fernet(_encryption_key()).decrypt(value.encode()).decode()
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
