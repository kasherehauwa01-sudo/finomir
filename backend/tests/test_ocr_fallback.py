from app.services.ocr import FallbackOCRProvider


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
