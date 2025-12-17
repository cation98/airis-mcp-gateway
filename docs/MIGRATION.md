# Migration Guide: PM Logic Separation

## Overview

As of v1.x, `airis-mcp-gateway` no longer contains PM (Project Management) logic. The gateway is now **routing-only**.

### What Changed

| Before | After |
|--------|-------|
| Gateway had intent detection | Use `airis-agent` MCP tools |
| Gateway had capability routing | Use `airis-agent` MCP tools |
| Gateway had `/do` endpoint | Use `airis_do` MCP tool |
| Gateway had `airis_confidence_check` | Use `airis-agent`'s implementation |

## Migration Steps

### 1. Update Gateway

Pull the latest version:

```bash
docker compose pull api
docker compose up -d api
```

### 2. Enable airis-agent

The `airis-agent` MCP server provides all PM functionality:

```bash
# Via MCP tool
airis_enable_mcp_server("airis-agent")
```

Or add to `mcp-config.json`:

```json
{
  "mcpServers": {
    "airis-agent": {
      "command": "uvx",
      "args": ["--from", "airis-agent", "airis-agent"],
      "enabled": true,
      "mode": "cold"
    }
  }
}
```

### 3. Update Tool Calls

Replace gateway PM tools with airis-agent equivalents:

| Old (Gateway) | New (airis-agent) |
|--------------|-------------------|
| `POST /do` | `airis_do` MCP tool |
| `POST /detect` | `airis_do` with `dry_run: true` |
| `POST /capabilities` | `airis_confidence_check` |
| Gateway confidence check | `airis_confidence_check` |

### 4. Full Deployment (Optional)

For production, use the full compose profile:

```bash
cd airis-mcp-gateway
docker compose -f infra/compose.yaml --profile full up -d
```

This runs all services as Docker containers:
- `airis-gateway` - MCP routing
- `airis-agent` - PM logic
- `airis-mindbase` - Long-term memory
- `postgres` - Database

## API Compatibility

The following MCP tools remain unchanged and work through gateway routing:

- `airis_do` → Routes to airis-agent
- `airis_confidence_check` → Routes to airis-agent
- `airis_agent` → Routes to airis-agent
- `airis_deep_research` → Routes to airis-agent
- `memory_*` → Routes to mindbase
- `session_*` → Routes to mindbase
- `conversation_*` → Routes to mindbase

## Troubleshooting

### "Tool not found: airis_do"

Enable the airis-agent server:

```bash
# Check status
curl http://localhost:9400/process/servers

# Enable
curl -X POST http://localhost:9400/process/servers/airis-agent/enable
```

### "Server not ready"

The server may need to start (cold mode). Wait a few seconds and retry, or change to hot mode:

```json
{
  "airis-agent": {
    "mode": "hot"
  }
}
```

### Old endpoint returns 404

The following endpoints have been removed:

- `POST /do`
- `POST /detect`
- `POST /route`
- `GET /capabilities`

Use the equivalent MCP tools via `/sse` transport instead.
