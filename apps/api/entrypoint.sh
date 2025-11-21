#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from /app
cd /app

echo "🚀 Running database migrations..."
alembic upgrade head
echo "✅ Database is up to date."

exec uvicorn src.app.main:app --host 0.0.0.0 --port "${API_LISTEN_PORT:-9900}"
