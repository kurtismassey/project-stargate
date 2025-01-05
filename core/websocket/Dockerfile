FROM python:3.11-slim

WORKDIR /app

# Create a non-root user
RUN addgroup --system app && adduser --system --group app

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install and configure poetry
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry config cache-dir /app/.cache

COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-root

COPY core /app/core
COPY .env /app/.env

# Set proper permissions
RUN chown -R app:app /app

# Switch to non-root user
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["poetry", "run", "uvicorn", "core.websocket.app:app", "--host", "0.0.0.0", "--port", "8000"]