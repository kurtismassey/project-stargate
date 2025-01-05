FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry

# Copy Poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.in-project true && \
    poetry install --no-root

# Copy application files
COPY core /app/core
COPY .env /app/.env

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["poetry", "run", "uvicorn", "core.websocket.app:app", "--host", "0.0.0.0", "--port", "8000"]