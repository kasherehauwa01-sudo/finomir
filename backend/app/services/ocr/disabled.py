from .base import OCRProvider,OCRResult
class DisabledOCRProvider(OCRProvider):
 def recognize(self,path:str,mime:str)->OCRResult: return OCRResult()
