#!/usr/bin/env bash
set -euo pipefail

cd /app

# Check if we're in lite mode (no DB)
if [[ "${GATEWAY_MODE:-lite}" == "lite" ]] || [[ -z "${DATABASE_URL:-}" ]]; then
    echo "🚀 Starting in LITE mode (no database)"
else
    echo "🚀 Running database migrations..."
    alembic upgrade head
    echo "✅ Database is up to date."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 9400
