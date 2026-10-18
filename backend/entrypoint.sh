#!/bin/sh
set -e

echo "Ожидаю базу данных..."
python - <<'PY'
import os, time
import psycopg

url = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
for attempt in range(60):
    try:
        with psycopg.connect(url, connect_timeout=2):
            break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("База не поднялась за 60 секунд")
PY

echo "Применяю миграции..."
alembic upgrade head

echo "Загружаю демо-данные (если база пустая)..."
python -m app.seed

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
