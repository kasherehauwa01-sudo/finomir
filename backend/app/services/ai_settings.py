import base64
import hashlib
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import AISettings


def _cipher() -> Fernet:
    secret = get_settings().ai_settings_encryption_key
    if not secret:
        raise ValueError("Задайте AI_SETTINGS_ENCRYPTION_KEY на сервере")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_api_key(value: str) -> str:
    return _cipher().encrypt(value.strip().encode()).decode()


def decrypt_api_key(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _cipher().decrypt(value.encode()).decode()
    except InvalidToken as error:
        raise ValueError("Не удалось расшифровать API-ключ: проверьте ключ шифрования") from error


def get_ai_settings(db: Session) -> AISettings:
    item = db.get(AISettings, 1)
    if item:
        return item
    item = AISettings(id=1, enabled=False, model="gpt-4.1-mini", connection_status="not_checked", updated_at=datetime.now(timezone.utc))
    db.add(item)
    db.flush()
    return item


def public_ai_settings(item: AISettings) -> dict:
    return {"enabled": item.enabled, "model": item.model, "api_key_saved": bool(item.encrypted_api_key), "connection_status": item.connection_status, "connection_error": item.connection_error, "checked_at": item.checked_at}
