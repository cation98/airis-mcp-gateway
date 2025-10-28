#!/usr/bin/env bash
set -euo pipefail
echo "🔍 Checking for forbidden host:port patterns..."

paths=(
  "apps/*/src/**"
  "apps/*/app/**"
  "libs/*/src/**"
  "servers/*/src/**"
)

if rg -n -e 'localhost:[0-9]+' -e '127\.0\.0\.1:[0-9]+' -e 'host\.docker\.internal:[0-9]+' \
      --glob '!**/docs/**' --glob '!infra/**' --glob '!traefik/**' \
      --glob '!docker-compose.dev.yml' \
      "${paths[@]}" 2>/dev/null; then
  echo "❌ ERROR: Found forbidden host:port reference(s)." >&2
  exit 1
fi

echo "✅ No forbidden host:port references."
