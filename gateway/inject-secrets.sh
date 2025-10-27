#!/bin/sh
# Inject secrets from API as environment variables

set -e

API_URL="${API_URL:-http://api:9000}"
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
SECRETS_JSON=$(wget -q -O- "${API_URL}/api/v1/secrets/export/env" || echo '{"env_vars":{}}')

# Parse JSON and export environment variables
echo "$SECRETS_JSON" | grep -o '"[^"]*":"[^"]*"' | while read -r pair; do
    KEY=${pair%%":"*}
    KEY=${KEY#\"}

    VALUE=${pair#*":"}
    VALUE=${VALUE%\"}
    VALUE=${VALUE#\"}

    if [ -n "$KEY" ] && [ -n "$VALUE" ]; then
        export "${KEY}=${VALUE}"
        echo "✅ Exported: $KEY"
    fi
done

echo "🚀 Starting MCP Gateway with injected secrets..."
exec "$@"
