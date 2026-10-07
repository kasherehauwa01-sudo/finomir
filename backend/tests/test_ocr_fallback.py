from app.services.ocr import FallbackOCRProvider
from app.services.ocr.tesseract import TesseractOCRProvider


class Provider:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = 0

    def recognize(self, _path, _mime):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


def test_fallback_uses_local_provider_when_primary_is_unavailable():
    primary = Provider(error=ConnectionError("Paddle недоступен"))
    local = Provider(result="распознанный счет")

    result = FallbackOCRProvider(primary, local).recognize("invoice.png", "image/png")

    assert result == "распознанный счет"
    assert primary.calls == 1
    assert local.calls == 1


def test_fallback_does_not_call_local_provider_after_success():
    primary = Provider(result="результат Paddle")
    local = Provider(result="результат Tesseract")

    result = FallbackOCRProvider(primary, local).recognize("invoice.png", "image/png")

    assert result == "результат Paddle"
    assert primary.calls == 1
    assert local.calls == 0


def test_local_provider_only_requires_installed_russian_language(monkeypatch, tmp_path):
    image = tmp_path / "invoice.png"
    image.write_bytes(b"image")
    calls = []

    def run(command, **_kwargs):
        calls.append(command)
        return type("Result", (), {"stdout": "Счет № 15 от 01.10.2026\nВсего к оплате: 1 500,00"})()

    monkeypatch.setattr("app.services.ocr.tesseract.subprocess.run", run)

    result = TesseractOCRProvider().recognize(str(image), "image/png")

    assert calls[0][-1] == "rus"
    assert result.invoice_number == "15"
    assert str(result.invoice_amount) == "1500.00"
