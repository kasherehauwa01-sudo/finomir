from types import SimpleNamespace

from app.services.email import decrypt_password, encrypt_password


def test_smtp_password_uses_persistent_generated_key(monkeypatch, tmp_path):
    settings = SimpleNamespace(smtp_encryption_key=None, upload_dir=tmp_path / "uploads")
    monkeypatch.setattr("app.services.email.get_settings", lambda: settings)

    encrypted = encrypt_password("secret")

    assert encrypted != "secret"
    assert decrypt_password(encrypted) == "secret"
    assert (tmp_path / "uploads" / ".smtp_encryption_key").exists()


def test_smtp_password_accepts_plain_secret_from_env(monkeypatch, tmp_path):
    settings = SimpleNamespace(smtp_encryption_key="legacy-secret", upload_dir=tmp_path / "uploads")
    monkeypatch.setattr("app.services.email.get_settings", lambda: settings)

    encrypted = encrypt_password("secret")

    assert decrypt_password(encrypted) == "secret"
