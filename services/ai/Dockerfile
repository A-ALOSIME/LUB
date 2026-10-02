# syntax=docker/dockerfile:1
FROM python:3.12.14-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/ai/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.lock
RUN useradd --uid 10001 --create-home app
COPY --chown=app:app services/ai/app.py services/ai/knowledge.json ./
USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
