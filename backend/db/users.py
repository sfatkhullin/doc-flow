import json
import hashlib
import secrets
import os
from threading import Lock

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "users.json")

_lock = Lock()


def _read():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, "r") as f:
        return json.load(f)


def _write(data):
    with open(DB_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def register_user(username: str, password: str) -> str | None:
    with _lock:
        users = _read()
        if username in users:
            return None
        token = secrets.token_hex(32)
        users[username] = {
            "password": _hash_password(password),
            "token": token,
        }
        _write(users)
        return token


def login_user(username: str, password: str) -> str | None:
    with _lock:
        users = _read()
        user = users.get(username)
        if user and user["password"] == _hash_password(password):
            return user["token"]
        return None


def validate_token(token: str) -> str | None:
    with _lock:
        users = _read()
        for username, data in users.items():
            if data["token"] == token:
                return username
        return None
