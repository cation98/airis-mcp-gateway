# AIRIS MCP Gateway

<p align="center">
  <img src="./assets/demo.gif" width="720" alt="AIRIS MCP Gateway Demo" />
</p>

One command to add 27+ AI tools to Claude Code. No config, no setup, just works.

## Quick Start

```bash
# 1. Clone and start
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
docker compose up -d

# 2. Register with Claude Code
claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse
```

Done! You now have access to 50 tools.

## Default Enabled Servers

| Server | Runner | Tools | Description |
|--------|--------|-------|-------------|
| **airis-agent** | uvx | 10 | Confidence check, deep research, repo indexing |
| **context7** | npx | 2 | Library documentation lookup |
| **fetch** | uvx | 1 | Web page fetching as markdown |
| **memory** | npx | 9 | Knowledge graph (entities, relations) |
| **sequential-thinking** | npx | 1 | Step-by-step reasoning |
| **serena** | mcp-remote | 23 | Semantic code retrieval and editing |
| **tavily** | npx | 4 | Web search via Tavily API |

## Architecture

```
Claude Code / Cursor / Zed
    │
    ▼ SSE (http://localhost:9400/sse)
┌─────────────────────────────────────────────────────────┐
│  FastAPI Hybrid MCP Multiplexer (port 9400)             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Docker Gateway (9390)                          │    │
│  │  └─ schema partitioning + initialized fix       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ProcessManager (Lazy start + idle-kill)        │    │
│  │  ├─ airis-agent (uvx)     10 tools              │    │
│  │  ├─ context7 (npx)         2 tools              │    │
│  │  ├─ fetch (uvx)            1 tool               │    │
│  │  ├─ memory (npx)           9 tools              │    │
│  │  ├─ sequential-thinking    1 tool               │    │
│  │  ├─ serena (mcp-remote)   23 tools              │    │
│  │  └─ tavily (npx)           4 tools              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### Enable/Disable Servers

Edit `mcp-config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "enabled": true
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "enabled": true
    }
  }
}
```

Then restart:

```bash
docker compose restart api
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/sse` | SSE endpoint for Claude Code |
| `/health` | Health check |
| `/api/tools/combined` | All tools from all sources |
| `/api/tools/status` | Server status overview |
| `/process/servers` | List process servers |
| `/metrics` | Prometheus metrics |

## Commands

```bash
docker compose up -d          # Start
docker compose down           # Stop
docker compose restart api    # Restart API
docker compose logs -f api    # View API logs
docker compose pull && docker compose up -d  # Update
```

## Verify Installation

```bash
# Check health
curl http://localhost:9400/health

# List all tools
curl http://localhost:9400/api/tools/combined | jq '.tools_count'

# Check server status
curl http://localhost:9400/api/tools/status | jq '.servers[] | {name, status}'
```

## Adding New Servers

### Python MCP Server (uvx)

```json
{
  "my-server": {
    "command": "uvx",
    "args": ["my-mcp-server"],
    "enabled": true
  }
}
```

### Node.js MCP Server (npx)

```json
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "@org/my-mcp-server"],
    "enabled": true
  }
}
```

## Related Projects

| Project | Description |
|---------|-------------|
| [airis-agent](https://github.com/agiletec-inc/airis-agent) | Intelligence layer - confidence checks, deep research |
| [mindbase](https://github.com/agiletec-inc/mindbase) | Cross-session semantic memory |

## Troubleshooting

### Check Status

```bash
docker compose ps
docker compose logs --tail 50 api
curl http://localhost:9400/metrics
```

### Reset

```bash
docker compose down -v
docker compose up -d
```

### Process Server Issues

```bash
# Check specific server status
curl http://localhost:9400/process/servers/memory | jq

# View server logs
docker compose logs api | grep -i memory
```

## License

MIT
