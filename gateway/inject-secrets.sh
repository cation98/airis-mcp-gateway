#!/bin/sh
# Inject secrets from API as environment variables (jq version)

set -e

API_URL="${API_URL:-http://api:9900}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "🔐 Waiting for API to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
    if wget -q -O- "${API_URL}/health" > /dev/null 2>&1; then
        echo "✅ API is ready"
        break
    fi

    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "❌ API failed to become ready after ${MAX_RETRIES} attempts"
        exit 1
    fi

    echo "⏳ Waiting for API... (attempt $i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

echo "🔐 Fetching secrets from API..."
JSON="$(wget -q -O- "${API_URL}/api/v1/secrets/export/env" || echo '{"env_vars":{}}')"

# Use jq for robust JSON parsing
COUNT="$(echo "$JSON" | jq -r '.env_vars | length')"

if [ "$COUNT" -gt 0 ]; then
    echo "📦 Found $COUNT secret(s), injecting..."
    echo "$JSON" \
      | jq -r '.env_vars | to_entries[] | "\(.key)=\(.value)"' \
      | while IFS= read -r kv; do
          export "$kv"
          echo "✅ Exported: ${kv%%=*}"
        done
else
    echo "ℹ️  No secrets found in database"
fi

echo "🚀 Starting MCP Gateway with injected secrets..."
exec "$@"
