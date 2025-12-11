#!/bin/sh
# Dynamic MCP Config Generator (SSOT: Database)
# Generates mcp-config.json from API at every startup

set -e

API_URL="${API_URL:-http://api:9900}"
MAX_RETRIES=30
RETRY_INTERVAL=2
TARGET="${MCP_CONFIG_PATH:-/etc/docker-mcp/config.json}"

echo "🔎 Checking API: ${API_URL}"
API_OK=0

for i in $(seq 1 $MAX_RETRIES); do
    if wget -q -O- "${API_URL}/health" > /dev/null 2>&1; then
        echo "✅ API is ready"
        API_OK=1
        break
    fi

    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "⚠️ API failed to become ready after ${MAX_RETRIES} attempts"
        echo "⚠️ Will use SAFE FALLBACK config"
        API_OK=0
        break
    fi

    echo "⏳ Waiting for API... (attempt $i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

# === 1. Fetch Secrets ===
if [ "$API_OK" = "1" ]; then
    echo "🔐 Fetching secrets from API..."
    SECRET_JSON="$(wget -q -O- "${API_URL}/api/v1/secrets/export/env" || echo '{"env_vars":{}}')"
    SECRET_COUNT="$(echo "$SECRET_JSON" | jq -r '.env_vars | length')"

    if [ "$SECRET_COUNT" -gt 0 ]; then
        echo "📦 Found $SECRET_COUNT secret(s), injecting..."
        echo "$SECRET_JSON" \
          | jq -r '.env_vars | to_entries[] | "\(.key)=\(.value)"' \
          | while IFS= read -r kv; do
              export "$kv"
              echo "✅ Exported: ${kv%%=*}"
            done
    else
        echo "ℹ️  No secrets found in database"
    fi
fi

# === 2. Fetch Enabled MCP Servers (SSOT: Database) ===
if [ "$API_OK" = "1" ]; then
    echo "📋 Fetching enabled MCP servers from API (SSOT: Database)..."
    SERVERS_JSON="$(wget -q -O- "${API_URL}/api/v1/mcp/servers/" || echo '[]')"
    SERVER_COUNT="$(echo "$SERVERS_JSON" | jq 'length')"
    echo "📊 API returned $SERVER_COUNT server(s)"
else
    SERVERS_JSON="[]"
    SERVER_COUNT=0
fi

# === 3. FORCE Override (ENV) ===
if [ -n "${MCP_FORCE_ENABLE:-}" ]; then
    echo "⚙️  FORCE ENABLE applied: ${MCP_FORCE_ENABLE}"
fi

# === 4. Generate config.json (command-based servers) ===
# Ensure target directory exists
mkdir -p "$(dirname "$TARGET")"

if [ "$API_OK" = "1" ] && [ "$SERVER_COUNT" != "0" ]; then
    echo "🛠  Generating config.json from API (SSOT: Database)..."

    # Transform database servers to config.json format
    echo "$SERVERS_JSON" | jq '{
        mcpServers: (
            map(select(.enabled == true)) |
            map({
                key: .name,
                value: {
                    command: .command,
                    args: .args,
                    env: .env
                }
            }) | from_entries
        )
    }' > "$TARGET"

    ENABLED_COUNT="$(echo "$SERVERS_JSON" | jq '[.[] | select(.enabled==true)] | length')"
    echo "✅ Generated config.json with $ENABLED_COUNT enabled server(s)"
else
    echo "⚠️  API unavailable or empty; using SAFE FALLBACK config"
    cat > "$TARGET" <<'JSON'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/host"],
      "env": {}
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}
JSON
    echo "⚠️  FALLBACK: Only filesystem + context7 enabled"
fi

# === 5. Allowlist/Blocklist (Safety Guard) ===
if [ -n "${MCP_ALLOWLIST:-}" ] || [ -n "${MCP_BLOCKLIST:-}" ]; then
    echo "🛡️  Applying Allowlist/Blocklist filters..."
    [ -n "${MCP_ALLOWLIST:-}" ] && echo "  Allowlist: ${MCP_ALLOWLIST}"
    [ -n "${MCP_BLOCKLIST:-}" ] && echo "  Blocklist: ${MCP_BLOCKLIST}"

    # TODO: Implement JSON filtering if needed
    echo "⚠️  JSON filtering not yet implemented"
fi

# === 6. Log Final Config (Transparency) ===
CONFIG_HASH="$(sha256sum "$TARGET" | awk '{print $1}')"
FINAL_SERVERS="$(jq -r '.mcpServers | keys | join(", ")' "$TARGET" 2>/dev/null || echo "unknown")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 MCP Config Generated"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Config: $TARGET"
echo "SHA256: $CONFIG_HASH"
echo "Servers: $FINAL_SERVERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# === 7. Start MCP Gateway ===
ENABLED_SERVERS="$(jq -r '.mcpServers | keys | join(",")' "$TARGET" 2>/dev/null || echo "")"

echo "🚀 Starting MCP Gateway with config.json..."
echo "   Enabled servers: $ENABLED_SERVERS"

# Pass --servers flag to enable servers from config.json
if [ -n "$ENABLED_SERVERS" ]; then
    exec "$@" --servers="$ENABLED_SERVERS"
else
    echo "⚠️  No servers found in config.json, starting without --servers flag"
    exec "$@"
fi
