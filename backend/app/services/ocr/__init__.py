from .disabled import DisabledOCRProvider
from app.config import get_settings
from .paddle import PaddleOCRProvider
from .tesseract import TesseractOCRProvider


class FallbackOCRProvider:
 """Пробует резервный локальный OCR, если отдельный Paddle-сервис недоступен."""

 def __init__(self,*providers): self.providers=providers
 def recognize(self,path:str,mime:str):
  last_error=None
  for provider in self.providers:
   try: return provider.recognize(path,mime)
   except Exception as error: last_error=error
  if last_error: raise last_error
  raise RuntimeError("Не настроен сервис распознавания")


def get_provider(name:str):
 s=get_settings()
 if name=="paddle": return FallbackOCRProvider(PaddleOCRProvider(s.ocr_service_url,s.ocr_timeout_seconds),TesseractOCRProvider())
 if name=="tesseract": return TesseractOCRProvider()
 return DisabledOCRProvider()
