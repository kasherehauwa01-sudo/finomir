import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models import WebAuthnCredential

router = APIRouter(prefix="/auth", tags=["auth"])
s = get_settings()

class PinIn(BaseModel):
    pin: str

class CredentialIn(BaseModel):
    credential: dict
    device_name: str = "Мобильное устройство"

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
    response.set_cookie("finomir_session", _signed(f"{int(time.time())}:authenticated"), max_age=60 * 60 * 24 * 30, httponly=True, secure=s.auth_origin.startswith("https://"), samesite="strict", path=s.base_path)

@router.get("/status")
def status(request: Request, db: Session = Depends(get_db)):
    return {"authenticated": authenticated(request), "biometric_available": db.scalar(select(WebAuthnCredential.id).limit(1)) is not None}

@router.post("/pin")
def login(data: PinIn, response: Response):
    if not secrets.compare_digest(data.pin, s.login_pin):
        raise HTTPException(401, "Неверный PIN-код")
    _set_session(response)
    return {"authenticated": True}

@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("finomir_session", path=s.base_path)

def _challenge_response(options, response: Response):
    from webauthn import options_to_json
    challenge = base64.urlsafe_b64encode(options.challenge).decode().rstrip("=")
    response.set_cookie("finomir_webauthn", _signed(f"{int(time.time())}:{challenge}"), max_age=300, httponly=True, secure=s.auth_origin.startswith("https://"), samesite="strict", path=s.base_path)
    return json.loads(options_to_json(options))

@router.post("/biometric/register/options")
def registration_options(request: Request, response: Response, db: Session = Depends(get_db)):
    from webauthn import generate_registration_options
    from webauthn.helpers.structs import AuthenticatorAttachment, AuthenticatorSelectionCriteria, PublicKeyCredentialDescriptor, UserVerificationRequirement
    if not authenticated(request):
        raise HTTPException(401, "Сначала войдите по PIN-коду")
    credentials = db.scalars(select(WebAuthnCredential)).all()
    options = generate_registration_options(rp_id=s.auth_rp_id, rp_name="Финомир", user_id=b"finomir-user", user_name="Финомир", exclude_credentials=[PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(item.credential_id + "==")) for item in credentials], authenticator_selection=AuthenticatorSelectionCriteria(authenticator_attachment=AuthenticatorAttachment.PLATFORM, user_verification=UserVerificationRequirement.REQUIRED))
    return _challenge_response(options, response)

@router.post("/biometric/register/verify")
def registration_verify(data: CredentialIn, request: Request, db: Session = Depends(get_db)):
    from webauthn import verify_registration_response
    if not authenticated(request):
        raise HTTPException(401, "Сначала войдите по PIN-коду")
    challenge = _verified(request.cookies.get("finomir_webauthn"), 300)
    if not challenge:
        raise HTTPException(400, "Срок регистрации отпечатка истек")
    result = verify_registration_response(credential=data.credential, expected_challenge=base64.urlsafe_b64decode(challenge + "=="), expected_rp_id=s.auth_rp_id, expected_origin=s.auth_origin, require_user_verification=True)
    credential_id = base64.urlsafe_b64encode(result.credential_id).decode().rstrip("=")
    db.add(WebAuthnCredential(credential_id=credential_id, public_key=result.credential_public_key, sign_count=result.sign_count, device_name=data.device_name[:200]))
    db.commit()
    return {"registered": True}

@router.post("/biometric/options")
def authentication_options(response: Response, db: Session = Depends(get_db)):
    from webauthn import generate_authentication_options
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement
    credentials = db.scalars(select(WebAuthnCredential)).all()
    if not credentials:
        raise HTTPException(404, "Вход по отпечатку еще не настроен")
    options = generate_authentication_options(rp_id=s.auth_rp_id, allow_credentials=[PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(item.credential_id + "==")) for item in credentials], user_verification=UserVerificationRequirement.REQUIRED)
    return _challenge_response(options, response)

@router.post("/biometric/verify")
def authentication_verify(data: CredentialIn, request: Request, response: Response, db: Session = Depends(get_db)):
    from webauthn import verify_authentication_response
    credential_id = data.credential.get("id", "")
    stored = db.scalar(select(WebAuthnCredential).where(WebAuthnCredential.credential_id == credential_id))
    challenge = _verified(request.cookies.get("finomir_webauthn"), 300)
    if not stored or not challenge:
        raise HTTPException(401, "Не удалось подтвердить вход по отпечатку")
    result = verify_authentication_response(credential=data.credential, expected_challenge=base64.urlsafe_b64decode(challenge + "=="), expected_rp_id=s.auth_rp_id, expected_origin=s.auth_origin, credential_public_key=stored.public_key, credential_current_sign_count=stored.sign_count, require_user_verification=True)
    stored.sign_count = result.new_sign_count
    db.commit()
    _set_session(response)
    return {"authenticated": True}
