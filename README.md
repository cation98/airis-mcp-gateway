# AIRIS MCP Gateway

Unified MCP server hub powered by `docker/mcp-gateway`.

## Quick Start

```bash
# Start gateway
docker compose up -d

# Copy config to your IDE
cp mcp.json ~/.claude/mcp.json      # Claude Code
# or ~/.cursor/mcp.json              # Cursor
# or ~/.config/zed/mcp.json          # Zed
```

## Usage

Gateway provides dynamic tools:
- `mcp-find` - Search MCP servers in Docker catalog
- `mcp-add` - Add servers to your session
- `mcp-remove` - Remove servers

Example in Claude:
```
"Find filesystem MCP server"
→ mcp-find("filesystem")

"Add it to my session"
→ mcp-add("filesystem")
```

## Ports

| Service | Port |
|---------|------|
| Gateway | 9390 |

## Archive

API layer (Schema Partitioning) archived to `feature/schema-partitioning` branch.
Tag: `archive-api-YYYYMMDD`

Restore if needed:
```bash
git merge feature/schema-partitioning
```
