from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12

# Хеш-заглушка для выравнивания времени ответа: если почты нет в базе, всё равно
# выполняем проверку bcrypt, иначе по скорости ответа видно, кто зарегистрирован.
_TIMING_DUMMY_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt(BCRYPT_ROUNDS))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    target = password_hash.encode() if password_hash else _TIMING_DUMMY_HASH
    try:
        matches = bcrypt.checkpw(password.encode(), target)
    except ValueError:
        # Повреждённый хеш или пароль длиннее 72 байт — просто «не совпало».
        return False
    return matches and password_hash is not None


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        return None
