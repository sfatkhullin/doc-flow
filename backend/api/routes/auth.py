from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.users import register_user, login_user, validate_token

router = APIRouter()


class AuthRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str


@router.post("/register", response_model=AuthResponse)
def register(req: AuthRequest):
    username = req.username.strip()
    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Имя пользователя должно быть от 3 символов")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен быть от 4 символов")
    token = register_user(username, req.password)
    if token is None:
        raise HTTPException(status_code=409, detail="Пользователь уже существует")
    return AuthResponse(token=token, username=username)


@router.post("/login", response_model=AuthResponse)
def login(req: AuthRequest):
    token = login_user(req.username, req.password)
    if token is None:
        raise HTTPException(status_code=401, detail="Неверное имя пользователя или пароль")
    return AuthResponse(token=token, username=req.username)


class TokenCheck(BaseModel):
    token: str


@router.post("/verify")
def verify_token(req: TokenCheck):
    username = validate_token(req.token)
    if username is None:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    return {"username": username}
