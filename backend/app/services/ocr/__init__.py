from .disabled import DisabledOCRProvider
from .tesseract import TesseractOCRProvider
from .paddle import PaddleOCRProvider


def get_provider(name: str, service_url: str = "http://ocr:8001"):
    if name == "paddle":
        return PaddleOCRProvider(service_url)

    if name == "tesseract":
        return TesseractOCRProvider()

    return DisabledOCRProvider()
