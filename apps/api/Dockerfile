# ==========================================
# FastAPI + UV (Python 3.12)
# ==========================================

FROM python:3.12-slim

# Install UV (fast Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy dependency files
COPY apps/api/pyproject.toml ./

# Install dependencies with UV (including dev dependencies for testing)
RUN uv pip install --system -r pyproject.toml
RUN uv pip install --system pytest pytest-asyncio httpx pytest-cov

# Copy application code
COPY apps/api/src/app ./app

# Copy tests
COPY apps/api/tests ./tests

# Copy Alembic migrations
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

# Expose port
EXPOSE 9000

# Health check (respects API_LISTEN_PORT env if provided)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; port=os.environ.get('API_LISTEN_PORT', '9000'); urllib.request.urlopen(f'http://localhost:{port}/health')"

# Run migrations then start FastAPI
ENTRYPOINT ["./entrypoint.sh"]
