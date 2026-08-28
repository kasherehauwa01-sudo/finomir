import json
from pathlib import Path
from urllib.request import Request, urlopen
from pypdf import PdfReader

from .base import OCRProvider
from .parser import RussianInvoiceParser


class PaddleOCRProvider(OCRProvider):
    def __init__(self, service_url: str, timeout: int = 60): self.service_url=service_url.rstrip("/"); self.timeout=timeout
    def recognize(self, path: str, mime: str):
        if mime == "application/pdf":
            text="\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
            return RussianInvoiceParser().parse(text, 1.0) if text.strip() else RussianInvoiceParser().parse("")
        boundary = "----finomir-ocr-boundary"; data = Path(path).read_bytes()
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"document\"\r\nContent-Type: {mime}\r\n\r\n".encode() + data + f"\r\n--{boundary}--\r\n".encode())
        request = Request(f"{self.service_url}/recognize", data=body, headers={"Content-Type":f"multipart/form-data; boundary={boundary}"}, method="POST")
        with urlopen(request, timeout=self.timeout) as response: payload=json.load(response)
        blocks=payload.get("blocks", []); confidences=[float(x.get("confidence", 0)) for x in blocks]
        return RussianInvoiceParser().parse(payload.get("text", ""), sum(confidences)/len(confidences) if confidences else 0.7, blocks)
