FIELD_LABELS = {
    "partner": "Партнер", "counterparty": "Контрагент", "service_name": "Услуга / товар",
    "invoice_number": "№ счета", "invoice_date": "Дата счета", "amount": "Сумма счета",
}


def codex_prompt(entry) -> str:
    def value(fields: dict, key: str) -> str:
        item = fields.get(key)
        if isinstance(item, dict): item = item.get("value") or item.get("name")
        return str(item) if item not in (None, "") else "НЕ РАСПОЗНАНО"
    missing = ", ".join(FIELD_LABELS.get(x, x) for x in entry.missing_fields)
    lines = [
        "Нужно улучшить существующий механизм распознавания счетов Finomir на основании конкретного случая.", "",
        "ВАЖНО: не заменяй существующий механизм через OpenAI, не делай AI обязательным и не привязывай правило только к этому документу.", "",
        "ПРОБЛЕМНЫЙ СЧЕТ:", f"№{value(entry.final_fields, 'invoice_number')} от {value(entry.final_fields, 'invoice_date')}",
        f"Контрагент: {value(entry.final_fields, 'counterparty')}", "", "РЕЗУЛЬТАТ ОСНОВНОГО МЕХАНИЗМА:",
    ]
    for key, label in FIELD_LABELS.items(): lines.append(f"{label}: {value(entry.primary_fields, key)}")
    lines += ["", "ПРИЧИНА ВЫЗОВА AI FALLBACK:", entry.reason, f"Проблемные поля: {missing}", "", "РЕЗУЛЬТАТ AI FALLBACK:"]
    for key in entry.missing_fields: lines.append(f"{FIELD_LABELS.get(key, key)}: {value(entry.ai_fields, key)}")
    lines += ["", "ИТОГОВЫЕ ЗНАЧЕНИЯ, ПОДТВЕРЖДЕННЫЕ ПОЛЬЗОВАТЕЛЕМ:"]
    for key in entry.missing_fields: lines.append(f"{FIELD_LABELS.get(key, key)}: {value(entry.final_fields, key)}")
    lines += ["", "ЗАДАЧА:", "1. Изучи текущий OCR provider и RussianInvoiceParser.", "2. Найди причину ошибки именно для указанных полей.", "3. Добавь обобщаемое правило без хардкода поставщика или номера счета.", "4. Не ухудшай существующие сценарии и не меняй конфигурацию PaddleOCR.", "5. Добавь тест этого случая и регрессионные тесты.", "6. Объясни причину, изменение, охват похожих счетов и риски регрессии.", "", "Главная цель: аналогичные счета должны получать 6/6 обязательных полей без AI fallback."]
    return "\n".join(lines)
