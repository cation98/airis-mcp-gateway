# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

All commands use go-task. Enter devbox shell first: `devbox shell`

```bash
# Stack management
task docker:up              # Start gateway + API
task docker:down            # Stop all
task docker:logs            # View API logs
task docker:restart         # Restart after config changes
task docker:clean           # Remove containers and volumes

# Development mode (hot reload)
task dev:up                 # Start with hot reload
task dev:watch              # Auto-rebuild TypeScript on change
task build:mcp              # Build MCP servers manually

# Testing
task test:e2e               # Full end-to-end test
task test:health            # Quick health check
task test:status            # Server status
task test:api               # Run pytest in container

# Local testing (without Docker)
cd apps/api
uv pip install -e ".[test]"
uv run python -m pytest tests/unit -v              # All unit tests
uv run python -m pytest tests/unit/test_dynamic_mcp.py -v  # Single file

# All tasks
task --list-all             # Show all available tasks
```

## Architecture

```
Claude Code
    |
    v
FastAPI API (port 9400) - Hybrid MCP Multiplexer
    |
    +-- /sse, /mcp/* --> Docker MCP Gateway (9390) --> Docker servers
    |                    + schema partitioning
    |                    + initialized notification fix
    |                    + ProcessManager tools merge
    |
    +-- /process/*   --> ProcessManager (Lazy + idle-kill)
                         + airis-agent (uvx)     10 tools
                         + context7 (npx)         2 tools
                         + fetch (uvx)            1 tool
                         + memory (npx)           9 tools
                         + sequential-thinking    1 tool
```

**Key patterns:**
- **Dynamic MCP** (default): Only 3 meta-tools exposed (airis-find, airis-exec, airis-schema)
- **Lazy loading**: Process servers start on first request, not at startup
- **Idle-kill**: Unused servers terminate after 120s (configurable)
- **Tool routing**: ProcessManager maps tool names to server names dynamically
- **Schema partitioning**: Full tool schemas lazy-loaded to reduce token usage

## Dynamic MCP Mode

By default, `DYNAMIC_MCP=true` exposes only 3 meta-tools instead of 60+:

| Tool | Purpose |
|------|---------|
| `airis-find` | Search tools by query (e.g., `airis-find query="memory"`) |
| `airis-exec` | Execute tool by name (e.g., `airis-exec tool="memory:create_entities"`) |
| `airis-schema` | Get full input schema for a tool |

**Token savings:** ~98% reduction (42k → 600 tokens)

To disable and expose all tools directly:
```bash
DYNAMIC_MCP=false docker compose up -d
```

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | gateway (9390) + api (9400) containers |
| `mcp-config.json` | Server definitions: command, args, env, enabled, mode, TTL |
| `apps/api/src/app/main.py` | FastAPI app entry point |
| `apps/api/src/app/core/process_manager.py` | Manages uvx/npx servers |
| `apps/api/src/app/core/process_runner.py` | Subprocess lifecycle + timeout handling |
| `apps/api/src/app/core/dynamic_mcp.py` | Dynamic MCP meta-tools (airis-find/exec/schema) |
| `apps/api/src/app/core/mcp_config_loader.py` | Parse mcp-config.json + TTL settings |
| `apps/api/src/app/api/endpoints/mcp_proxy.py` | SSE proxy + keepalive + timeout handling |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/sse` | SSE endpoint for Claude Code |
| `/mcp/*` | Docker MCP Gateway proxy |
| `/process/servers` | List process servers |
| `/process/tools` | List tools from process servers |
| `/process/tools/call` | Call tool (auto-routes to correct server) |
| `/api/tools/combined` | All tools from all sources |
| `/api/tools/status` | Server status overview |
| `/metrics` | Prometheus metrics |

## mcp-config.json Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "uvx|npx|sh|node",
      "args": ["arg1", "arg2"],
      "env": { "KEY": "value" },
      "enabled": true,
      "mode": "hot|cold",
      "idle_timeout": 120,
      "min_ttl": 60,
      "max_ttl": 3600
    }
  }
}
```

- **command types**: `uvx` (Python), `npx` (Node.js), `sh` (Docker via shell), `node` (direct)
- **mode**: `hot` (always loaded), `cold` (lazy loaded on demand)
- **TTL settings**: Per-server idle timeout and lifecycle controls

## Design Principles (NEVER VIOLATE)

### 1. Global Registration Only
- MCP Gateway MUST be registered globally (`--scope user`), NOT per-project
- Command: `claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse`

### 2. ALL MCP Servers Through Gateway
- All servers go through gateway - users don't register individual MCP servers
- Dynamic enable/disable via `airis_enable_mcp_server` / `airis_disable_mcp_server`
- Add new servers to `mcp-config.json`, NOT as separate registrations

### 3. One-Command Install
- `docker compose up -d` from repo root handles everything
- Register with Claude Code after startup

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DYNAMIC_MCP` | `true` | Enable Dynamic MCP (3 meta-tools only) |
| `TOOL_CALL_TIMEOUT` | `90` | Fail-safe timeout (seconds) for MCP tool calls |
| `MCP_GATEWAY_URL` | `http://gateway:9390` | Docker gateway URL |
| `MCP_CONFIG_PATH` | `/app/mcp-config.json` | Server config path |
| `GATEWAY_MODE` | `lite` | `lite` (stateless) or `full` (with DB) |
| `DATABASE_URL` | - | PostgreSQL connection (full mode only) |

## CI/CD

Path-based CI triggers - only runs relevant jobs:
- `apps/api/**` changes → Python tests (pytest)
- `apps/gateway-control/**` or `apps/airis-commands/**` changes → TypeScript build
