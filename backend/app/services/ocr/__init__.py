from .disabled import DisabledOCRProvider
from app.config import get_settings
from .paddle import PaddleOCRProvider
def get_provider(name:str):
 s=get_settings(); return PaddleOCRProvider(s.ocr_service_url,s.ocr_timeout_seconds) if name=="paddle" else DisabledOCRProvider()
