from .disabled import DisabledOCRProvider
from .tesseract import TesseractOCRProvider
def get_provider(name:str): return TesseractOCRProvider() if name == "tesseract" else DisabledOCRProvider()
