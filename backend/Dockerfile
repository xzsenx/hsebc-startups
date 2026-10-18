FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Приложение работает не от root: при уязвимости в коде атакующий получает
# права непривилегированного пользователя, а не контейнера целиком.
RUN useradd --create-home --uid 10001 app
COPY --chown=app:app . .
USER app

EXPOSE 8000
CMD ["./entrypoint.sh"]
