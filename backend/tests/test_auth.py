from fastapi import HTTPException, Response

from app.api.auth import PinIn, _verified, login


def test_required_pin_creates_signed_session_cookie():
    response = Response()
    assert login(PinIn(pin="8852285"), response) == {"authenticated": True}
    cookie = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
    assert _verified(cookie, 60) == "authenticated"
    assert "HttpOnly" in response.headers["set-cookie"]


def test_wrong_pin_is_rejected():
    try:
        login(PinIn(pin="0000000"), Response())
    except HTTPException as error:
        assert error.status_code == 401
    else:
        raise AssertionError("Неверный PIN-код не должен открывать доступ")
