# Migration Guide

## Upgrading to Dynamic MCP (v2.x)

### What Changed

Dynamic MCP is now the default mode. Instead of exposing 60+ tools directly, the gateway exposes 3 meta-tools:

| Old | New |
|-----|-----|
| 60+ tools in `tools/list` | 3 meta-tools: `airis-find`, `airis-exec`, `airis-schema` |
| Manual server enable/disable | Auto-enable on `airis-exec` |
| All servers visible to LLM | Servers discoverable via `airis-find` |

### Migration Steps

#### 1. Update Gateway

```bash
docker compose pull
docker compose up -d
```

#### 2. Update Tool Usage (if using directly)

If you were calling tools directly:

```python
# Old
result = mcp.call("memory:create_entities", {...})

# New (via Dynamic MCP)
result = mcp.call("airis-exec", {
    "tool": "memory:create_entities",
    "arguments": {...}
})
```

#### 3. Discover Tools

Use `airis-find` to discover available tools:

```python
# Find all memory-related tools
mcp.call("airis-find", {"query": "memory"})

# Find tools on a specific server
mcp.call("airis-find", {"server": "stripe"})
```

### Reverting to Legacy Mode

If you need all tools exposed directly:

```bash
DYNAMIC_MCP=false docker compose up -d
```

### API Compatibility

The SSE endpoint remains the same:
- `GET /sse` - SSE stream
- `POST /sse?sessionid=X` - JSON-RPC requests

### Troubleshooting

#### "Tool not found"

Use `airis-find` first to discover the tool:

```
airis-find query="your_tool"
```

#### Server not starting

Check if the server is disabled:

```
airis-find server="server_name"
```

If disabled, `airis-exec` will auto-enable it.

#### Old endpoints return 404

The following endpoints have been removed:
- `POST /do`
- `POST /detect`
- `POST /route`
- `GET /capabilities`

Use Dynamic MCP meta-tools instead.

## Changelog

### v2.0 - Dynamic MCP

- Added `airis-find`, `airis-exec`, `airis-schema` meta-tools
- Auto-enable disabled servers on `airis-exec`
- 98% context reduction (600 vs 42,000 tokens)
- All servers discoverable (including disabled)

### v1.x - Legacy

- All tools exposed directly
- Manual server management required
- Higher context usage
