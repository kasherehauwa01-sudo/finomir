from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://finomir:finomir@postgres:5432/finomir"
    app_env: str = "production"
    app_timezone: str = "Europe/Moscow"
    base_path: str = "/"
    cors_origins: str = ""
    upload_dir: Path = Path("/app/data/uploads")
    max_upload_size_mb: int = 20
    ocr_provider: str = "tesseract"
    ocr_api_key: str | None = None
    ocr_service_url: str = "http://ocr:8001"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    @field_validator("base_path")
    @classmethod
    def path(cls, v: str) -> str:
        return "/" if v in ("", "/") else "/" + v.strip("/") + "/"
    @property
    def api_prefix(self) -> str:
        return self.base_path.rstrip("/") + "/api"
    @property
    def allowed_origins(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
@lru_cache
def get_settings() -> Settings: return Settings()
