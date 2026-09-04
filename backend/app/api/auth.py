import hashlib
import hmac
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
s = get_settings()

class PinIn(BaseModel):
    pin: str

def _signed(value: str) -> str:
    signature = hmac.new(s.auth_secret.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f"{value}.{signature}"

def _verified(token: str | None, max_age: int) -> str | None:
    if not token or "." not in token:
        return None
    value, signature = token.rsplit(".", 1)
    expected = hmac.new(s.auth_secret.encode(), value.encode(), hashlib.sha256).hexdigest()
    try:
        created, payload = value.split(":", 1)
        return payload if hmac.compare_digest(signature, expected) and time.time() - int(created) <= max_age else None
    except ValueError:
        return None

def authenticated(request: Request) -> bool:
    return _verified(request.cookies.get("finomir_session"), 60 * 60 * 24 * 30) == "authenticated"

def _set_session(response: Response) -> None:
    response.set_cookie("finomir_session", _signed(f"{int(time.time())}:authenticated"), max_age=60 * 60 * 24 * 30, httponly=True, secure=s.app_env == "production", samesite="strict", path=s.base_path)

@router.get("/status")
def status(request: Request):
    return {"authenticated": authenticated(request)}

@router.post("/pin")
def login(data: PinIn, response: Response):
    if not secrets.compare_digest(data.pin, s.login_pin):
        raise HTTPException(401, "Неверный PIN-код")
    _set_session(response)
    return {"authenticated": True}

@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("finomir_session", path=s.base_path)
