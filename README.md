# AIRIS MCP Gateway

Unified MCP server hub for Claude Code, Cursor, Zed, and all MCP-compatible IDEs.

**One endpoint, 25+ MCP servers, 90% token reduction.**

---

## Why?

Loading 25+ MCP servers at IDE startup consumes **12,500+ tokens** before you start coding.

AIRIS MCP Gateway:
- **Single endpoint** for all MCP servers
- **Schema partitioning** reduces startup tokens by 90% (12.5K → 1.25K)
- **On-demand expansion** via `expandSchema` tool
- **Dynamic enable/disable** servers as needed

---

## Quick Start

### Prerequisites

- **Docker** (Docker Desktop or OrbStack)

### Install

```bash
# Homebrew (recommended)
brew tap agiletec-inc/tap
brew install airis-mcp-gateway
airis-gateway up

# Or one-liner
bash <(curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/quick-install.sh)
```

### Verify

```bash
curl http://localhost:9400/health
# {"status":"ok"}
```

---

## Register with IDE

### Claude Code

```bash
claude mcp add airis-mcp-gateway --transport http http://localhost:9400/api/v1/mcp
```

### Cursor / Windsurf

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "airis-mcp-gateway": {
      "url": "http://localhost:9400/api/v1/mcp/sse"
    }
  }
}
```

### Zed

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "airis-mcp-gateway": {
      "settings": {
        "url": "http://localhost:9400/api/v1/mcp/sse"
      }
    }
  }
}
```

---

## Included MCP Servers

| Server | Description |
|--------|-------------|
| **airis-agent** | Confidence checks, deep research, docs optimization |
| **context7** | Official library docs (15,000+ libraries) |
| **filesystem** | File read/write/search |
| **git** | Git operations |
| **memory** | Conversation memory |
| **mindbase** | Cross-session semantic memory |
| **sequential-thinking** | Multi-step reasoning |

See `mcp-config.json` for full list.

### Dynamic Control

```bash
# Enable server
enable_mcp_server(server_name="puppeteer")

# Disable server
disable_mcp_server(server_name="puppeteer")

# List servers
list_mcp_servers()
```

---

## Commands

```bash
airis-gateway up       # Start gateway
airis-gateway down     # Stop gateway
airis-gateway logs     # View logs
airis-gateway status   # Check status
airis-gateway install  # Register with IDEs
```

---

## Configuration

### Environment Variables

```bash
cp .env.example .env
# Edit ports, database credentials, etc.
```

### Server Profiles

```bash
# Recommended (default)
cp config/profiles/recommended.json mcp-config.json

# Minimal (filesystem + context7 only)
cp config/profiles/minimal.json mcp-config.json

docker compose restart mcp-gateway
```

### Enable/Disable Servers

Edit `mcp-config.json`:

```json
{
  "mcpServers": {
    "github": { ... },           // enabled
    "__disabled_slack": { ... }  // disabled (prefix with __disabled_)
  }
}
```

---

## Architecture

```
IDE (Claude Code, Cursor, Zed)
    │
    ▼ HTTP/SSE
┌─────────────────────────────┐
│   FastAPI Proxy (port 9400) │
│   - Schema partitioning     │
│   - expandSchema injection  │
└─────────────────────────────┘
    │
    ▼ JSON-RPC
┌─────────────────────────────┐
│   MCP Gateway (port 9390)   │
│   - 25+ MCP servers         │
│   - npx/uvx/docker spawning │
└─────────────────────────────┘
```

**Schema Partitioning**: Gateway intercepts `tools/list`, removes nested properties, caches full schemas. IDEs receive minimal schemas at startup. `expandSchema` tool retrieves details on-demand.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Gateway won't start | `docker compose logs` |
| Port conflict | Edit `.env`, change `API_LISTEN_PORT` |
| IDE not seeing tools | Verify: `curl http://localhost:9400/health` |
| High token usage | Enable `DEBUG=true` in `.env`, check logs |
| Out of memory (8GB RAM) | See "Low Memory" section below |

### Low Memory Systems (8GB RAM)

If `pnpm install` freezes or causes memory issues on 8GB machines:

```bash
# Option 1: Use Docker (recommended)
# All builds happen in containers, no host-side memory pressure
airis-gateway up

# Option 2: Limit Node.js memory
NODE_OPTIONS="--max-old-space-size=2048" pnpm install

# Option 3: Install with fewer parallel jobs
pnpm install --child-concurrency=1
```

The recommended approach is using Docker (`airis-gateway up`), which runs all builds inside containers and doesn't require pnpm on your host machine.

---

## Related Projects

- **[airis-agent](https://github.com/agiletec-inc/airis-agent)** - Intelligence layer (confidence checks, research)
- **[airis-workspace](https://github.com/agiletec-inc/airis-workspace)** - Docker-first monorepo manager
- **[airis-code](https://github.com/agiletec-inc/airis-code)** - Terminal-first autonomous coding
- **[mindbase](https://github.com/agiletec-inc/mindbase)** - Cross-session memory with semantic search

---

## License

MIT

---

**Built by [Agiletec](https://github.com/agiletec-inc)**
