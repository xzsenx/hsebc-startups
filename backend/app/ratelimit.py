"""Ограничение попыток входа: скользящее окно в памяти процесса.

Для одного инстанса этого достаточно. При горизонтальном масштабировании
счётчики нужно вынести в Redis — интерфейс `hit()` при этом не меняется.
"""

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: float) -> float | None:
        """Регистрирует попытку. Возвращает секунды до разблокировки или None, если можно."""
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                return round(bucket[0] + window - now, 1)
            bucket.append(now)
            return None

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


login_limiter = SlidingWindowLimiter()
