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

### 1-Line Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/quick-install.sh | bash
```

This will:
- Clone repo to `~/.local/share/airis-mcp-gateway`
- Setup config at `~/.config/airis-mcp-gateway/mcp-config.json`
- Run `docker compose up -d`
- Verify health on ports 9390/9400

### Manual Setup (Transparent)

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
cp -n .env.example .env
mkdir -p ~/.config/airis-mcp-gateway
cp -n mcp-config.json ~/.config/airis-mcp-gateway/mcp-config.json
docker compose up -d

# Verify
curl -fsS http://localhost:9400/health && echo "API OK"
curl -fsS http://localhost:9390/health && echo "Gateway OK"
```

### Homebrew (Optional CLI Wrapper)

```bash
brew tap agiletec-inc/tap
brew install airis-mcp-gateway
airis-gateway up          # git pull + docker compose up -d
airis-gateway logs
airis-gateway restart
```

Config is the same `~/.config/airis-mcp-gateway/mcp-config.json`.

### Uninstall

```bash
~/.local/share/airis-mcp-gateway/scripts/quick-install.sh --uninstall
```

---

## Register with IDE

### Claude Code

Auto-registered globally during install. Manual command if needed:

```bash
claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse
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

## Commands

### Docker Compose (Direct)

```bash
docker compose up -d              # Start
docker compose down               # Stop
docker compose pull && docker compose up -d  # Update
docker compose restart gateway    # Apply config changes
docker compose logs -f gateway api  # View logs
```

### CLI Wrapper (via Homebrew)

```bash
airis-gateway up         # Start (pulls latest)
airis-gateway down       # Stop
airis-gateway restart    # Restart
airis-gateway logs -f    # View logs
airis-gateway status     # Show status
airis-gateway config     # Edit mcp-config.json
airis-gateway servers    # List MCP servers
airis-gateway enable <server>   # Enable server
airis-gateway disable <server>  # Disable server
```

---

## Configuration

### Paths

| Type | Path |
|------|------|
| **MCP servers** | `~/.config/airis-mcp-gateway/mcp-config.json` |
| **Environment** | `.env` (in repo root) |
| **Profiles** | `config/profiles/*.json` |

Override with `AIRIS_CONFIG_DIR` environment variable.

### Profiles

```bash
# Recommended (default): airis-agent, context7, filesystem, git, memory, etc.
cp config/profiles/recommended.json ~/.config/airis-mcp-gateway/mcp-config.json

# Minimal: filesystem + context7 only
cp config/profiles/minimal.json ~/.config/airis-mcp-gateway/mcp-config.json

docker compose restart gateway
```

### Enable/Disable Servers

Edit `~/.config/airis-mcp-gateway/mcp-config.json`:

```json
{
  "mcpServers": {
    "github": { "enabled": true, ... },
    "slack": { "enabled": false, ... }
  }
}
```

Or use CLI:

```bash
airis-gateway enable puppeteer
airis-gateway disable serena
airis-gateway restart
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
| **sequential-thinking** | Multi-step reasoning |
| **serena** | Code navigation and refactoring |
| **time** | Current time |
| **fetch** | HTTP requests |

See `mcp-config.json` for full list. Add servers by editing config.

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| API (FastAPI) | 9400 | http://localhost:9400 |
| Gateway (MCP) | 9390 | http://localhost:9390 |
| Settings UI | 5273 | http://localhost:5273 (with `--profile ui`) |

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
| Gateway won't start | `docker compose logs -f` |
| 9390/9400 unreachable | `docker compose ps` to check status |
| Port conflict | Change in `.env` or use different port mapping |
| Config not read | Check `AIRIS_CONFIG_DIR` path, permissions 0644 |
| IDE not seeing tools | Verify: `curl http://localhost:9400/health` |

### Health Check

```bash
curl -fsS localhost:9400/health  # API
curl -fsS localhost:9390/health  # Gateway
```

### Full Reset

```bash
docker compose down -v
rm -rf ~/.config/airis-mcp-gateway
~/.local/share/airis-mcp-gateway/scripts/quick-install.sh
```

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
